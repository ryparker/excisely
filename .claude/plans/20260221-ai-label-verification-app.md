# Excisely — AI-Powered Alcohol Label Verification

## Overview

Build a standalone AI-powered tool for TTB labeling specialists to verify alcohol beverage labels against COLA application data (Form 5100.31). The app uses a hybrid AI pipeline — Google Cloud Vision for pixel-accurate OCR with bounding boxes, then GPT-5 Mini for semantic field classification — to extract and annotate label fields from uploaded images, then compares them against form-submitted application data. Every validation produces a persistent, auditable paper trail with annotated images showing exactly where and how the AI made each determination.

> **Terminology note:** Throughout this plan, "labeling specialist" is TTB's official title for reviewers (not "agent" or "reviewer"). In our database schema, user roles are `admin` and `specialist`. The UI uses TTB's exact vocabulary: "Brand Name" (not "Trade Name"), "Fanciful Name" (distinct field), "Alcohol Content" (not "ABV"), "Health Warning Statement" / "GOVERNMENT WARNING", "Name and Address" (with qualifying phrase), "Type of Product" (Wine / Distilled Spirits / Malt Beverages), "Needs Correction" / "Conditionally Approved" / "Approved" / "Rejected" for statuses.

**Stack:** Next.js 16 (App Router, RSC-first, Turbopack) + TypeScript + Tailwind CSS v4 + shadcn/ui + Motion + PostgreSQL (Drizzle ORM) + Google Cloud Vision + Vercel AI SDK (GPT-5 Mini) + React Hook Form + Zustand + nuqs + Vercel

> **MVP scope:** Phases 1-3 (Steps 1-12) are the **MVP** — login, validate, results, history, dashboard. This is a complete, demonstrable app. Phases 4-7 are **stretch goals** that add depth (review queue, batch, applicants, reports, admin). Build the MVP first, then layer on stretch features.

---

## Key Decisions

### 1. Architecture: RSC-First (Stockbridge Pattern) on Next.js 16
- **Everything is a React Server Component** by default
- Data loading happens in RSC async components — no client-side fetching, no exposed API routes
- All mutations go through **Server Actions** with Zod validation
- Client components (`'use client'`) only where interactivity is required (file upload dropzone, image annotation viewer, form inputs)
- **Next.js 16 specifics:**
  - **Turbopack** is now the default bundler (2-5x faster builds)
  - **`proxy.ts`** replaces `middleware.ts` — same redirect/rewrite/auth-check logic, now runs on Node.js runtime (not Edge)
  - **`use cache`** directive for explicit caching (replaces implicit caching from Next.js 14/15)
  - **React 19.2** bundled
  - **`next lint` removed** — use ESLint CLI directly (`eslint .`)

### 2. Database: PostgreSQL via Drizzle ORM on Neon (Vercel-native)
- **Drizzle ORM** — lightweight, type-safe, SQL-first (simpler than Prisma for this scope)
- **Neon Postgres** — serverless Postgres that deploys on Vercel with zero config via `@neondatabase/serverless`
- Connection via Neon's HTTP driver for serverless compatibility (no connection pooling headaches)
- **Nano IDs for all primary keys** — use `nanoid` (21-char, URL-friendly) instead of UUID. Shorter, URL-safe, smaller index footprint, no hyphens. Generated in application code via `$defaultFn(() => nanoid())` on each `text('id').primaryKey()` column.
- **Type inference from schema** — Drizzle's `$inferSelect` and `$inferInsert` derive TypeScript types directly from table definitions. No manual type maintenance:
  ```ts
  type Label = typeof labels.$inferSelect        // SELECT result type
  type NewLabel = typeof labels.$inferInsert      // INSERT input type
  ```
- **Zod schema generation** — `drizzle-orm/zod` auto-generates Zod schemas from tables for runtime validation in server actions:
  ```ts
  import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
  const insertLabelSchema = createInsertSchema(labels, {
    brandName: (schema) => schema.min(1).max(200),
  })
  ```
  This is the single source of truth: schema.ts → TypeScript types + Zod validation + SQL migrations.
- **Migration strategy (Drizzle Kit):**
  - **Development:** `drizzle-kit push` — pushes schema directly to DB, no migration files (fast iteration)
  - **Production:** `drizzle-kit generate` → `drizzle-kit migrate` — generates SQL migration files from schema diffs, applies in order, tracks in `__drizzle_migrations` table
  - **Forward-only** — no built-in down/rollback. Rollbacks are done by creating a new forward migration that reverses the change.
  - **Custom migrations** — `drizzle-kit generate --custom` creates empty SQL files for data migrations or complex DDL
  - **Workflow:** edit `schema.ts` → `yarn db:generate` → review generated SQL → `yarn db:migrate` → commit migration files

### 3. Beverage-Type-Aware Validation (TTB "Type of Product")
- **Type of Product selector** on the validation form (mirrors Form 5100.31 Item 5): Distilled Spirits, Wine, Malt Beverages
- **Class/Type Code** — numeric code (0-999) per TTB's classification system. Dropdown or type-ahead populated from `src/config/class-type-codes.ts` (e.g., 101 = Straight Bourbon Whisky, 84 = Sparkling Wine, 901 = Beer)
- Selection determines:
  - **Which fields are mandatory** (e.g., wine requires sulfite declaration + appellation of origin + grape varietal; spirits may require age statement; malt beverages: ABV only required if alcohol from flavors/non-beverage ingredients)
  - **Which standards of fill are valid** (January 2025 final rule):
    - Spirits: 50mL, 100mL, 187mL, 200mL, 250mL, 331mL, 350mL, 355mL, 375mL, 475mL, 500mL, 570mL, 700mL, 710mL, 720mL, 750mL, 900mL, 945mL, 1L, 1.5L, 1.75L, 1.8L, 2L, 3L, 3.75L
    - Wine: 180mL, 187mL, 200mL, 250mL, 300mL, 330mL, 360mL, 375mL, 473mL, 500mL, 550mL, 568mL, 600mL, 620mL, 700mL, 720mL, 750mL, 1L, 1.5L, 1.8L, 2.25L, 3L
    - Malt Beverages: **no federal standard of fill** — any size permitted
  - **Health warning type size requirements** (based on container size: 1mm for ≤237mL, 2mm for 237mL–3L, 3mm for 3L+)
- **Container size input** (TTB: "Total Bottle Capacity") — captured alongside type of product to drive type-size validation
- **Standards of fill validation** — cross-reference the net contents value against legal sizes for the product type (e.g., a 600mL bourbon is illegal regardless of what the label says; any size beer is fine)
- Field definitions stored in `src/config/beverage-types.ts` and `src/config/class-type-codes.ts` — easy to update if regulations change

### 4. AI: Hybrid Pipeline — Google Cloud Vision + GPT-5 Mini (via Vercel AI SDK)
- **Two-stage pipeline** for accurate bounding boxes and cheap classification:
  - **Stage 1: Google Cloud Vision API** (`@google-cloud/vision`) — purpose-built OCR engine
    - `TEXT_DETECTION` returns word-level bounding polygons (4 vertices, pixel-accurate), <1s latency, $0.0015/image
    - Handles rotated text, curved labels, multi-language — far superior to any LLM for spatial text localization
    - Returns all text on the label with exact pixel coordinates — no guessing, no approximation
    - Free tier: 1,000 units/month (plenty for development + testing)
  - **Stage 2: GPT-5 Mini** (`openai('gpt-5-mini')` via AI SDK) — semantic field classification
    - Receives OCR text output only (no image tokens — much cheaper and faster)
    - Classifies text blocks into TTB fields (brand name, alcohol content, health warning, etc.)
    - Inherits bounding box coordinates from Stage 1 for UI overlay
    - $0.25/1M input, $2.00/1M output — **7x cheaper** than GPT-5.2 for this text-only task
    - Full structured output support via `generateText` + `Output.object()` with Zod schemas
  - **Total cost: ~$0.003/label** (vs ~$0.0105 for GPT-5.2 alone). **Total latency: 2-4s** (vs 3-8s for GPT-5.2 vision)
- **Why not a single LLM for both OCR and classification?**
  - GPT-5.2 vision has mAP50:95 of 1.5 for bounding boxes (worst frontier model per Roboflow benchmarks)
  - Gemini 2.5 Pro is best LLM at mAP 13.3 but 10-30s latency (fails 5s target)
  - Google Cloud Vision is purpose-built for OCR — pixel-accurate, sub-second, dirt cheap
  - Splitting OCR from classification lets us use a cheap model (GPT-5 Mini) for the reasoning step
- **Vercel AI SDK** (`ai` v6 + `@ai-sdk/openai`) for GPT-5 Mini classification — no AI Gateway needed:
  - `generateText` + `Output.object()` with Zod schemas — AI SDK v6 idiomatic approach
  - AI Gateway skipped: single provider (OpenAI), no value from proxy layer, just adds latency
  - Provider-agnostic — can swap classification model by changing one line
  - Raw `openai` SDK not needed for our use case
- **Structured outputs** via `generateText` + `Output.object()` with Zod schema:
  - Classified fields: brand name, fanciful name, class/type designation, alcohol content, net contents, health warning statement, name and address with qualifying phrase, country of origin, plus product-type-specific fields
  - Each field maps to bounding box coordinates inherited from Cloud Vision OCR stage
  - Confidence scores per field
  - **Important:** Use `.nullable()` instead of `.optional()` in all Zod schemas — OpenAI structured output mode does not support optional properties
- **Bounding boxes are now reliable:** Cloud Vision provides pixel-perfect word-level polygons. No fallback/degradation needed. Every detected text region has exact coordinates.
- **Multi-image support**: Stage 1 runs Cloud Vision on each image independently (parallel via `Promise.all`). Stage 2 receives combined OCR text from all images in a single `generateText` call — gives the model cross-label context.
- AI classification prompt is **beverage-type-aware** — tells the model which fields to look for based on product type selection
- Target < 5s total per label (Stage 1: <1s per image + Stage 2: ~1-2s classification)

### 5. Image Annotation System
- Store bounding box data from Google Cloud Vision OCR in the database alongside each validation item (pixel-accurate polygons, not LLM approximations)
- Frontend renders an **interactive overlay** on the original image using **CSS transforms** for zoom/pan (custom ~80 lines, no library dependency) with **absolute-positioned SVG elements** for bounding boxes
- Each annotation is color-coded: green (match), red (mismatch), yellow (uncertain)
- Clicking a validation item in the checklist highlights the corresponding region on the image
- **Zoom/pan implementation:** `transform: scale(${zoom}) translate(${x}px, ${y}px)` on a container div wrapping the image + SVG overlay. Wheel zoom, drag to pan, programmatic "zoom to field" when clicking a comparison row.

### 6. UI: Government Compliance Theme
- **shadcn/ui** (new-york style, slate base) as component foundation
- Custom government/official theme:
  - Deep navy (`#1a2332`), gold accents (`#c5a944`), white/slate backgrounds
  - **Typography:** Source Serif 4 (headings — transitional serif with optical size axis, evokes official documents), Inter (body — tall x-height, tabular numerals for data tables), JetBrains Mono (serial numbers, codes — dotted zero for O/0 disambiguation). All variable fonts via `next/font/google`.
  - Badge-style status indicators matching TTB terminology (APPROVED / CONDITIONALLY APPROVED / NEEDS CORRECTION / REJECTED)
  - Seal/shield motif in the header/branding
- **Motion** (framer-motion) for page transitions, accordion reveals, toast notifications, progress animations
- **next-themes** for light/dark mode toggle — `ThemeProvider` in root layout with `attribute="class"`, works with Tailwind CSS v4's `@variant dark`. System preference detection + manual toggle.
- **Vercel Analytics** — `<Analytics />` component in root layout for page views + custom events (`track('label_reviewed', { status })`)
- Responsive but desktop-first (agents use desktop workstations)

### 7. Iconography & Visual Clarity
- **Use icons where they genuinely help** — to aid recognition, reduce clutter, and make the UI faster to learn. Not every element needs an icon; use judgment
- **Icon library:** Lucide React (consistent stroke style, large set, tree-shakeable)
- **Where icons shine:**
  - **Status indicators:** `CircleCheck` (pass, green), `CircleX` (fail, red), `CircleAlert` (needs review, amber) — instantly recognizable, no reading required
  - **Navigation:** sidebar items get icon + label (e.g., `LayoutDashboard` + "Dashboard") — the icon builds muscle memory over time
  - **Field-type identifiers:** each field in the validation checklist gets a small icon (`Wine` for class/type, `Percent` for ABV, `ShieldAlert` for health warning, etc.) — makes the list scannable
  - **Buttons with icons:** primary actions pair an icon with text (e.g., `Upload` icon + "Validate Label") — the icon draws the eye, the text confirms intent
  - **Inline status in tables:** icon badges replace verbose status text in dense table views
- **Where text is better:** form labels, long explanations, error messages, report content — don't force an icon where words are clearer
- **Tooltips on all icons** — every standalone or ambiguous icon is wrapped in shadcn `<Tooltip>` so users can hover to confirm meaning
- **Consistent vocabulary:** same icon always means the same thing across the entire app — builds familiarity fast

### 8. Authentication & Roles (Better Auth)
- **Better Auth** — same library as stockbridge, proven pattern
- **Two roles:**
  - **Admin** (Sarah Chen, Deputy Director) — full access: manages specialists, views all validations across the team, performance dashboards, applicant risk overview, settings management
  - **Specialist** (labeling specialists like Dave, Jenny — TTB's official title) — scoped access: validate labels, process their own queue, view their own history, review flagged items
- **Auth flow:**
  - Email/password login (simple for prototype — specialists get pre-provisioned accounts)
  - Session-based with `better-auth` cookie management (30-day expiry, 1-day refresh — matching stockbridge)
  - Rate-limited login attempts (3 per minute per email)
- **Route protection:**
  - `proxy.ts` checks session on all routes except `/login`
  - Admin-only routes (`/admin/*`, `/settings`) reject specialist-role users with redirect
  - Every server action checks `auth()` session before executing — no unauthenticated mutations possible
- **Specialist assignment:**
  - Labels and reviews are **assigned to the specialist who processes them** — tracked via `specialist_id` on labels and human_reviews
  - Specialists see their own workload by default, can view team-wide history
- **Admin dashboard** (`/admin`):
  - **Specialist performance table:** labels processed per specialist, pass/rejection rate, avg processing time, review turnaround time, current queue depth
  - **Specialist activity feed:** who's working on what right now
  - **Applicant risk overview:** which companies are causing the most rejections, which are new/unknown
  - **Throughput metrics:** team velocity (labels/day, labels/week), bottleneck identification (which specialists are overloaded, which have capacity)
  - **Trends:** team performance over time, comparison between specialists (not punitive — for workload balancing)
- **Seed users:**
  - 1 admin: Sarah Chen (sarah.chen@ttb.gov)
  - 5-6 specialists with varying activity levels: Dave Morrison (veteran, slower but thorough), Jenny Park (fast, high volume), + 3-4 others with different patterns
  - Each specialist has realistic validation history distributed across the seed data

### 9. Security Posture (Production-Grade)
- **No API routes exposed** — all data access through RSC and server actions only
- **Server Action hardening:**
  - Every server action validates input with Zod schemas
  - File upload validation: type checking (image/*), size limits (10MB), magic byte verification
  - No raw SQL — all queries through Drizzle's parameterized query builder
- **Headers:** Strict CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff
- **Environment variables:** All secrets server-only (no `NEXT_PUBLIC_` for sensitive keys)
- **Database:** Neon with connection string in server-only env vars, no client-side database access possible
- **File storage:** Vercel Blob with signed URLs (time-limited access, no public bucket). Client-side direct uploads via `@vercel/blob/client` for batch processing (bypasses server action body size limits).
- **Environment files:** Next.js native `.env` / `.env.local` / `.env.development` / `.env.production` — no `dotenv` package needed. `NEXT_PUBLIC_` prefix for client-exposed vars; everything else is server-only.
- **Rate limiting:** ~~Deferred for prototype.~~ Production would use `@upstash/ratelimit` + Upstash Redis (HTTP-based, serverless-compatible). In-memory rate limiting does NOT work on Vercel serverless (each invocation is isolated). Noted as a production hardening item.

### 9b. State Management: Zustand + nuqs
- **Zustand** (v5) — lightweight client-side state for:
  - Image annotation viewer state (active field, zoom level, pan position)
  - Keyboard shortcut context (which shortcuts are active, which page context)
  - Batch upload queue state (file list, upload progress per file, overall status)
  - Form draft state (unsaved validation form data, selected applicant)
  - Review session state (current field index, override decisions before submit)
- **Why Zustand over React Context:** multiple independent stores without provider nesting, works outside React (useful for keyboard handlers), minimal re-renders via selectors, persist middleware for draft recovery
- **nuqs** (v2.8) — type-safe URL search params for:
  - Table filters (status, date range, applicant, beverage type) — persisted in URL so filters survive refresh and are shareable
  - Pagination (page, pageSize) — bookmarkable
  - Sort order (column, direction)
  - Active tab state on detail pages
  - `createSearchParamsCache` from `nuqs/server` enables type-safe URL params in React Server Components without prop drilling
  - Built-in parsers: `parseAsStringEnum` for status filters, `parseAsInteger` for pagination, `parseAsIsoDateTime` for date ranges
- **Boundary:** Zustand for ephemeral client state (annotation interactions, form drafts). nuqs for persistent filter/navigation state (URL-backed, shareable, RSC-compatible).

### 10. Human Review Queue
- When the AI confidence on any field falls below a configurable threshold (e.g., < 80%), that **validation item** gets flagged `needs_correction`
- If **any** field on a label is `needs_correction`, the overall label status becomes `needs_correction`
- Dedicated **Review Queue page** (`/review`) shows all labels awaiting specialist verification
  - Sorted by oldest first (FIFO) so nothing gets stale
  - Filterable by field type (e.g., "show me all uncertain health warnings")
  - Shows count badge in the sidebar nav so specialists always know the queue depth
- **Review detail view** (`/review/[id]`): same annotated image + checklist layout as history detail, but with **action controls**:
  - Per-field: specialist can override the AI's determination — mark as "Match", "Mismatch", or "Not Found"
  - Specialist adds optional notes explaining their decision (paper trail — TTB calls these "reasons for correction/denial")
  - Once all flagged fields are resolved, specialist clicks "Complete Review" to finalize
- All human decisions are **auditable** — stored in the database with the reviewer info and timestamp
- Dashboard and reports include review queue metrics: queue depth, avg time-to-review, human override rate

### 11. Communication Reports (Approval / Rejection Notices)
- After a label is fully validated (approved, conditionally approved, needs correction, rejected, or reviewed by specialist), the specialist needs to communicate results back to the applicant
- **Two report templates** generated server-side from validation data:
  - **Approval notice:** Confirmation that the label meets all requirements — professional, concise
  - **Rejection/correction notice:** Lists each mismatched or missing field with what was found vs what's required, clear instructions on what to fix and resubmit
- **Copyable message block** on the history detail page (`/history/[id]`):
  - Pre-formatted plain-text message (generated from template + validation data)
  - "Copy to Clipboard" button — one click, ready to paste into email
  - Toggleable format: plain text vs formatted (for email clients that support rich text)
- **"Send Report" button** — visible but **disabled** with a `BETA` / `Coming Soon` badge
  - Tooltip explains: "Email delivery coming in a future release"
  - Designed to show the intended workflow — clicking opens a disabled dialog showing the email preview with To/Subject/Body fields
  - Demonstrates forethought in the UX without requiring email infrastructure
- Reports include: label image thumbnail, field-by-field breakdown, overall determination, and any human review notes

### 12. Configurable Validation Settings (Simplified)
- **Settings page** (`/settings`) — allows admins to tune how the AI validation behaves without code changes
- **Confidence threshold** (global):
  - Slider or input: "Flag for human review when confidence is below ___%" (default: 80%)
  - Applies to all fields — any field below this threshold routes to the review queue
- **Per-field match strictness:**
  - Each field (brand name, class/type, alcohol content, etc.) can be set to: **Strict** (exact match required), **Moderate** (case-insensitive, normalized), or **Lenient** (fuzzy, allows minor variations)
  - Defaults: Health Warning → Strict, Brand Name → Moderate, Alcohol Content → Moderate, Net Contents → Moderate, Class/Type → Lenient, Name and Address → Lenient, Country of Origin → Lenient
- **Accepted variants / synonyms whitelist:**
  - Per-field editable list of equivalent values that should be treated as matches
  - Examples:
    - Class/Type: "Kentucky Straight Bourbon Whiskey" ↔ "KY Straight Bourbon Whiskey" ↔ "Straight Bourbon Whiskey"
    - Net Contents: "750 mL" ↔ "750ml" ↔ "75cL" ↔ "0.75L"
    - Country of Origin: "USA" ↔ "United States" ↔ "United States of America" ↔ "US"
  - Specialists can submit new equivalences as they encounter them — builds institutional knowledge over time
- **Health warning statement templates:**
  - Manage the list of acceptable "GOVERNMENT WARNING:" text versions (the standard warning, plus any TTB-approved variants)
  - Default pre-loaded with the current mandatory warning text from 27 CFR Part 16
  - If TTB updates the required wording, admins can add the new version without a code deploy
- ~~**Auto-pass rules:** Cut — over-engineered for prototype. Confidence threshold + per-field strictness + accepted variants cover the same need more simply.~~
- ~~**Report template editor:** Cut — communication reports use well-written, fixed templates per status (Approved, Conditionally Approved, Needs Correction, Rejected) that mirror TTB's actual communication style and cite specific CFR sections. No customization needed — if templates need updating, it's a code change.~~
- Settings stored in a `settings` table (key-value with jsonb values) — loaded server-side in validation pipeline
- Changes take effect immediately on next validation (no restart needed)

### 13. Correction Deadline Tracking
- **30-day countdown** for "Needs Correction" labels and **7-day countdown** for "Conditionally Approved" labels — mirrors TTB's real correction windows
- `labels` table gets two new columns:
  - `correction_deadline` (timestamp, nullable) — set when status transitions to `needs_correction` (now + 30 days) or `conditionally_approved` (now + 7 days)
  - `deadline_expired` (boolean, default false) — updated lazily (see below)
- **Countdown badges** on label cards in history, review queue, and batch detail views:
  - Green: > 7 days remaining
  - Amber: 1-7 days remaining ("Expiring soon")
  - Red: < 24 hours or expired
- **Lazy deadline expiration** (no cron job needed):
  - A shared `getEffectiveStatus()` helper computes the true status: if `correction_deadline < now()` and status is `needs_correction` → treat as `rejected`. If `conditionally_approved` and deadline passed → treat as `needs_correction`.
  - All label queries and RSC data loading use this helper to return the correct effective status.
  - When a label with an expired deadline is loaded (page view, queue query, etc.), a fire-and-forget DB update sets `deadline_expired = true` and transitions the status column — so the DB eventually converges without a cron job.
  - This is always accurate (no race between "when cron ran" and "when user sees data") and requires zero external infrastructure.
- **Dashboard widget:** "Expiring Soon" section showing labels with deadlines approaching in the next 7 days — ensures nothing falls through the cracks
- **Reports:** correction response rate (what % of "Needs Correction" get addressed before deadline)

### 14. Side-by-Side Field Comparison View
- On the validation detail page (`/history/[id]`) and review detail page (`/review/[id]`), the right panel uses a **two-column comparison layout** for each field:
  - **Left column:** "Application (Form 5100.31)" — the expected value from the form data
  - **Right column:** "Label (AI Extracted)" — what the AI found on the image
  - **Diff highlighting:** inline character-level diffing via `diff` (jsdiff) library's `diffChars()` — returns `{value, added, removed}` array rendered as green (matching) / red (different) spans. Makes discrepancies visually pop without reading.
  - Clicking either column highlights the corresponding bbox on the annotated image
- This replaces the simple "expected vs extracted" text in the checklist — more closely mirrors the physical process of comparing form data to the label
- Each field row also shows: status badge (match/mismatch/not found/needs correction), confidence score, and expandable AI reasoning
- **Compact mode** toggle for experienced specialists who want to see all fields at once without expanding

### 15. Keyboard Shortcuts for Queue Processing
- **Global shortcuts** (active on history detail, review detail, and queue pages):
  - `A` = Approve label (sets overall status to approved)
  - `R` = Reject label
  - `C` = Mark as Needs Correction
  - `N` = Next label in queue / next in history
  - `P` = Previous label
  - `J` / `K` = Navigate between fields in the comparison checklist
  - `Enter` = Confirm current field override (in review mode)
  - `E` = Expand/collapse AI reasoning for current field
  - `?` = Show keyboard shortcut overlay
- **Shortcut bar** — a subtle, fixed footer showing available shortcuts for the current page context (e.g., on review detail: `A Approve · R Reject · J/K Navigate · N Next`)
- Shortcuts are **only active** when no input/textarea is focused (prevent conflicts with typing)
- This directly addresses throughput — the AI handles extraction in ~5s, but the specialist also needs to act fast. Keyboard-driven review can halve the per-label review time.

### 16. Resubmission Linking
- When a label with status "Needs Correction" or "Rejected" is resubmitted, the new submission can be **linked to the original** via a "Prior TTB ID" / "Prior Submission" field (mirrors Form 5100.31 Item 18d "Resubmission of Previously Rejected Application")
- `labels` table gets: `prior_label_id` (text, FK → labels, nullable) — creates a chain: Original → Corrected Resubmission
- On the validation detail page, linked labels show:
  - **"Resubmission of [prior label]"** header with link to the original
  - **Diff view:** what changed between the original and the resubmission (which form fields were updated, whether a new image was provided)
  - The specialist can quickly see: "this was rejected for health warning issues, and the resubmission fixed the caps on GOVERNMENT WARNING"
- **Priority badge** in the review queue: resubmissions after correction get a "Priority" indicator and sort above new submissions (mirrors TTB's priority processing for corrected applications)
- Resubmission chain is visible on the applicant detail page — shows the full lifecycle of a label from first submission through correction to approval

### 17. Quick Approve for Clean Labels
- When the AI returns high confidence (above threshold) on ALL fields and every field is a match, show a streamlined **"Quick Approve" view** instead of the full comparison layout:
  - Condensed summary card: "All N fields match with high confidence (avg XX%)"
  - Thumbnail of the label with all bboxes in green
  - Single **"Approve" button** (prominent, green) — one click to approve and move to next
  - "View Full Details" link to expand into the standard side-by-side comparison if the specialist wants to double-check
- On the history list page, clean labels show a subtle "Quick approve available" indicator
- **Batch quick approve:** on the batch detail page, a "Bulk Approve Clean" button that approves all labels where every field matches at high confidence — with a confirmation dialog showing count ("Approve 147 of 200 labels? All fields match with >90% confidence.")
- This is key for throughput: ~40% of labels pass cleanly. If specialists don't have to click through each field on the easy ones, they can spend their time on the hard cases.

### 18. Revalidation
- Any label can be **re-validated** at any time — useful when settings change (new accepted variants, adjusted thresholds), a better image is provided, or the specialist just wants a fresh AI pass
- **"Revalidate" button** on the history detail page (`/history/[id]`) and review detail page (`/review/[id]`)
  - Icon button with `RefreshCw` icon + "Revalidate" text
  - Confirmation dialog: "This will re-run AI analysis. Previous results will be preserved in history."
- **How it works:**
  - Previous `validation_results` and `validation_items` are **not deleted** — they get a `superseded_by` pointer to the new result (preserves full audit trail)
  - Re-runs the same image through the AI pipeline with current settings (confidence threshold, strictness, accepted variants)
  - Optionally allows uploading a **replacement image** (e.g., applicant sent a better photo) before revalidating
  - If the label was in the review queue, revalidation resets it — the new AI result may resolve the uncertainty
- **Batch revalidation:** on the batch detail page, "Revalidate All Rejected" button re-processes only labels that rejected or need correction
- `validation_results` table gets a `superseded_by` column (nullable FK to itself) to chain result history

### 19. Applicant / Company Grouping & Compliance Reputation (Simplified)
- Labels are linked to an **applicant** — a company or individual who submitted the application
- **`applicants` table:** stores company name, contact email, and optional metadata
- When submitting a label for validation, the specialist selects or creates an applicant
  - Autocomplete dropdown that searches existing applicants (type-ahead)
  - "Add New Applicant" inline option if not found
- **Applicant detail page** (`/applicants/[id]`):
  - All labels submitted by this applicant, across all batches
  - **Compliance reputation summary** — simple, at-a-glance stats:
    - Approval rate (percentage)
    - Total submissions (count)
    - Last submission date
    - Most common rejection reason (text, e.g., "Health warning issues: 6 times")
  - **Risk badge** — dead simple threshold: <70% approval = red, 70-90% = amber, >90% = green. The number speaks for itself.
  - Full label history for this applicant (table, filterable by status)
  - ~~**Trend arrows** (improving/stable/declining) — cut for prototype. Approval rate + total count is enough; specialists can see patterns from the list.~~
  - ~~**"Is this denial unusual?" context** — cut for prototype. Adds analysis complexity without proportional value.~~
- **Applicant list page** (`/applicants`):
  - Searchable/sortable table of all applicants
  - Columns: company name, total labels, approval rate, last submission date, risk badge
  - Quick link to filter history by applicant
- Batches can be associated with an applicant — "This batch of 200 labels is all from Jack Daniel's"
- Reports page includes per-applicant summary (top offenders, highest volume)
- Communication reports auto-populate the applicant name and details

### 20. Batch Upload System
- Drag-and-drop zone via `react-dropzone` accepting multiple files (up to 300 at once)
- Client-side file queuing with progress indicators (Zustand `upload-store`)
- **Upload phase:** client-side direct-to-Blob uploads via `@vercel/blob/client` with `p-limit` concurrency control (max 5 parallel uploads). Per-file progress tracking.
- **Processing phase:**
  - Server action creates batch record + individual label records with Blob URLs
  - AI validation processed via individual server action calls per label, triggered from the client with `p-limit` concurrency control (max 3-5 parallel pipelines to stay within Cloud Vision + OpenAI rate limits)
  - Real-time progress updates via polling (simple, no WebSocket complexity) — client polls batch status every 2 seconds
- Batch overview page showing overall progress, approved/rejected counts

---

## Database Schema

> **ID strategy:** All tables use **nanoid** (21-char, URL-friendly, e.g. `V1StGXR8_Z5jdHi6B-myT`) instead of UUID. Generated via `$defaultFn(() => nanoid())` in Drizzle schema. Exception: `users` and `sessions` tables use whatever Better Auth generates (may be UUID or cuid depending on adapter config).

```
users (managed by Better Auth)
├── id (text, PK — Better Auth managed)
├── name (text)
├── email (text, unique)
├── email_verified (boolean)
├── image (text, nullable — avatar URL)
├── role (enum: admin, specialist — "specialist" = TTB's "Labeling Specialist")
├── created_at (timestamp)
└── updated_at (timestamp)

sessions (managed by Better Auth)
├── id (text, PK — Better Auth managed)
├── user_id (text, FK → users)
├── token (text, unique — session token)
├── expires_at (timestamp)
├── ip_address (text, nullable)
├── user_agent (text, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

applicants
├── id (nanoid, PK)
├── company_name (text)
├── contact_email (text, nullable)
├── contact_name (text, nullable)
├── notes (text, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

batches
├── id (nanoid, PK)
├── specialist_id (text, FK → users — specialist who created the batch)
├── applicant_id (text, FK → applicants, nullable)
├── name (text, optional — user-provided batch name)
├── status (enum: processing, completed, failed)
├── total_labels (int)
├── processed_count (int)
├── approved_count (int)
├── conditionally_approved_count (int)
├── rejected_count (int)
├── needs_correction_count (int)
├── created_at (timestamp)
└── updated_at (timestamp)

labels
├── id (nanoid, PK)
├── specialist_id (text, FK → users — specialist who processed this label)
├── applicant_id (text, FK → applicants, nullable)
├── batch_id (text, FK → batches, nullable for single uploads)
├── prior_label_id (text, FK → labels, nullable — links to prior submission for resubmissions, mirrors Form 5100.31 Item 18d)
├── beverage_type (enum: distilled_spirits, wine, malt_beverage)
├── container_size_ml (int — container volume in mL, drives type-size requirements)
├── status (enum: pending, processing, approved, conditionally_approved, needs_correction, rejected)
├── overall_confidence (decimal, nullable)
├── correction_deadline (timestamp, nullable — set on needs_correction: +30 days, conditionally_approved: +7 days)
├── deadline_expired (boolean, default false — true when deadline passes without correction)
├── is_priority (boolean, default false — true for corrected resubmissions, sorts higher in queue)
├── created_at (timestamp)
└── updated_at (timestamp)

label_images
├── id (nanoid, PK)
├── label_id (text, FK → labels)
├── image_url (text — Vercel Blob URL)
├── image_filename (text)
├── image_type (enum: front, back, neck, strip, other — which part of the product)
├── sort_order (int — display ordering)
├── created_at (timestamp)
└── updated_at (timestamp)

application_data (mirrors Form 5100.31 fields)
├── id (nanoid, PK)
├── label_id (text, FK → labels, unique)
├── serial_number (text, nullable — Item 4: applicant-assigned, format YY-NNN)
├── brand_name (text, nullable — Item 6)
├── fanciful_name (text, nullable — Item 7: "Distinctive or Fanciful Name")
├── class_type (text, nullable — class/type designation text)
├── class_type_code (text, nullable — Item 5: numeric TTB code e.g. "101")
├── alcohol_content (text, nullable — Item 13)
├── net_contents (text, nullable — Item 12: "Total Bottle Capacity")
├── health_warning (text, nullable — the full "GOVERNMENT WARNING: ..." text)
├── name_and_address (text, nullable — Item 8: company name and address)
├── qualifying_phrase (text, nullable — e.g. "Bottled by", "Distilled by", "Imported by")
├── country_of_origin (text, nullable — for imports)
├── -- Wine-specific fields (Items 10, 14, 15) --
├── grape_varietal (text, nullable — Item 10)
├── appellation_of_origin (text, nullable — Item 14)
├── vintage_year (text, nullable — Item 15)
├── sulfite_declaration (boolean, nullable)
├── -- Spirits-specific fields --
├── age_statement (text, nullable)
├── state_of_distillation (text, nullable)
├── -- Shared optional --
├── fdc_yellow_5 (boolean, nullable)
├── cochineal_carmine (boolean, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

validation_results
├── id (nanoid, PK)
├── label_id (text, FK → labels) — NOT unique (multiple results per label for revalidation)
├── superseded_by (text, FK → validation_results, nullable — points to newer result if revalidated)
├── is_current (boolean, default true — only one current result per label)
├── ai_raw_response (jsonb — full AI response for audit)
├── processing_time_ms (int)
├── model_used (text — e.g., "gpt-5-mini + cloud-vision")
├── created_at (timestamp)
└── updated_at (timestamp)

validation_items
├── id (nanoid, PK)
├── validation_result_id (text, FK → validation_results)
├── label_image_id (text, FK → label_images, nullable — which image this field was extracted from)
├── field_name (enum: brand_name, fanciful_name, class_type, alcohol_content, net_contents, health_warning, name_and_address, qualifying_phrase, country_of_origin, grape_varietal, appellation_of_origin, vintage_year, sulfite_declaration, age_statement, state_of_distillation, standards_of_fill)
├── expected_value (text — from application_data)
├── extracted_value (text — what AI found on label)
├── status (enum: match, mismatch, not_found, needs_correction)
├── confidence (decimal)
├── match_reasoning (text — AI explanation of why match/mismatch)
├── bbox_x (decimal — normalized 0-1)
├── bbox_y (decimal)
├── bbox_width (decimal)
├── bbox_height (decimal)
├── created_at (timestamp)
└── updated_at (timestamp)

settings
├── id (nanoid, PK)
├── key (text, unique — e.g., "confidence_threshold", "field_strictness", "accepted_variants")
├── value (jsonb — flexible structure per setting type)
├── updated_at (timestamp)
└── created_at (timestamp)

accepted_variants
├── id (nanoid, PK)
├── field_name (enum: brand_name, fanciful_name, class_type, alcohol_content, net_contents, health_warning, name_and_address, qualifying_phrase, country_of_origin)
├── canonical_value (text — the "official" form)
├── variant_value (text — an accepted alternative)
├── created_at (timestamp)
└── updated_at (timestamp)

human_reviews
├── id (nanoid, PK)
├── specialist_id (text, FK → users — specialist who performed the review)
├── label_id (text, FK → labels)
├── validation_item_id (text, FK → validation_items, nullable — null for overall label review)
├── original_status (enum: match, mismatch, not_found, needs_correction — AI's determination)
├── resolved_status (enum: match, mismatch, not_found — human's final call)
├── reviewer_notes (text, nullable — human explanation of their decision)
├── reviewed_at (timestamp)
└── created_at (timestamp)
```

---

## Project Structure

```
# Root config files
├── eslint.config.mjs              # ESLint v10 flat config (next + typescript + prettier)
├── .prettierrc                    # Prettier config (tailwindStylesheet for v4)
├── vitest.config.mts              # Vitest config (jsdom, react plugin, tsconfig paths)
├── vitest.setup.ts                # Global test setup (next/* mocks, cleanup)
├── playwright.config.ts           # Playwright E2E config
├── knip.json                      # Unused code detection config
├── commitlint.config.mjs          # Conventional commit rules
├── .husky/
│   ├── pre-commit                 # lint-staged
│   └── commit-msg                 # commitlint
├── e2e/                           # Playwright E2E tests
│   ├── auth.spec.ts
│   ├── validate-label.spec.ts
│   ├── review-queue.spec.ts
│   ├── batch-upload.spec.ts
│   └── keyboard-shortcuts.spec.ts
├── scripts/
│   └── fetch-sample-images.ts     # Download TTB COLA registry images for seed data
├── .claude/
│   ├── plans/                     # Implementation plans + test workflows
│   └── skills/                    # Project-level Claude Code skills
│       ├── db-inspect/
│       │   └── SKILL.md           # Read-only database inspection via psql
│       ├── check-deployment/
│       │   └── SKILL.md           # Verify Vercel deployment health via Vercel MCP
│       └── test-page/
│           └── SKILL.md           # Test pages/flows via Playwright MCP
proxy.ts                               # Next.js 16 proxy (replaces middleware.ts) — auth checks, redirects, security headers
public/
├── favicon.ico                        # Favicon (32x32, government-themed shield/seal)
├── icon.svg                           # SVG app icon (used by Next.js metadata API)
├── apple-icon.png                     # Apple touch icon (180x180)
├── robots.txt                         # Disallow all crawlers (internal tool)
└── opengraph-image.png                # Default OG image for social sharing (optional)
src/
├── app/
│   ├── layout.tsx                    # Root layout (RSC) — providers, nav, theme, metadata export
│   ├── globals.css                   # Tailwind v4 + custom theme variables (@import "tailwindcss", @theme)
│   ├── global-error.tsx              # Root error boundary (catches unhandled errors)
│   ├── not-found.tsx                 # Global 404 page
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              # Login page (email/password)
│   ├── (app)/                        # Protected route group — requires session
│   │   ├── layout.tsx                # App shell layout (sidebar, header, auth check)
│   │   ├── loading.tsx               # Suspense fallback for protected routes (skeleton)
│   │   ├── error.tsx                 # Error boundary for protected routes
│   │   ├── not-found.tsx             # 404 for invalid IDs within the app
│   │   ├── page.tsx                  # Dashboard (RSC) — role-aware (admin sees team, specialist sees own)
│   │   ├── validate/
│   │   │   └── page.tsx              # Single label validation (RSC + client form)
│   │   ├── batch/
│   │   │   ├── page.tsx              # Batch upload page
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Batch detail/progress view
│   │   ├── history/
│   │   │   ├── page.tsx              # Validation history list (RSC, paginated)
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Detail view — annotated image + checklist
│   │   ├── review/
│   │   │   ├── page.tsx              # Review queue list (RSC, filterable)
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Review detail — annotated image + override controls
│   │   ├── applicants/
│   │   │   ├── page.tsx              # Applicant list (RSC, searchable)
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Applicant detail — all their labels + stats
│   │   ├── reports/
│   │   │   └── page.tsx              # Reports dashboard (RSC) — charts, stats
│   │   ├── admin/                    # Admin-only routes (role: admin)
│   │   │   └── page.tsx              # Admin dashboard — team overview, specialist table, flagged applicants
│   │   └── settings/
│   │       └── page.tsx              # Settings page (admin-only, RSC + client forms)
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...all]/
│   │   │       └── route.ts          # Better Auth catch-all API route
│   │   └── blob/
│   │       └── upload/
│   │           └── route.ts          # Vercel Blob client upload handler (token exchange for direct browser uploads)
│   └── actions/
│       ├── validate-label.ts         # Server action: upload + AI validation
│       ├── create-batch.ts           # Server action: batch upload creation
│       ├── process-batch-item.ts     # Server action: process single batch item
│       ├── submit-review.ts          # Server action: human review override + finalize
│       ├── revalidate-label.ts        # Server action: re-run AI on existing label
│       ├── manage-applicants.ts      # Server action: create/update applicants
│       ├── update-settings.ts        # Server action: save settings changes
│       ├── manage-variants.ts        # Server action: add/remove accepted variants
│       ├── submit-correction.ts      # Server action: create resubmission linked to prior label
│       ├── bulk-approve.ts           # Server action: approve all clean labels in a batch
│       └── delete-label.ts           # Server action: remove label + data
├── components/
│   ├── _base/                        # shadcn/ui base components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx (sonner)
│   │   ├── progress.tsx
│   │   ├── skeleton.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── scroll-area.tsx
│   │   ├── separator.tsx
│   │   ├── tooltip.tsx
│   │   └── sheet.tsx
│   ├── auth/
│   │   ├── login-form.tsx            # 'use client' — email/password form
│   │   └── user-menu.tsx             # 'use client' — avatar dropdown (name, role, sign out)
│   ├── layout/
│   │   ├── app-header.tsx            # Top nav with branding + user menu + nav links
│   │   ├── app-sidebar.tsx           # Side navigation (role-aware — admin sees extra links)
│   │   └── page-header.tsx           # Page title + breadcrumb
│   ├── validation/
│   │   ├── label-upload-form.tsx     # 'use client' — beverage type selector, multi-image dropzone, application fields
│   │   ├── validation-checklist.tsx  # Field-by-field pass/fail list
│   │   ├── annotated-image.tsx       # 'use client' — image with bbox overlays
│   │   ├── field-comparison.tsx      # Side-by-side: expected vs extracted
│   │   ├── validation-summary.tsx    # Overall pass/fail with confidence
│   │   └── health-warning-check.tsx    # Special strict check for "GOVERNMENT WARNING:" text
│   ├── batch/
│   │   ├── batch-upload-zone.tsx     # 'use client' — multi-file dropzone
│   │   ├── batch-progress.tsx        # 'use client' — real-time progress bar
│   │   ├── batch-results-table.tsx   # Results overview table
│   │   └── batch-item-row.tsx        # Individual item in batch table
│   ├── review/
│   │   ├── review-queue-table.tsx    # Queue list with filters + count badges
│   │   ├── review-field-control.tsx  # 'use client' — per-field override (match/mismatch/not found)
│   │   ├── review-notes-input.tsx    # 'use client' — reviewer notes textarea
│   │   └── review-complete-button.tsx # 'use client' — finalize all overrides
│   ├── communication/
│   │   ├── report-message.tsx        # Pre-formatted approval/rejection message block
│   │   ├── copy-report-button.tsx    # 'use client' — copy to clipboard with feedback
│   │   ├── send-report-button.tsx    # Disabled "Send Report" button with BETA badge
│   │   └── email-preview-dialog.tsx  # Disabled email preview (To/Subject/Body mockup)
│   ├── dashboard/
│   │   ├── stats-cards.tsx           # Key metric cards
│   │   ├── recent-validations.tsx    # Recent activity feed
│   │   └── status-chart.tsx          # 'use client' — pass/fail chart
│   ├── reports/
│   │   ├── validation-trends.tsx     # 'use client' — time series chart
│   │   ├── field-accuracy.tsx        # Per-field accuracy breakdown
│   │   └── processing-time-chart.tsx # Performance metrics
│   ├── applicants/
│   │   ├── applicant-search.tsx      # 'use client' — autocomplete/type-ahead for selecting applicant
│   │   ├── applicant-table.tsx       # Sortable applicant list
│   │   └── applicant-stats.tsx       # Per-applicant summary cards (approval rate, total, etc.)
│   ├── admin/
│   │   ├── specialist-summary-table.tsx    # Specialist name, labels processed, approval rate, pending reviews
│   │   └── flagged-applicants-table.tsx    # Top problematic applicants for admin oversight
│   ├── shared/
│   │   ├── field-comparison-row.tsx   # 'use client' — side-by-side form value vs AI extracted, with diff highlighting
│   │   ├── deadline-badge.tsx         # Countdown badge (green/amber/red) for correction deadlines
│   │   ├── priority-badge.tsx         # "Priority" indicator for corrected resubmissions
│   │   ├── quick-approve-card.tsx     # 'use client' — condensed approve view for clean labels
│   │   ├── keyboard-shortcut-bar.tsx  # 'use client' — fixed footer showing available shortcuts per page
│   │   └── resubmission-link.tsx      # Link to prior/subsequent submission in the chain
│   └── settings/
│       ├── confidence-threshold.tsx   # 'use client' — slider + input for threshold
│       ├── field-strictness.tsx       # 'use client' — per-field strict/moderate/lenient toggle
│       ├── variant-manager.tsx        # 'use client' — add/remove accepted variant pairs
│       └── warning-templates.tsx      # 'use client' — manage health warning statement text versions
├── db/
│   ├── index.ts                      # Drizzle client initialization
│   ├── schema.ts                     # Drizzle schema definitions
│   ├── seed.ts                       # Comprehensive seed script (yarn db:seed)
│   ├── seed-data/                    # Seed data definitions
│   │   ├── users.ts                  # Admin (Sarah) + 6 labeling specialists with passwords
│   │   ├── applicants.ts             # 25-30 sample companies
│   │   ├── labels.ts                 # ~1,000 labels — generators for pass/fail/review/edge cases
│   │   ├── batches.ts                # 12-15 sample batches (small to large)
│   │   ├── reviews.ts                # 80-100 human review records
│   │   └── settings.ts               # Default settings + accepted variants
│   └── migrations/                   # SQL migration files
├── lib/
│   ├── ai/
│   │   ├── ocr.ts                    # Stage 1: Google Cloud Vision OCR — word-level bounding polygons
│   │   ├── classify-fields.ts        # Stage 2: GPT-5 Mini field classification — text-only input
│   │   ├── extract-label.ts          # Orchestrator — runs OCR → classification → merges with bounding boxes
│   │   ├── compare-fields.ts         # Field matching logic (fuzzy + strict)
│   │   └── prompts.ts                # Classification prompts (beverage-type-aware)
│   ├── reports/
│   │   ├── generate-report.ts        # Build approval/rejection message from validation data
│   │   └── render-annotated-image.ts # Server-side: bake bbox overlays into static image for reports
│   ├── storage/
│   │   └── blob.ts                   # Vercel Blob upload/download helpers
│   ├── validators/
│   │   ├── label-schema.ts           # Zod schemas for application data
│   │   ├── file-schema.ts            # File upload validation (type, size, magic bytes)
│   │   └── batch-schema.ts           # Batch upload validation
│   ├── settings/
│   │   └── get-settings.ts           # Load current settings + variants from DB (cached per-request)
│   ├── auth/
│   │   ├── auth.ts                   # Better Auth server config (Drizzle adapter, roles, session)
│   │   ├── auth-client.ts            # Better Auth client instance
│   │   └── get-session.ts            # Helper: get current session in RSC/server actions (cached)
│   ├── labels/
│   │   └── effective-status.ts       # getEffectiveStatus() — lazy deadline expiration logic (computes true status from correction_deadline)
│   ├── security/
│   │   └── sanitize.ts               # Input sanitization utilities
│   └── utils.ts                      # cn() helper, formatters, etc.
├── hooks/
│   ├── use-batch-progress.ts         # Polling hook for batch status
│   ├── use-image-annotations.ts      # Annotation interaction state
│   └── use-keyboard-shortcuts.ts     # Keyboard shortcut registration + handler (context-aware)
├── stores/                            # Zustand stores
│   ├── annotation-store.ts           # Image viewer state (active field, zoom, pan)
│   ├── review-store.ts               # Review session state (overrides, current field)
│   ├── upload-store.ts               # Batch upload queue (files, progress, status)
│   └── shortcut-store.ts             # Active keyboard shortcut context per page
├── types/
│   └── index.ts                      # Shared TypeScript types (re-exports $inferSelect/$inferInsert from schema)
└── config/
    ├── constants.ts                  # App constants
    ├── beverage-types.ts             # Mandatory fields, valid sizes, type-size rules per product type
    ├── class-type-codes.ts           # TTB numeric class/type codes (0-999) with descriptions
    ├── qualifying-phrases.ts         # "Bottled by", "Distilled by", "Imported by", etc.
    └── health-warning.ts             # Exact required "GOVERNMENT WARNING:" text, formatting rules per container size
```

---

## Implementation Steps

### Phase 1: Project Scaffolding & Infrastructure (Steps 1-5) — MVP

**Step 1: Initialize Next.js 16 Project**
- `npx create-next-app@latest` with App Router, TypeScript, Tailwind CSS (Turbopack is now the default bundler in Next.js 16)
- Configure `next.config.ts`:
  - `poweredByHeader: false`
  - Strict security headers via `headers()` config
  - Image optimization config for label images
  - Note: `eslint` config option removed in Next.js 16 — linting is handled externally via ESLint CLI
- Configure `tsconfig.json` with path aliases (`@/*` → `src/*`)
- Set up `.env.local` template with all required env vars
- Add `.gitignore` entries
- Set up dev tooling (see Step 1b below)

**Step 1b: Developer Environment & Tooling**
- **ESLint** (v10 + flat config only):
  - Install: `eslint`, `eslint-config-next` (v16.x), `typescript-eslint` (v8+), `@eslint/js`, `eslint-config-prettier`
  - Create `eslint.config.mjs` (flat config — Next.js 16 removed `next lint`, use `eslint .` directly):
    ```js
    import { defineConfig, globalIgnores } from 'eslint/config'
    import js from '@eslint/js'
    import nextConfig from 'eslint-config-next/core-web-vitals'
    import tseslint from 'typescript-eslint'
    import prettierConfig from 'eslint-config-prettier/flat'
    ```
  - Add `eslint-config-prettier` **last** in config array to disable formatting conflicts
- **Prettier** (v3):
  - Install: `prettier`, `prettier-plugin-tailwindcss`
  - Create `.prettierrc`:
    ```json
    {
      "semi": false,
      "singleQuote": true,
      "trailingComma": "all",
      "plugins": ["prettier-plugin-tailwindcss"],
      "tailwindStylesheet": "./src/app/globals.css"
    }
    ```
  - Note: `tailwindStylesheet` is **required** for Tailwind CSS v4 (points to the CSS file with `@import "tailwindcss"`)
- **Knip** (v5.85+) — unused file/export/dependency detection:
  - Install: `knip`
  - Create `knip.json` with Next.js App Router entry points:
    ```json
    {
      "entry": ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/app/api/**/route.ts", "next.config.ts"],
      "project": ["src/**/*.{ts,tsx}"],
      "ignore": ["src/components/_base/**"]
    }
    ```
  - Run periodically: `npx knip` — reports unused exports, files, and dependencies
  - Known gotcha: may false-positive on `'use server'` exports; use `ignoreExportsUsedInFile` if needed
- **Husky + lint-staged + commitlint** (pre-commit hooks):
  - Install: `husky` (v10+), `lint-staged` (v15+), `@commitlint/cli`, `@commitlint/config-conventional`
  - `.husky/pre-commit`: runs `lint-staged`
  - `.husky/commit-msg`: runs `commitlint`
  - `lint-staged` config in `package.json`:
    ```json
    {
      "lint-staged": {
        "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
        "*.css": "prettier --write",
        "*.json": "prettier --write"
      }
    }
    ```
  - `commitlint.config.mjs`: extends `@commitlint/config-conventional` (feat/fix/docs/style/refactor/perf/test/ci/chore)
- **tsx** (v4.21+) — TypeScript script runner for seed scripts, migrations, utilities:
  - Install: `tsx`
  - Usage: `npx tsx src/db/seed.ts`, `npx tsx scripts/fetch-sample-images.ts`
  - No configuration needed — handles `.ts` files natively
- **Vitest** (see Testing Strategy section for full setup):
  - Install: `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `jsdom`, `@testing-library/react`, `@testing-library/dom`
  - Scripts: `"test": "vitest"`, `"test:coverage": "vitest run --coverage"`
- **Playwright** (for E2E tests):
  - Install: `@playwright/test`
  - Scripts: `"test:e2e": "playwright test"`
- **package.json scripts:**
  ```json
  {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "knip": "knip",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/db/seed.ts",
    "db:studio": "drizzle-kit studio"
  }
  ```

**Step 2: Database Setup (Drizzle + Neon)**
- Install: `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`, `nanoid`
- Define schema in `src/db/schema.ts` (all tables from schema above):
  - All PKs use `text('id').primaryKey().$defaultFn(() => nanoid())` — nano IDs generated in app code
  - Exception: `users` and `sessions` tables use Better Auth's ID format (configured in auth adapter)
  - Export `$inferSelect` / `$inferInsert` types for each table:
    ```ts
    export type Label = typeof labels.$inferSelect
    export type NewLabel = typeof labels.$inferInsert
    ```
  - Generate Zod schemas from tables using `drizzle-orm/zod`:
    ```ts
    import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
    export const insertLabelSchema = createInsertSchema(labels, {
      brandName: (s) => s.min(1).max(200),
    })
    ```
    These are used directly in server actions for input validation — single source of truth from schema.ts → types → validation.
- Configure `drizzle.config.ts` for Neon connection
- **Migration workflow:**
  - During development: use `drizzle-kit push` for fast iteration (schema → DB, no migration files)
  - Before production: switch to `drizzle-kit generate` → review SQL → `drizzle-kit migrate`
  - Migration files stored in `src/db/migrations/` and committed to git
  - Applied in order, tracked in `__drizzle_migrations` table
  - Forward-only: rollbacks via new forward migrations (no built-in down)
  - Custom migrations: `drizzle-kit generate --custom` for data migrations
- Create Neon project on Vercel (linked to the Vercel project)
- Set up db client in `src/db/index.ts` with connection pooling

**Step 3: Vercel Blob Storage Setup**
- Install `@vercel/blob`
- Create upload helper in `src/lib/storage/blob.ts` (server-side: signed URL generation, deletion)
- Create client upload route at `src/app/api/blob/upload/route.ts` — handles `@vercel/blob/client` token exchange:
  - `onBeforeGenerateToken`: authenticate user session, validate allowed content types (image/jpeg, image/png, image/webp)
  - `onUploadCompleted`: webhook callback after upload finishes — can persist metadata
- Configure max file size (10MB), allowed MIME types
- Client-side uploads use `upload()` from `@vercel/blob/client` with `multipart: true` for large files and `onUploadProgress` for progress tracking

**Step 4: UI Foundation**
- Install shadcn/ui CLI and initialize with `new-york` style
- Install base components: button, card, badge, dialog, input, label, select, table, tabs, toast (sonner), progress, skeleton, dropdown-menu, scroll-area, separator, tooltip, sheet, **chart** (shadcn/ui Charts — Recharts v3 composition layer with Tailwind theming + dark mode)
- Install `motion` (framer-motion), `next-themes`, `@vercel/analytics`, `nuqs`, `react-hook-form`, `@hookform/resolvers`, `react-dropzone`, `diff`
- **React Hook Form setup:** used for all multi-field forms (validation form, settings forms, applicant forms). `zodResolver` for client-side Zod validation. Integration with server actions: `handleSubmit` validates client-side, then calls server action in `onValid` callback. Server re-validates with Zod independently (never trust client).
- **react-dropzone v15** for file upload zones — handles drag events, keyboard a11y, ARIA roles, file type filtering. React 19 compatible.
- **`diff` (jsdiff) v8** for character-level diffing in field comparisons — `diffChars()` renders inline green/red spans
- **next-themes setup:** `ThemeProvider` in root layout with `attribute="class"`, `defaultTheme="system"`, `enableSystem`. Add `suppressHydrationWarning` to `<html>`. Works with Tailwind CSS v4's `@variant dark` for dark mode classes.
- **Vercel Analytics setup:** `<Analytics />` component in root layout — enables page view tracking automatically. Custom events via `track()` for key actions (label validated, review completed, etc.)
- **nuqs setup:** configure URL search param parsers for table filters, pagination, sort — used across history, review queue, applicants pages
- Create government compliance theme in `globals.css`:
  - Navy/gold/slate color palette via CSS custom properties (light + dark mode variants)
  - Typography: Source Serif 4 for headings (`--font-heading`), Inter for body (`--font-body`), JetBrains Mono for codes (`--font-mono`). All via `next/font/google` with CSS variables + Tailwind `font-heading`/`font-body`/`font-mono` utilities.
  - Custom component variants for status badges (approved/rejected/review)
- Build layout components: `app-header`, `app-sidebar`, `page-header`
- Create root `layout.tsx` with navigation structure, ThemeProvider, Analytics

**Step 5: Authentication (Better Auth)**
- Install `better-auth` and configure with Drizzle adapter
- Create `src/lib/auth/auth.ts` — server-side Better Auth config:
  - Drizzle adapter pointing to `users` and `sessions` tables
  - Email/password auth plugin
  - Session config: 30-day expiry, 1-day refresh (matching stockbridge)
  - Rate limiting: 3 login attempts per minute per email
  - Custom user fields: `role` (admin | specialist)
- Create `src/lib/auth/auth-client.ts` — client-side auth instance
- Create `src/lib/auth/get-session.ts` — cached helper for RSC/server actions (`cache()` wrapper)
- Set up `src/app/api/auth/[...all]/route.ts` — Better Auth catch-all route handler
- Create login page at `src/app/(auth)/login/page.tsx`:
  - Government-themed login form (navy background, gold accents, official seal)
  - Email + password fields, submit button, error states
- Create `(app)/layout.tsx` — protected layout that checks session, redirects to `/login` if unauthenticated
- `proxy.ts` — redirect unauthenticated requests to `/login`, block specialist-role users from `/admin/*` and `/settings` (Next.js 16 replaces `middleware.ts` with `proxy.ts`, runs on Node.js runtime)
- User menu component in header: avatar/initials, name, role badge, sign out button
- Sidebar is **role-aware**: admin sees "Admin Dashboard", "Settings" links; specialists don't
- Every server action: first line calls `getSession()` and rejects if no session or wrong role

### Phase 2: Core AI Pipeline (Steps 6-8) — MVP

**Step 6: AI Pipeline — Hybrid OCR + Classification**
- Install `@google-cloud/vision` (Google Cloud Vision API), `ai` (Vercel AI SDK v6), and `@ai-sdk/openai` (OpenAI provider)
- **Stage 1: OCR with Google Cloud Vision**
- Create `src/lib/ai/ocr.ts`:
  - Accept image URL (Vercel Blob signed URL)
  - Call `TEXT_DETECTION` via `@google-cloud/vision` `ImageAnnotatorClient`
  - Return structured OCR result: `{ words: Array<{ text, boundingPoly: { vertices: [{x,y}] }, confidence }>, fullText: string }`
  - Each word has pixel-accurate bounding polygon (4 vertices)
  - For multi-image labels, run OCR on each image in parallel (`Promise.all`)
    ```ts
    import vision from '@google-cloud/vision'
    const client = new vision.ImageAnnotatorClient()
    const [result] = await client.textDetection(imageUrl)
    const words = result.textAnnotations?.slice(1).map(a => ({
      text: a.description,
      boundingPoly: a.boundingPoly,
      confidence: a.confidence ?? 1.0,
    })) ?? []
    ```
- **Stage 2: Field Classification with GPT-5 Mini**
- Create `src/lib/ai/classify-fields.ts`:
  - Accept OCR text output (no image — text-only input, much cheaper)
  - Use `generateText` + `Output.object()` with `openai('gpt-5-mini')`:
    ```ts
    import { generateText, Output } from 'ai'
    import { openai } from '@ai-sdk/openai'
    const { object, usage } = await generateText({
      model: openai('gpt-5-mini'),
      output: Output.object({ schema: fieldClassificationSchema }),
      messages: [{
        role: 'user',
        content: buildClassificationPrompt(ocrResult, beverageType),
      }],
    })
    ```
  - Classifies OCR text blocks into TTB fields (brand name, alcohol content, health warning, etc.)
  - Each classified field references the OCR word indices → inherits bounding box coordinates
  - Zod schema for structured output — all optional properties must use `.nullable()` not `.optional()` (OpenAI structured output limitation)
- Create `src/lib/ai/prompts.ts`:
  - Classification prompt: given OCR text with word positions, identify which words belong to which TTB field
  - Beverage-type-aware — tells the model which fields to expect based on product type
  - Request confidence scores per field
- Keep `src/lib/ai/extract-label.ts` as the **orchestrator** — calls OCR, then classification, merges results with bounding boxes
- Log usage for cost tracking (Cloud Vision API calls + GPT-5 Mini token usage)
- Handle error cases: unclear image, no text found, partial extraction, Cloud Vision API failures

**Step 7: Field Comparison Engine**
- Create `src/lib/ai/compare-fields.ts`:
  - **Exact match** for health warning statement (case-sensitive, whitespace-normalized)
  - **Fuzzy match** for brand name (case-insensitive, handle "STONE'S THROW" vs "Stone's Throw")
  - **Fuzzy match** for fanciful name (case-insensitive)
  - **Normalized match** for alcohol content (parse "45% Alc./Vol. (90 Proof)" ↔ "45%")
  - **Normalized match** for net contents ("750 mL" ↔ "750ml")
  - **Fuzzy match** for class/type designation, name and address
  - **Enum match** for qualifying phrase ("Bottled by" ↔ "BOTTLED BY" etc.)
  - **Contains match** for country of origin
  - Each comparison returns: `status`, `confidence`, `reasoning`
- Special health warning statement validator:
  - Check "GOVERNMENT WARNING:" is all caps and bold
  - Check full text matches exactly (word-for-word, punctuation-for-punctuation)
  - Flag common evasion patterns (title case "Government Warning", missing bold on header, truncated text, extra/missing spaces, missing numbered sections)
  - Verify text after "GOVERNMENT WARNING:" is NOT bold (common error)

**Step 8: Validation Pipeline Server Action**
- Create `src/app/actions/validate-label.ts`:
  1. Validate file input (Zod + magic bytes check)
  2. Upload image to Vercel Blob
  3. Create `labels` + `application_data` records in DB
  4. Run hybrid AI pipeline: Cloud Vision OCR (Stage 1) → GPT-5 Mini classification (Stage 2)
  5. Run field comparisons (extracted fields vs application data)
  6. Store `validation_results` + `validation_items` with pixel-accurate bounding boxes from OCR
  7. Determine label status using TTB status logic:
     - All fields match → `approved`
     - Minor data-field discrepancies only (brand name, fanciful name, appellation, grape varietal) → `conditionally_approved`
     - Any substantive mismatch or missing mandatory field → `needs_correction`
     - Fundamental issues (missing health warning, illegal container size, no permit) → `rejected`
  8. Return result with redirect to detail page
- Target total time: < 5 seconds

### Phase 3: Core UI Pages (Steps 9-12) — MVP

**Step 9: Single Label Validation Page (`/validate`)**
- **Server component** page wrapper
- **Client component** form managed by **React Hook Form** + `zodResolver` (client-side validation, dirty tracking, conditional field visibility). Server action re-validates with Zod independently.
- Form fields:
  - **Type of Product selector** (Distilled Spirits / Wine / Malt Beverages — mirrors Form 5100.31 Item 5) — drives which fields are shown and required
  - **Class/Type Code** — searchable dropdown populated from TTB's numeric code list (e.g., type "bourbon" → "101 - Straight Bourbon Whisky")
  - **Total Bottle Capacity** input (mL) — drives health warning type-size requirements
  - **Multi-image upload zone** (with preview) — labeled slots: Brand Label (front), Back Label, Neck/Strip Label (optional), Other (optional). Each image tagged with its type.
  - **Application data fields** (mirrors Form 5100.31) — dynamically shown based on type of product:
    - Common: Serial Number (Item 4), Brand Name (Item 6), Fanciful Name (Item 7), Class/Type Designation, Alcohol Content (Item 13), Net Contents (Item 12), Health Warning Statement, Name and Address (Item 8) + Qualifying Phrase dropdown ("Bottled by", "Distilled by", "Imported by", etc.), Country of Origin
    - Wine: Grape Varietal (Item 10), Appellation of Origin (Item 14), Vintage Date (Item 15), Sulfite Declaration
    - Spirits: Age Statement (if applicable), State of Distillation
  - Pre-filled health warning template (exact "GOVERNMENT WARNING:" text from 27 CFR Part 16) with edit capability
  - **Standards of fill indicator** — after entering net contents, shows whether the size is valid for the selected product type (green check / red warning / "Any size permitted" for malt beverages)
  - **Prior Submission** field (optional) — links this to a previous label for resubmission tracking (mirrors Form 5100.31 Item 18d). Searchable by label name or ID. When set, pre-fills form from the prior submission's data.
  - "Validate" button with loading state (Motion spinner)
- On submit: call server action, show progress, redirect to results (Quick Approve view if all fields match, full detail otherwise)
- Motion: form field entrance animations, upload zone pulse animation

**Step 10: Validation Detail Page (`/history/[id]`)**
- **Server component** — loads all data in RSC
- **Quick Approve path:** If ALL fields match with high confidence (above threshold), show the **Quick Approve view** first:
  - Condensed summary card: "All N fields match with high confidence (avg XX%)"
  - Thumbnail of the label with all bboxes in green
  - Single **"Approve" button** (prominent, green) — one click to approve and auto-navigate to next label
  - "View Full Details" link to expand into the standard comparison layout
- **Full Detail layout** (default for non-clean labels, or expanded from Quick Approve):
  - **Resubmission context** (if `prior_label_id` is set):
    - "Resubmission of [prior label]" header with link
    - Diff summary: which fields changed between original and resubmission
  - **Deadline badge** (if status is `needs_correction` or `conditionally_approved`):
    - Countdown showing days/hours remaining (green > 7 days, amber 1-7 days, red < 24h)
  - **Left panel:** Annotated image viewer (client component)
    - **Tabbed view** when multiple images exist (Front / Back / Neck) — each tab shows that image with its own bbox overlays
    - Color-coded regions (green/red/yellow)
    - Hover/click to highlight individual fields — clicking a field in the comparison auto-switches to the correct image tab
    - Zoom capability for detail inspection
  - **Right panel:** Side-by-side field comparison (replaces simple checklist)
    - Each field row shows two columns:
      - **Left column:** "Application (Form 5100.31)" — the expected value
      - **Right column:** "Label (AI Extracted)" — what the AI found
      - **Diff highlighting:** inline character-level diffing (green = matching, red = different)
    - Each row also shows: status badge, confidence score, expandable AI reasoning
    - Click either column → highlights corresponding bbox on image
    - Health warning statement gets special expanded treatment (exact "GOVERNMENT WARNING:" text comparison, bold/caps verification)
    - **Compact mode** toggle for experienced specialists who want to see all fields at once
- **Keyboard shortcuts** (active on this page):
  - `A` = Approve, `R` = Reject, `C` = Needs Correction, `N` = Next label, `P` = Previous
  - `J/K` = Navigate between fields, `E` = Expand/collapse reasoning, `?` = Show shortcuts
  - Shortcut bar shown in subtle fixed footer
- Top summary: TTB status badge (Approved / Conditionally Approved / Needs Correction / Rejected), confidence score, processing time, model used
- **Communication report section** (below the comparison):
  - Auto-generated message based on validation outcome (fixed templates per status, no customization):
    - **Approved:** Approval notice — "Your label application for [Brand Name] has been verified and meets all requirements..."
    - **Conditionally Approved:** Conditional notice — lists the minor field discrepancies (brand name, fanciful name, appellation, grape varietal) with proposed corrections. References TTB's 7-day accept/decline window.
    - **Needs Correction:** Correction notice — lists each mismatched or missing field with "Expected: X, Found: Y" and specific remediation guidance. References TTB's 30-day correction window and that corrected resubmissions get priority processing.
    - **Rejected:** Final rejection notice with full breakdown of non-compliant fields, citing applicable regulatory provisions (27 CFR Part 4/5/7/16)
    - **Reviewed by specialist:** Includes specialist review notes and override reasoning in the report
  - **"Copy to Clipboard" button** — copies the plain-text message, shows checkmark feedback via Motion
  - **Format toggle:** plain text / formatted (rich text with bold headings, bullet points)
  - **Annotated image embed** — the report includes the label image with bounding box overlays baked in, so the recipient sees exactly which fields were flagged and where
    - Server-side: render annotated image to a static PNG/JPEG using canvas (or sharp + SVG overlay) so it's a single self-contained image in the report
    - Color-coded boxes with field labels visible directly on the image (no interactivity needed — it's a static snapshot)
    - For the copyable text version: includes a link to the hosted annotated image (Vercel Blob signed URL)
  - **"Send Report" button** — styled but **disabled**, with a `BETA` badge and tooltip: "Email delivery coming in a future release"
    - Clicking shows a preview dialog with To/Subject/Body fields (all read-only, pre-filled) and the annotated image attached, to demonstrate the intended UX
- Motion: panel transitions, field comparison reveals, highlight animations

**Step 11: History Page (`/history`)**
- **Server component** with pagination
- Sortable/filterable table of all validations
- Columns: image thumbnail, label name, status badge, confidence, deadline countdown (if applicable), priority badge (if resubmission), date, batch (if any)
- Filter by: status (all/approved/conditionally approved/needs correction/rejected), date range, applicant
- Labels with "Quick approve available" (all fields match, high confidence) get a subtle indicator so specialists can batch through them
- Click row → navigate to detail page
- **Keyboard shortcuts:** `J/K` to navigate rows, `Enter` to open detail
- Motion: table row entrance stagger animation

**Step 12: Dashboard Page (`/` — home, role-aware)**
- **Server component** with stats queries scoped by role
- **Specialist view:**
  - Stats cards: my validations today/week, my approval rate, my avg processing time, my pending reviews
  - **"Expiring Soon" widget:** labels with correction deadlines approaching in the next 7 days (countdown badges, sorted by urgency)
  - **"Quick Approve Ready" count:** number of clean labels awaiting one-click approval
  - My recent validations feed (last 10)
  - Quick action buttons: "Validate New Label", "Upload Batch", "Review Queue (N pending)"
- **Admin view (Sarah):**
  - Team-wide stats cards: total validations today/week, team approval rate, avg processing time, total pending reviews
  - **"Expiring Soon" widget** (team-wide): all labels approaching deadline, so Sarah can reassign if a specialist is behind
  - Specialist activity summary: who's online, who processed the most today
  - Quick links: "Admin Dashboard", "View Reports", "Review Queue (N pending)"
  - Top flagged applicants this week (mini risk overview)
- Motion: card entrance animations, counter animations

### Phase 4: Human Review Queue (Steps 13-15) — Stretch

**Step 13: Review Queue Page (`/review`)**
- **Server component** — queries all labels with `status = 'needs_correction'`
- Table columns: image thumbnail, label name/filename, flagged field count, confidence, deadline countdown, priority badge, date submitted, batch (if any)
- **Filters:**
  - By flagged field type (e.g., "health warning" — shows only labels where that specific field needs review)
  - By date range
  - By batch
  - By priority (resubmissions first)
- **Sort order:** Priority resubmissions first, then oldest-first (FIFO) by default, with option to sort by confidence (lowest first = hardest cases) or deadline (most urgent first)
- **Queue depth badge** in sidebar navigation — always visible count of pending reviews
- **Keyboard shortcuts:** `J/K` to navigate rows, `Enter` to open review detail, `N` to go to next
- Click row → navigate to review detail page
- Motion: badge pulse animation when queue has items

**Step 14: Review Detail Page (`/review/[id]`)**
- Same annotated-image + side-by-side comparison layout as `/history/[id]`, but with **interactive override controls**
- **Resubmission context** (if applicable): shows what was wrong in the prior submission and what changed
- **Deadline badge** showing remaining correction window time
- Only fields with `needs_correction` status are actionable; matched/mismatched fields are shown read-only for context
- Per flagged field, the specialist sees:
  - **Side-by-side comparison** with diff highlighting (same as history detail)
  - The AI's confidence score and reasoning
  - The annotated region highlighted on the image
  - **Override buttons:** "Confirm Match" / "Mark Mismatch" / "Mark Not Found"
  - **Notes textarea:** optional free-text explanation of the decision (TTB calls these "reasons for correction/denial")
- **Keyboard shortcuts** (active on this page):
  - `J/K` = Navigate between flagged fields
  - `1` = Confirm Match, `2` = Mark Mismatch, `3` = Mark Not Found (for current field)
  - `Enter` = Confirm override and move to next field
  - `A` = Approve (when all fields resolved), `N` = Next label in queue
  - Shortcut bar in fixed footer
- **"Complete Review" button** — enabled only when all flagged fields have been resolved
  - Server action: creates `human_reviews` records for each overridden field
  - Updates `validation_items` statuses to the specialist's determination
  - Updates overall `label` status based on final field statuses (all match → approved, minor discrepancies only → conditionally_approved, any substantive mismatch → needs_correction, fundamental issues → rejected)
  - Redirects back to the review queue (auto-opens next item via `N` shortcut)
- Motion: smooth transitions between fields, success animation on complete

**Step 15: Review Audit Trail**
- Every human override is persisted in `human_reviews` table with:
  - What the AI originally said (`original_status`)
  - What the human decided (`resolved_status`)
  - Why (`reviewer_notes`)
  - When (`reviewed_at`)
- Visible on the history detail page (`/history/[id]`) — shows "Reviewed by specialist" indicator with expandable details
- Reports page includes review metrics:
  - Queue depth over time
  - Average time from submission to human review
  - Human override rate (how often humans disagree with AI)
  - Per-field override frequency (which fields does the AI struggle with most)

### Phase 5: Batch Processing (Steps 16-17) — Stretch

**Step 16: Batch Upload Page (`/batch`)**
- **Client component** multi-file dropzone via `react-dropzone` (accepts 300+ files)
- Two-step flow:
  1. Upload files + enter shared application data (or per-label data via CSV)
  2. Review & confirm → starts processing
- File validation client-side before upload (type, size)
- **Client-side direct upload to Vercel Blob** via `@vercel/blob/client` `upload()`:
  - Server issues short-lived upload tokens via `/api/blob/upload` route (auth check + MIME validation in `onBeforeGenerateToken`)
  - Browser uploads directly to Blob CDN — bypasses 4.5MB server action body limit
  - Per-file progress tracking via `onUploadProgress` callback
  - Use `p-limit` for concurrency control: max 5 parallel uploads to avoid overwhelming the browser/network
- Server action: creates batch record, creates label records with Blob URLs
- Redirect to batch detail page

**Step 17: Batch Detail Page (`/batch/[id]`)**
- **Server component** initial load + **client component** polling for updates
- Overall progress bar with count (e.g., "Processing 45 of 200 labels...")
- Results table that populates as items complete
- Per-item status: pending → processing → approved/conditionally approved/needs correction/rejected
- Summary stats update in real-time: approved count, rejected count, avg confidence
- **"Bulk Approve Clean" button** — approves all labels where every field matches at high confidence. Confirmation dialog: "Approve 147 of 200 labels? All fields match with >90% confidence." One click for the easy ones, then specialists focus on the flagged items.
- "Export Results" button (CSV download)
- Motion: progress bar animation, table rows appearing as they complete

### Phase 6: Applicants, Revalidation & Sample Data (Steps 18-21) — Stretch

**Step 18: Applicant Pages (Simplified)**
- **`/applicants` list page** (RSC) — searchable/sortable table with company name, total labels, approval rate, risk badge (<70% red, 70-90% amber, >90% green), last submission date
- **`/applicants/[id]` detail page** (RSC):
  - Compliance reputation card at top: approval rate, total submissions, last submission date, most common rejection reason — simple stats, no trend analysis
  - Risk badge (same threshold logic as list page)
  - Full label history for this applicant (table, filterable by status)
  - Resubmission chains visible: shows the lifecycle of corrected labels (Original → Needs Correction → Resubmission → Approved)
- **Applicant selector** on validation form and batch upload: autocomplete type-ahead, "Add New" option
- Server actions: `manage-applicants.ts` for create/update

**Step 19: Revalidation & Resubmission Flow**
- **Revalidation** (same label, fresh AI pass):
  - "Revalidate" button on `/history/[id]` and `/review/[id]` — `RefreshCw` icon + text
  - Confirmation dialog explaining previous results are preserved
  - Optional: upload replacement image before revalidation
  - Server action `revalidate-label.ts`: marks old `validation_results` as superseded, runs fresh AI pass with current settings
  - Batch revalidation on `/batch/[id]`: "Revalidate Rejected" button re-processes only rejected/needs_correction labels
- **Resubmission** (new label linked to prior):
  - "Submit Correction" button on rejected/needs_correction labels — creates a new label record with `prior_label_id` pointing to the original
  - The new submission form pre-fills application data from the original, so the specialist only needs to update the changed fields
  - New image can be uploaded (applicant sent corrected label artwork)
  - Resubmission gets `is_priority = true` → sorts above new submissions in the queue (mirrors TTB's priority processing for corrected applications)
  - Validation detail page shows the diff: what changed between original and resubmission

**Step 20: Sample Data Generation (~1,000 Labels)**
- Create `src/db/seed.ts` — comprehensive seed script runnable via `yarn db:seed`
- Create `scripts/fetch-sample-images.ts` — standalone script to download real label images from TTB sources
- **Image Sourcing Strategy:**
  - **Primary: TTB COLA Public Registry** — download 100-150 real approved label images from the public COLA database at ttb.gov (these are public records, freely available)
  - **Secondary: COLA Cloud API** (colacloud.us) — 500 free requests/month, REST API with real COLA data including label images, brand names, class/types, and approval details. Use to get structured data alongside images.
  - **Supplementary: AI-generated labels** — generate 15-20 edge case images using DALL-E for scenarios not well-represented in real data (deliberately bad angles, glare, blurry shots, creative warning text formatting)
  - **Image reuse strategy:** 100-150 unique images are reused across ~1,000 label records (realistic — the same product image gets submitted multiple times with different application data variations, or multiple products share similar label layouts). Each image maps to multiple validation scenarios.
  - Store downloaded images in `scripts/sample-images/` locally, upload to Vercel Blob during seed
- **Users** (7 total):
  - **Admin:** Sarah Chen (sarah.chen@ttb.gov, password: `admin123`) — Deputy Director, sees everything
  - **Labeling Specialists:**
    - Dave Morrison (dave.morrison@ttb.gov, `specialist123`) — senior labeling specialist, 28 years, processes fewer labels but very thorough, high accuracy, slow speed
    - Jenny Park (jenny.park@ttb.gov, `specialist123`) — junior labeling specialist, 8 months, fast processor, high volume, slightly lower accuracy
    - Marcus Williams (marcus.williams@ttb.gov, `specialist123`) — labeling specialist, IT background, moderate speed, moderate volume
    - Janet Torres (janet.torres@ttb.gov, `specialist123`) — labeling specialist, Seattle office, handles a lot of import batches
    - Robert Kim (robert.kim@ttb.gov, `specialist123`) — labeling specialist, mid-career, steady performer, average across all metrics
    - Lisa Chen (lisa.chen@ttb.gov, `specialist123`) — labeling specialist, part-time, lower volume but solid accuracy
  - Each specialist's validation data reflects their personality: Dave has fewer labels but almost no overrides, Jenny has high volume with occasional misses, Janet processes the most batches, etc.
- **Applicants** (25-30 companies):
  - **Large importers** (5-6): "Pacific Rim Imports LLC", "European Spirits Group", "Atlantic Wine Merchants", etc. — high volume (80-120 labels each), moderate fail rate
  - **Major domestic producers** (5-6): "Old Tom Distillery", "Mountain Creek Brewing Co.", "Napa Valley Estate Wines", etc. — steady volume (40-80 labels each), generally good compliance
  - **Mid-size operators** (8-10): regional breweries, boutique distillers, wine importers — 20-40 labels each, mixed compliance
  - **Small/new operators** (6-8): "Smith Family Wines", "First Batch Spirits", etc. — 5-15 labels each, higher error rates (learning curve)
  - Varying compliance reputations: 3-4 near-perfect (>95% approval), 4-5 frequent offenders (<70% approval), rest in the middle
  - Real-world-inspired company names sourced from COLA Cloud data where possible
- **Labels** (~1,000 total across all applicants — represents ~1.5 days of real TTB team throughput):
  - **Beverage type distribution** (reflecting real TTB submission mix):
    - Distilled spirits (~35%): bourbon, vodka, gin, tequila, rum, scotch, brandy, liqueur, sake
    - Wine (~40%): red, white, rosé, sparkling, dessert wine, fortified
    - Malt beverages (~25%): craft beer, import lager, domestic, hard seltzer, malt liquor
  - **Pass scenarios** (~40%, ~400 labels): all fields match cleanly — represents well-prepared applicants
  - **Fail scenarios** (~30%, ~300 labels): deliberate mismatches covering every field type:
    - Wrong ABV on label vs application (e.g., "40%" vs "45%")
    - Brand name case/spelling variations ("STONE'S THROW" vs "Stone's Throw" vs "Stones Throw")
    - Health warning statement issues (the #1 real rejection reason): title case instead of all caps, truncated text, missing "GOVERNMENT WARNING:" prefix, creative reformatting, wrong punctuation, missing bold on header, bold applied to body text
    - Missing net contents, wrong unit format, non-standard container sizes (e.g., 600mL bourbon = illegal)
    - Producer address discrepancies
    - Country of origin mismatch ("Product of Scotland" vs "United Kingdom")
    - Wine-specific: missing sulfite declaration, incorrect appellation
    - Spirits-specific: missing age statement, wrong state of distillation
    - Standards of fill violations: container sizes not in the legal list for that beverage type
  - **Needs review scenarios** (~20%, ~200 labels): ambiguous cases that route to human queue:
    - Close-but-not-exact brand name matches
    - Partial health warning (most words correct, one word different)
    - Low-quality "image" scenarios (simulated low confidence)
    - Unusual formatting that's technically correct but looks wrong
    - Borderline confidence scores (right around the 80% threshold)
  - **Edge cases** (~10%, ~100 labels):
    - Very long brand names
    - Special characters, accents, non-ASCII (e.g., "Château Lafite", "Señor Tequila", "Jägermeister")
    - Multiple products from same producer with slight variations
    - Labels with missing optional fields (no country of origin for domestic)
    - Revalidation history — some labels with 2-3 validation results showing progression
    - Multi-image labels (front + back + neck) — ~50 labels have 2-3 images each
  - **Mismatch generation strategy:** Take real COLA data from the registry (brand name, class/type, ABV, etc.) and intentionally alter the application_data fields to create realistic mismatches. This way the label images are real but the "submitted" application data has deliberate errors.
- **Batches** (12-15):
  - 2 large batches (100-150 labels from single importers) to test batch UI at scale
  - 1 batch mid-processing (some completed, some pending) to test progress states
  - 3-4 medium batches (20-50 labels) with mixed results
  - 5-6 small batches (5-15 labels) for quick testing
  - Each batch tied to an applicant, reflecting how real importers submit in bulk
- **Human reviews** (80-100):
  - Mix of confirmed and overridden AI decisions
  - Include reviewer notes showing realistic specialist reasoning
  - Distributed across specialists (Dave does the most thorough reviews with long notes, Jenny is quick with brief notes)
  - Some reviews change the outcome (AI said mismatch → human says match, and vice versa)
- **Validation history:**
  - Data spread across the last 90 days for realistic reports/charts
  - Varying processing times (1.5s - 8s) to test performance metrics
  - Some labels with revalidation chains (original → superseded → current) — ~30 labels have been revalidated at least once
  - Weekly volume varies (lower on weekends, spikes on Mondays matching real TTB patterns)
  - Specialist assignment reflects realistic workloads: Jenny processes 2-3x Dave's volume
- **Pre-computed validation results:**
  - Validation results are **pre-generated in the seed script**, not computed by running actual AI calls
  - Each label gets a `validation_results` record with realistic `processing_time_ms`, `model_used`, and `ai_raw_response` (fabricated but structurally correct JSON)
  - Each validation result gets `validation_items` with realistic bounding boxes, confidence scores, extracted values, and match reasoning
  - This means `yarn db:seed` runs fast (no AI API calls) and works without API keys
- **Default settings:** seed with sensible defaults (80% confidence threshold, standard strictness levels, common accepted variants pre-loaded, health warning template from 27 CFR Part 16)

**Step 21: Admin Dashboard (`/admin`) — Admin Only (Lightweight)**
- **Server component** — checks role, redirects specialists to home
- **Single page** with key stats Sarah would care about — no deep drill-down pages:
  - **Specialist summary table:** specialist name, labels processed (today/all-time), approval rate, pending reviews — sortable, one glance
  - **Team stats cards:** total labels today/week, team approval rate, review queue depth
  - **Top flagged applicants:** small table of the 5 highest-fail-rate applicants
- No `/admin/specialists/[id]` detail pages — keep it to one overview page for the prototype
- Motion: card entrances

### Phase 7: Reports, Agent Tools & Polish (Steps 22-25) — Stretch

**Step 22: Reports Page (`/reports`)**
- **Server component** with aggregation queries
- Charts (using Recharts or simple SVG):
  - Validations over time (bar chart, daily/weekly)
  - Approval/rejection rate trend (line chart)
  - Per-field accuracy breakdown (horizontal bar chart)
  - Average processing time trend
  - Top rejection reasons
  - **Human review metrics:** queue depth over time, override rate, avg review turnaround time
  - **AI vs Human agreement rate** — per-field breakdown of how often humans confirm vs override
- Date range filter
- Motion: chart entrance animations

**Step 23: Security Hardening**
- `proxy.ts` (already created in Step 5 for auth) — add:
  - Security headers (CSP, HSTS, X-Frame-Options, etc.)
  - Verify auth + role checks are airtight on all protected routes
  - ~~Rate limiting~~ deferred for prototype — production would use `@upstash/ratelimit` + Upstash Redis (in-memory doesn't work on serverless)
- Server action hardening:
  - All inputs validated with Zod before any DB/AI operations
  - Every server action starts with `getSession()` — reject unauthenticated calls
  - Admin-only actions check `session.user.role === 'admin'` (specialists blocked)
  - File uploads: validate MIME type, file extension, magic bytes, max size (10MB)
  - SQL injection: impossible via Drizzle parameterized queries, but verify
  - XSS: sanitize any user input stored in DB, escape in rendering
- RSC security: verify no sensitive data (other specialists' data, admin metrics) leaks to specialist-role users in server component props
- Environment variable audit: ensure no secrets leak to client
- Add `robots.txt` to prevent indexing
- Error boundaries: `global-error.tsx` (root), `error.tsx` (per route group), `not-found.tsx` — don't leak stack traces

**Step 24: Agent Environment & Project CLAUDE.md**
- **Already created** (in `.claude/skills/` and project root):
  - `CLAUDE.md` — project-level agent context (stack, commands, architecture rules, TTB vocabulary, test accounts, key files, available skills, env vars)
  - `.claude/skills/db-inspect/SKILL.md` — read-only database inspection via `psql` with ready-made queries for schema, counts, label detail, review queue, applicant stats, settings, dashboard summary
  - `.claude/skills/check-deployment/SKILL.md` — Vercel deployment verification via Vercel MCP (build logs, runtime logs, page load check)
  - `.claude/skills/test-page/SKILL.md` — Playwright-based page testing (navigate, interact, screenshot, verify)
- Verify all skills work correctly:
  - `/db-inspect` — run after seeding to verify data
  - `/test-page http://localhost:3000/login` — verify login page renders
  - `/check-deployment` — verify Vercel deployment after first deploy
- All database access via skills is **read-only** — the `db-inspect` skill explicitly prohibits mutating queries

**Step 25: Polish & Deploy**
- **Favicon & app icons:**
  - `public/favicon.ico` (32x32) — government-themed shield/seal icon
  - `public/icon.svg` — SVG version for modern browsers (Next.js metadata API picks this up automatically)
  - `public/apple-icon.png` (180x180) — Apple touch icon
  - Design: navy background with gold shield motif (matches the government theme)
- **Next.js Metadata API:**
  - Root `layout.tsx` exports `metadata` object: `title`, `description`, `icons`, `openGraph`, `robots`
  - Per-page metadata via `generateMetadata()` for dynamic titles: "Label Detail — OLD TOM DISTILLERY | TTB Label Verification"
  - `robots: { index: false, follow: false }` — internal tool, no crawling
- **`public/robots.txt`:** `User-agent: * Disallow: /` — prevent indexing
- Loading states: `loading.tsx` files with skeleton screens per route group (uses Next.js Suspense)
- Error handling: `error.tsx` + `global-error.tsx` — user-friendly error messages, retry buttons, no stack traces leaked. Toast notifications via Sonner for transient errors.
- Empty states: helpful messages when no data yet (new specialist with 0 labels, empty review queue, etc.)
- Not found: `not-found.tsx` for invalid label/applicant/batch IDs — "Label not found" with link back to history
- Mobile responsiveness: ensure usable on tablets (secondary priority)
- Performance: ensure < 5s validation time end-to-end
- README.md: setup instructions, architecture overview, env var docs
- Deploy to Vercel:
  - Link Neon Postgres
  - Link Vercel Blob
  - Configure environment variables
  - Verify production build
- Verify deployment with `/check-deployment` skill

---

## Testing Strategy

> Full test workflow catalog: see `.claude/plans/test-workflows.md` for 150+ specific test cases organized by feature area with priority matrix.

### Testing Layers

| Layer | Tool | What to Test | Target Coverage |
|-------|------|-------------|-----------------|
| **Static** | TypeScript (strict) + ESLint | Type errors, lint violations | 100% of code |
| **Unit** | Vitest | Zod schemas, utilities, config, pure functions, comparison engine | 80-90% |
| **Integration** | Vitest (mocked deps) | Server actions, validation pipeline, auth checks | 80%+ |
| **Component** | Vitest + React Testing Library | Synchronous client components, form validation | 60-70% |
| **E2E** | Playwright | Full user flows, async RSC pages, batch upload | Critical paths |

### Vitest Configuration

**`vitest.config.mts`:**
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    mockReset: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '**/*.config.*', '**/*.d.ts', '**/types/**', 'src/components/_base/**'],
    },
  },
})
```

**`vitest.setup.ts`** — global mocks for Next.js modules:
```ts
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => cleanup())

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
  headers: vi.fn(() => new Map()),
}))
```

### Mocking Patterns

| Dependency | Approach |
|-----------|----------|
| **Drizzle ORM** | Mock `@/db` module — mock `db.query.*`, `db.insert()`, `db.update()`, `db.delete()` return values |
| **Google Cloud Vision** | Mock `@google-cloud/vision` — mock `ImageAnnotatorClient.textDetection()` to return OCR text + bounding polygons |
| **Vercel AI SDK** | Mock `ai` module — mock `generateText()` to return structured field classification responses matching our Zod schema |
| **Vercel Blob** | Mock `@vercel/blob` — mock `put()`, `del()`, return fake URLs |
| **Better Auth** | Mock `@/lib/auth` — mock `getSession()` to return admin/specialist/null sessions |
| **next/headers** | Mock `cookies()`, `headers()` globally in setup file |
| **next/navigation** | Mock `redirect()`, `useRouter()`, `usePathname()` globally in setup file |

### Key Limitation: Async Server Components

**Vitest cannot test async RSC** (components with `async function` that do DB queries). These are tested via:
1. **Unit test the data-fetching logic** separately (mock DB, test the query function)
2. **Unit test the presentational component** with props (pass data in, test rendering)
3. **E2E test the full page** with Playwright

### Test File Organization

Colocated tests in `__tests__/` subdirectories:
```
src/app/actions/__tests__/validate-label.test.ts
src/lib/ai/__tests__/compare-fields.test.ts
src/lib/validators/__tests__/label-schema.test.ts
src/components/validation/__tests__/validation-checklist.test.tsx
src/hooks/__tests__/use-keyboard-shortcuts.test.ts
e2e/                                    # Playwright E2E tests
├── auth.spec.ts
├── validate-label.spec.ts
├── review-queue.spec.ts
├── batch-upload.spec.ts
└── keyboard-shortcuts.spec.ts
```

### What to Test (Priority Order)

**P0 — Must have:**
- All Zod schemas (100% coverage — they're our input validation firewall)
- Field comparison engine (`compare-fields.ts`) — every match type, normalization, edge case
- Server action auth checks (every action rejects unauthenticated/wrong-role)
- Health warning statement validation (most common real rejection reason)
- Standards of fill validation (spirits 25 sizes, wine 22 sizes, malt any)
- File upload validation (magic bytes, size, type)
- E2E: login → validate label → view results → approve (happy path)

**P1 — Should have:**
- Server actions (validate-label, submit-review, create-batch, bulk-approve)
- Keyboard shortcut hook (context-aware, disabled in inputs)
- Deadline calculation and expiration logic
- Resubmission linking and priority sorting
- Quick Approve eligibility logic
- E2E: review queue flow, batch upload flow

**P2 — Nice to have:**
- Client component rendering (form states, loading, error)
- Applicant stats calculations
- Communication report generation
- Dashboard data queries

### Edge Cases to Test (Automated)
- Health warning: title case "Government Warning", missing caps, extra spaces, missing bold on header, bold on body text
- Brand names: special characters, apostrophes, accents ("Chateau Lafite", "Jagermeister"), different casing
- ABV normalization: "45% Alc./Vol. (90 Proof)" ↔ "45%"
- Net contents: "750 mL" ↔ "750ml" ↔ "75cL" ↔ "0.75L"
- Standards of fill: 600mL bourbon (illegal), 600mL beer (legal), all 25 spirits sizes, all 22 wine sizes
- Batch processing: 300 files, mixed valid/invalid, duplicate filenames
- File validation: wrong magic bytes with .jpg extension, >10MB, corrupt data
- Concurrent validations and rate limiting
- Revalidation chain: result_1 → result_2 → result_3, only result_3 `is_current`
- Deadline expiration: 30-day needs_correction → rejected, 7-day conditionally_approved
- Keyboard shortcuts: disabled in input/textarea, context-specific per page

### Lighthouse
- Performance and accessibility audit before deploy
- Target: 90+ performance, 90+ accessibility

---

## Agent Environment (Claude Code Self-Sufficiency)

The agent should be able to inspect the database, test the UI, check deployments, and verify its own work without asking the user. **Skills over MCPs, CLIs over custom scripts.** All database access is **read-only**.

### Project CLAUDE.md

`CLAUDE.md` at project root — loaded automatically every session. Contains: stack, all yarn commands, architecture rules, TTB vocabulary, test accounts, key files, available skills, environment variables. This is the agent's primary context source.

### Skills (Lightweight, Context-Efficient)

Skills are preferred because they load only when invoked and use minimal context.

#### `/db-inspect` — Database Inspection via psql

`.claude/skills/db-inspect/SKILL.md` — wraps `psql "$DATABASE_URL"` with ready-made read-only queries:
- Schema inspection (`\dt`, `\d <table>`, enum listing)
- Row counts for all tables (single query)
- Labels by status, by beverage type, by applicant
- Single label full detail (joined with application_data, validation_items)
- Review queue depth and pending items
- Applicant compliance stats (approval rate, total labels)
- Specialist workload (labels per specialist)
- Current settings and accepted variants
- Dashboard summary stats
- **All queries are read-only** — the skill explicitly prohibits INSERT/UPDATE/DELETE/DROP

#### `/check-deployment` — Verify Vercel Deployment

`.claude/skills/check-deployment/SKILL.md` — uses the Vercel MCP tools:
1. Find project via `.vercel/project.json`
2. Check latest deployment status via `list_deployments`
3. If failed → `get_deployment_build_logs` to diagnose
4. If succeeded → `web_fetch_vercel_url` to verify page loads
5. Check `get_runtime_logs` for errors in last hour

#### `/test-page <url>` — Test Page via Playwright

`.claude/skills/test-page/SKILL.md` — uses the Playwright MCP to:
1. Navigate to a URL (localhost or deployed)
2. Take screenshots and assess the page
3. Interact with forms, buttons, navigation
4. Test login, validation, review flows
5. Includes test user credentials for each role

#### Existing Global Skills (Already Available)

| Skill | Purpose |
|-------|---------|
| `/run-all-tests-and-fix` | Run Vitest suite, systematically fix failures |
| `/improve-design-of-page <url>` | Rate page design 1-10 via screenshots, iterate to 10/10 |
| `/security-audit` | Dependency audit + code security + infrastructure review |
| `/code-review-checklist` | Comprehensive code review |
| `/vercel-react-best-practices` | 45 performance rules prioritized by impact |
| `/commit-and-push` | Review diff, create descriptive commit, push |
| `/create-pr` | Create pull request with proper description |
| `/release` | Lint, fix, review, commit — prepare for release |
| `/upgrade-npm-deps` | Upgrade non-fixed dependencies |

### CLIs (Used by Skills and Directly)

| CLI | Purpose | Read-Only? |
|-----|---------|------------|
| `psql "$DATABASE_URL"` | Direct database queries (used by `/db-inspect`) | Yes — skill enforces read-only |
| `yarn test` | Run Vitest (used by `/run-all-tests-and-fix`) | N/A |
| `yarn lint` | Run ESLint | N/A |
| `yarn build` | Verify production build | N/A |
| `yarn knip` | Find unused code | N/A |
| `gh` | GitHub CLI for PRs, issues (used by `/create-pr`) | N/A |

### MCP Servers (Only Where Skills/CLIs Fall Short)

| MCP | Status | Purpose |
|-----|--------|---------|
| **Vercel** | Available | Deployment logs, runtime logs, docs. Used by `/check-deployment`. |
| **Playwright** | Available | Browser automation, screenshots. Used by `/test-page` and `/improve-design-of-page`. |
| **Postgres** | Optional | Only if `psql` via Bash isn't sufficient for complex ad-hoc queries. Most needs covered by `/db-inspect` skill. |

### Agent Self-Service Patterns

| Agent Needs To... | Use |
|---|---|
| Check database state | `/db-inspect` |
| Verify seed data loaded | `/db-inspect` → counts query |
| Debug a specific label | `/db-inspect` → label detail query |
| Test a page visually | `/test-page http://localhost:3000/validate` |
| Improve page design | `/improve-design-of-page http://localhost:3000/validate` |
| Verify deployment | `/check-deployment` |
| Run tests and fix | `/run-all-tests-and-fix` |
| Check security | `/security-audit` |
| Review code quality | `/code-review-checklist` |
| Check performance | `/vercel-react-best-practices` |
| View runtime errors | Vercel MCP `get_runtime_logs` |
| Create commit | `/commit-and-push` |
| Create PR | `/create-pr` |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Cloud Vision OCR may miss text on curved/distorted labels | Include confidence scores, allow "needs review" status, store raw AI responses for debugging |
| 5-second target may be tight with two-stage pipeline | Stage 1 (Cloud Vision) is <1s, Stage 2 (GPT-5 Mini) is ~1-2s — well within budget. Show progress indicator for each stage. |
| GPT-5 Mini may misclassify ambiguous text blocks | Include confidence scores, fall back to GPT-5.2 for low-confidence results if needed |
| Batch processing 300 items could timeout | Process asynchronously with polling, don't block on single request |
| Health warning statement exact matching too strict | Normalize whitespace/encoding before comparison, flag near-matches for specialist review |
| Vercel serverless function timeout (60s on Pro) | Process batch items individually, not in single function invocation |
| Image quality varies wildly | Include confidence scores, flag low-confidence extractions, suggest re-upload |

---

## Open Questions

1. ~~**Auth:** Decided — Better Auth with admin + specialist roles.~~
2. ~~**Sample labels:** Decided — 100-150 real images from TTB COLA registry + COLA Cloud API, supplemented with 15-20 AI-generated edge cases. Reused across ~1,000 label records.~~
3. **CSV import for batch:** Should batch uploads support a CSV file with application data mapped to image filenames? Nice-to-have if time permits.
4. ~~**Health warning template:** Decided — pre-fill the standard "GOVERNMENT WARNING:" text from 27 CFR Part 16 as default. Editable in settings.~~
5. ~~**Auto-pass rules:** Cut — over-engineered. Confidence threshold + strictness + variants is enough.~~
6. ~~**Report template editor:** Cut — fixed templates per status, citing CFR sections. No customization UI.~~
7. ~~**Applicant trend analysis:** Simplified — approval rate + total count + most common rejection reason. No trend arrows or "is this unusual?" context.~~

---

## Dependencies (latest versions as of February 2026)

### Production
```
# Framework & Core
next (^16.1)              # Framework (Turbopack default, proxy.ts, use cache)
react (^19.2), react-dom  # React 19.2 (bundled with Next.js 16)
typescript (^5.7)         # Type safety

# Auth
better-auth (^1.4)        # Authentication (admin/specialist roles, sessions)

# Styling & UI
tailwindcss (^4.1)        # Styling (CSS-first config, @theme directive)
motion (^12.34)           # Animations (framer-motion)
next-themes (^0.4)        # Light/dark mode toggle (ThemeProvider + useTheme)
class-variance-authority  # Component variants
tailwind-merge            # Tailwind class merging
clsx                      # Class name utility
lucide-react              # Icons
@radix-ui/*               # shadcn/ui primitives
sonner                    # Toast notifications
recharts (^3.7)           # Charts (shadcn/ui Charts composition layer). Note: needs "overrides": {"react-is": "^19.0.0"} for React 19
diff (^8.0)               # Character-level text diffing for field comparisons (jsdiff — diffChars)

# Database & Storage
drizzle-orm (^0.45)       # Database ORM (v1 beta available but use stable)
@neondatabase/serverless  # Postgres driver
@vercel/blob              # Image storage (signed URLs, client-side direct uploads via @vercel/blob/client)
nanoid (^5.1)             # Nano ID generation (21-char, URL-friendly PKs)

# AI — Hybrid Pipeline (Google Cloud Vision OCR + GPT-5 Mini classification)
@google-cloud/vision      # Stage 1: OCR — pixel-accurate word-level bounding polygons (<1s, $0.0015/img)
ai (^6.0)                 # Vercel AI SDK (generateText + Output.object, streamText, useChat)
@ai-sdk/openai (^3.0)    # Stage 2: OpenAI provider — GPT-5 Mini for text classification ($0.25/$2.00 per 1M tokens)

# Forms & State Management
react-hook-form (^7.54)   # Form management (uncontrolled, fast, Zod integration)
@hookform/resolvers       # Zod resolver for React Hook Form
react-dropzone (^15.0)    # File upload dropzone (drag-and-drop, a11y, React 19 compatible)
zustand (^5.0)            # Client-side state management (stores for annotations, uploads, reviews)
nuqs (^2.8)               # Type-safe URL search params (filters, pagination, sort — RSC compatible)

# Validation & Utilities
zod                       # Schema validation (also used by drizzle-orm/zod and AI SDK Output.object)
p-limit (^6.2)            # Concurrency control for batch AI calls and parallel uploads (max N in-flight)

# Analytics
@vercel/analytics (^1.6)  # Vercel Web Analytics (page views + custom events)
```

### Dev — Tooling
```
drizzle-kit               # DB migrations & studio
@types/node, @types/react # Type definitions

# Linting & Formatting
eslint (^10)              # Linting (flat config only in v10)
eslint-config-next (^16)  # Next.js ESLint rules (flat config)
typescript-eslint (^8)    # TypeScript ESLint integration
@eslint/js                # ESLint core JS rules
eslint-config-prettier    # Disable ESLint rules that conflict with Prettier
prettier (^3)             # Code formatting
prettier-plugin-tailwindcss # Tailwind class sorting (needs tailwindStylesheet for v4)

# Testing
vitest                    # Unit/integration testing
@vitejs/plugin-react      # React support for Vitest
vite-tsconfig-paths       # Path alias resolution in Vitest
jsdom                     # DOM environment for component tests
@testing-library/react    # React component testing utilities
@testing-library/dom      # DOM testing utilities
@testing-library/jest-dom # Custom Jest/Vitest matchers (toBeInTheDocument, toHaveTextContent, etc.)
@testing-library/user-event # User interaction simulation (modern approach, replaces fireEvent)
@playwright/test          # E2E testing

# Code Quality
knip (^5.85)              # Unused file/export/dependency detection
husky (^10)               # Git hooks
lint-staged (^15)         # Run linters on staged files
@commitlint/cli           # Commit message linting
@commitlint/config-conventional # Conventional commit rules

# Utilities
tsx (^4.21)               # TypeScript script runner (seed, migrations)
```
