# Excisely — Decision Log

A living record of the major engineering decisions, pivots, and trade-offs behind this project. Decisions are documented as they happen — newer entries appear at the top of each section. When a decision is revised, the original stays with a note explaining what changed and why.

The goal is to show iterative, thoughtful engineering judgment — not just what we built, but how our thinking evolved.

---

## 1. Engineering Decisions

### Hybrid Regulations Reference: Curated In-App + eCFR External Links *(Feb 23, 2026)*

**Chosen:** Curate ~30 key CFR sections as a static TypeScript config file with plain-English summaries, and link out to eCFR (the official electronic Code of Federal Regulations) for authoritative full text.

**Alternatives considered:**

- **Link out only** — zero maintenance, always authoritative, but users lose context when jumping to dense legal text on a government website
- **Full in-app eCFR content** (~536KB XML) — best UX with full searchability, but over-engineered for a prototype (requires XML parsing pipeline, maintenance burden, potential licensing/compliance questions)

**Reasoning:** The hybrid approach follows the existing config-file pattern (`field-tooltips.ts`, `health-warning.ts`, `beverage-types.ts`) — evaluators see architectural consistency. Curated summaries in plain English demonstrate domain understanding and show we read the CFR. eCFR deep links (`https://www.ecfr.gov/current/title-27/section-5.63`) work perfectly for authoritative full text when users want depth. No build-time API calls, no XML parsing, no external runtime dependency. The eCFR API is free with a search endpoint — we could add live search as a future enhancement.

**UX principle:** Progressive disclosure. Field tooltips show a citation badge → click takes you to the regulations page with the section anchored → "View on eCFR" links out to the full legal text. Users choose their depth of engagement at every step.

### Server-Side Data Layer: RSC + Server Actions over Exposed API Routes *(Feb 23, 2026)*

**Chosen:** All data fetching happens in React Server Components and all mutations go through Server Actions. No public API routes are exposed — the client never sees endpoint URLs, request/response shapes, or data schemas in the browser's network tab.

**Alternatives considered:**

- Traditional REST API routes (`/api/labels`, `/api/validate`, etc.) consumed by client-side `fetch` calls
- tRPC (typed client-server communication with exposed endpoints)
- GraphQL (single endpoint, introspectable schema)

**Reasoning:** This is a deliberate security-through-architecture decision. With traditional API routes, every endpoint is visible in the browser's Network tab — an attacker (or curious user) can see the URL patterns, request payloads, and response shapes, then replay or modify those requests outside the application. For a government regulatory tool processing COLA application data, minimizing the API surface area reduces the attack surface. Server Components fetch data entirely on the server — the client receives rendered HTML, not raw JSON. Server Actions are invoked as form submissions to a single generic Next.js endpoint with an encrypted action ID — an observer sees `POST /` with an opaque payload, not `POST /api/labels/abc123/approve`.

**Trade-offs we're aware of:**

- **RSC and Server Actions are not inherently secure.** They still execute user-provided input on the server, so every Server Action validates input with Zod and checks authentication via `getSession()` before any logic runs. The abstraction reduces exposure but does not replace proper authorization.
- **Recent vulnerabilities.** React Server Components and Server Actions have had security issues — including a 2024 Server Action encryption key exposure (CVE-2024-34351) where the action ID encryption could be bypassed. These were patched quickly by the Next.js team, but it demonstrates that this is not a "set and forget" security boundary. We'd need to stay current on Next.js security patches in production.
- **Debugging is harder.** When the API isn't visible in the Network tab, debugging data flow requires server-side logging rather than browser DevTools inspection. This is a trade-off we accept — the convenience of visible APIs benefits attackers more than it benefits our team, and server-side observability (structured logging, error tracking) is a better practice for production anyway.
- **Not a substitute for defense in depth.** Even though API routes aren't exposed, every Server Action still implements: (1) session validation, (2) role-based authorization, (3) Zod input validation, and (4) parameterized queries via Drizzle. If the RSC/Server Action layer were compromised, these inner defenses still apply.

The bottom line: hiding the API surface from casual observation is a meaningful security layer for a government tool, but we treat it as one layer in a defense-in-depth strategy — not the only layer.

### Specialist Batch Approval Queue *(Feb 23, 2026)*

**Chosen:** Split the specialist dashboard's pending_review labels into two distinct queues -- "Ready to Approve" (batch-approvable, high-confidence labels where all fields match) and "Needs Review" (labels requiring manual specialist attention).

**Alternatives considered:**

- Single queue ordered by priority/confidence (specialists manually identify easy approvals)
- Fully automatic approval for high-confidence labels with no specialist in the loop
- Three-tier queue (auto-approve / quick-review / deep-review)

**Reasoning:** Specialists currently treat every submission equally, spending the same time on a label where every field matches at 99% confidence as they do on a label with three mismatches and a missing health warning. By triaging into two queues, the "Ready to Approve" tab lets specialists batch-select and approve high-confidence, all-match labels in seconds -- clearing the bulk of daily volume. This frees their time for "Needs Review" labels that genuinely need human judgment (field conflicts, low confidence, missing required fields). The queue criteria are: Ready = `pending_review` status + AI proposed `approved` + all validation items match + overall confidence >= configurable threshold (default 95%). Auto-approval was explicitly removed as a default -- all labels now route through specialist review. Organizations that trust their AI pipeline enough can re-enable auto-approval via a settings toggle. The separation also gives specialists a psychologically satisfying workflow: clear the easy stack first, then focus on the hard problems.

### Applicant Extraction Model: GPT-4.1 over GPT-5 Mini *(Feb 23, 2026)*

**Chosen:** GPT-4.1 (standard, non-reasoning) for the applicant-side fast extraction pipeline, with a richly descriptive system prompt and minimal output schema (`{fieldName, value}` only).

**Alternatives tested (with measured latency on a 2-image bourbon label):**

| Model | Classification Time | Output Tokens | Accuracy | Notes |
|-------|-------------------|---------------|----------|-------|
| GPT-5 Mini (reasoning) | 19–25s | 1,800–2,800 | High — found all fields | Reasoning model; `temperature` not supported; internal chain-of-thought inflates latency and tokens |
| GPT-5 Nano | 47s | 5,400 | Poor — missed most fields | Paradoxically slower and worse than GPT-5 Mini |
| GPT-4.1 Nano | 1.1–2.7s | 74 | Low — missed several fields (age statement, fanciful name) | Too terse; insufficient capacity for 10+ field extraction |
| GPT-4.1 Mini | 4.2s | 145 | Moderate — missed class_type, fanciful_name, state_of_distillation | Fast but not capable enough for the full field set |
| **GPT-4.1** | **2.4–5.1s** | **~150** | **High — found all fields** | Non-reasoning; supports `temperature: 0`; best speed/accuracy trade-off |

**Key engineering challenges solved:**

1. **Prompt design for non-reasoning models.** GPT-5 Mini's internal chain-of-thought compensated for terse prompts. GPT-4.1 needs explicit per-field descriptions with examples, `[REQUIRED]` markers for mandatory fields, and disambiguation rules (brand_name vs. class_type vs. fanciful_name). The system/user message split enables OpenAI prompt caching across calls.

2. **Schema minimization for speed.** The full classification schema (wordIndices, confidence, reasoning, imageClassifications) added ~2,000 output tokens. Stripping to `{fieldName, value}` cut output by 90%. Bounding boxes are recovered via CPU-based local text matching against OCR words (~5ms, no LLM call) — the `norm()` function strips punctuation so "Beam Suntory, Clermont, KY" matches OCR words "Beam Suntory Clermont KY".

3. **Form pre-fill timing with react-hook-form.** In submit mode, form fields live in Phase 3 (progressive reveal) which only mounts after extraction succeeds. Calling `setValue()` before fields are registered via `register()` silently fails for uncontrolled inputs. The fix: use `reset()` (which properly seeds react-hook-form's internal store for fields that register later) plus a deferred `useEffect` that re-applies values 50ms after Phase 3 mounts as a safety net.

4. **Fuzzy matching for dropdown pre-fill.** AI-extracted values don't match dropdown options exactly: "Distilled and Bottled by" isn't in the qualifying phrase list (closest: "Distilled by"), and "Kentucky Straight Bourbon Whiskey" doesn't match TTB code "Straight Bourbon Whisky" (American vs. British spelling). The fix normalizes whiskey→whisky, strips punctuation, and uses containment matching to find the closest dropdown option.

**Reasoning:** The applicant extraction is a transcription aid — the applicant reviews and corrects everything before submission, and the specialist pipeline re-verifies independently with GPT-5 Mini (multimodal, with images). Spending 20+ seconds on a pre-fill that the user will edit anyway is unacceptable UX. GPT-4.1 at ~3-5s hits the sweet spot: fast enough to feel responsive, accurate enough that most fields are correct, and cheap enough ($2/$8 per 1M tokens vs GPT-5 Mini's $0.25/$2 — but GPT-5 Mini's reasoning overhead made it produce 10-20x more output tokens, so effective cost was comparable).

### Front-Loading AI Extraction to the Applicant *(Feb 23, 2026)*

**Chosen:** AI extracts field values from the label image before the applicant fills out the form. The applicant reviews and corrects the pre-filled values, then submits. AI re-verifies on submission.

**Alternatives considered:**

- Applicant manually types all form fields, AI verifies after submission (original design)
- AI extraction with no applicant review (fully automated)
- Side-by-side extraction preview without pre-filling the form

**Reasoning:** The original workflow had applicants manually entering 15+ fields from their label image into the Form 5100.31 -- tedious, error-prone, and redundant (the AI was going to read the same label anyway). By front-loading extraction, the AI pre-fills the form and the applicant's job shifts from transcription to confirmation. This reduces processing time because applicants catch AI misreads before submission, eliminating round-trips. It produces cleaner data for specialists because applicant-confirmed values are more accurate than raw AI output or manual re-entry. And it requires no new infrastructure -- the hybrid AI pipeline (Cloud Vision OCR + GPT-5 Mini classification) already exists; it simply runs earlier in the workflow.

The breakthrough insight: the AI runs twice but serves two different purposes. The first pass is **transcription** -- help the applicant by extracting what the label says. The second pass is **verification** -- help the specialist by comparing what the applicant confirmed against what the AI independently reads. Same pipeline, two jobs. The first pass is collaborative (applicant fixes AI errors), the second pass is adversarial (AI flags discrepancies the applicant might have missed or introduced).

What we explicitly chose NOT to show applicants: confidence scores, match results, system thresholds. The principle is straightforward -- show them what the AI sees, not what the AI thinks. Applicants see extracted text values and correct them. They never see "87% confidence" or "partial match" because that information is for specialist decision-making, not applicant data entry. Leaking internal scoring to applicants would create anxiety ("why is my label only 87%?") and potential gaming ("if I adjust this field the confidence goes up").

### Hybrid AI Pipeline: Google Cloud Vision + GPT-5 Mini *(Feb 21, 2026)*

**Chosen:** Two-stage pipeline -- Cloud Vision for OCR with pixel-accurate bounding boxes, then GPT-5 Mini for semantic field classification on the extracted text.

**Alternatives considered:**

- Single LLM (GPT-5.2 vision) for both OCR and classification
- Gemini 2.5 Pro (best LLM at mAP 13.3 for bounding boxes)
- Tesseract or other open-source OCR

**Reasoning:** GPT-5.2 vision has an mAP50:95 of 1.5 for bounding boxes -- the worst of any frontier model (per Roboflow benchmarks). That means bounding box overlays on the label image would be unreliable, undermining the annotated-image UI that specialists need. Google Cloud Vision is purpose-built for OCR: pixel-accurate word-level bounding polygons, sub-second latency, and $0.0015/image. By splitting OCR from classification, we can use GPT-5 Mini for the reasoning step -- it only receives text (no image tokens), making it 7x cheaper than GPT-5.2 ($0.25 vs $1.75 per 1M input tokens). Total cost per label drops from ~$0.0105 to ~$0.003. Total latency stays under 5 seconds (Cloud Vision <1s + GPT-5 Mini ~1-2s), meeting Sarah's "5-second or nobody will use it" requirement from the pilot vendor disaster.

> **Revised (Feb 23, 2026):** The pipeline now uses two different classification models depending on context. **Specialist review** still uses GPT-5 Mini (multimodal, with images, full schema with word indices and reasoning) for maximum accuracy. **Applicant pre-fill** uses GPT-4.1 (text-only, minimal schema) for speed — ~3-5s vs ~20s. See "Applicant Extraction Model" decision above for the full evaluation.

### Next.js 16 with App Router (RSC-First) *(Feb 21, 2026)*

**Chosen:** React Server Components by default, client components only for interactivity (file uploads, image annotations, forms).

**Alternatives considered:**

- Traditional SPA (React + Vite)
- Next.js Pages Router
- Remix

**Reasoning:** RSC eliminates client-side data fetching entirely -- label data, validation results, and dashboard stats load on the server with zero client-side waterfalls. Server Actions replace exposed API routes for all mutations, reducing the attack surface. This is a data-heavy internal tool where most pages display read-only results; RSC is the natural fit. Next.js 16 specifically gives us Turbopack (2-5x faster builds), `proxy.ts` running on Node.js runtime (not Edge), and `use cache` for explicit caching control.

### Drizzle ORM over Prisma *(Feb 21, 2026)*

**Chosen:** Drizzle ORM with Neon Postgres (`@neondatabase/serverless`).

**Alternatives considered:**

- Prisma (heavier ORM, larger bundle, slower cold starts on serverless)
- Raw SQL with `pg` driver
- Kysely (query builder)

**Reasoning:** Drizzle is SQL-first and lightweight -- ideal for a prototype where we want the full power of SQL without the overhead of Prisma's client generation and migration engine. `$inferSelect`/`$inferInsert` derive TypeScript types directly from the schema, and `drizzle-orm/zod` auto-generates Zod validation schemas. This makes `schema.ts` the single source of truth for database structure, TypeScript types, and runtime validation -- zero manual type maintenance. Neon's serverless driver means no connection pooling headaches on Vercel.

### Nano IDs over UUIDs *(Feb 21, 2026)*

**Chosen:** 21-character nanoid strings for all primary keys (e.g., `V1StGXR8_Z5jdHi6B-myT`).

**Alternatives considered:**

- UUID v4 (36 characters with hyphens)
- CUID2
- Auto-increment integers

**Reasoning:** Nano IDs are shorter (21 vs 36 chars), URL-friendly (no hyphens to encode), produce smaller database indexes, and are collision-resistant (1% probability of collision after generating 1 billion IDs per second for 149 years). They work well in URLs like `/history/V1StGXR8_Z5jdHi6B-myT` without encoding issues. Generated in application code via `$defaultFn(() => nanoid())` on Drizzle schema definitions.

### Better Auth over NextAuth / Clerk *(Feb 21, 2026)*

**Chosen:** Better Auth v1.4 with Drizzle adapter, email/password login, session-based auth.

**Alternatives considered:**

- NextAuth/Auth.js (complex configuration, frequent breaking changes)
- Clerk (SaaS vendor lock-in, overkill for prototype)
- Roll-our-own JWT auth

**Reasoning:** Better Auth is simpler to configure, self-hosted (no vendor dependency), and integrates directly with Drizzle ORM. For a prototype with 6 pre-provisioned test accounts and two roles (specialist/applicant), we need reliable session management without the configuration overhead of NextAuth or the cost/lock-in of Clerk. Sessions use 30-day expiry with 1-day refresh, and every server action validates the session before executing.

### Vercel AI SDK (Not Raw OpenAI SDK) *(Feb 21, 2026)*

**Chosen:** `ai` v6 + `@ai-sdk/openai` provider for the GPT-5 Mini classification stage.

**Alternatives considered:**

- Raw `openai` SDK (direct API calls)
- LangChain (heavy abstraction layer)

**Reasoning:** The Vercel AI SDK provides `generateText` + `Output.object()` with Zod schema enforcement -- structured outputs with automatic retry on schema validation failures. It is provider-agnostic, so swapping GPT-5 Mini for another model (or another provider entirely) requires changing one line. The SDK handles token counting, usage tracking, and streaming natively. LangChain was rejected as too heavy for a single-provider, single-model use case.

### No AI Gateway *(Feb 21, 2026)*

**Chosen:** Direct API calls to OpenAI and Google Cloud Vision -- no intermediate proxy.

**Alternatives considered:**

- Vercel AI Gateway
- Portkey, Helicone, or similar AI proxy

**Reasoning:** We use exactly two AI providers (Cloud Vision for OCR, OpenAI for classification) with no fallback routing, A/B testing, or multi-provider load balancing. An AI gateway would add latency to every request for zero benefit. Usage tracking is handled by the AI SDK's built-in `usage` response field. If this were production with multiple models and providers, a gateway would make sense.

### React Hook Form over Formik / Native Forms *(Feb 21, 2026)*

**Chosen:** React Hook Form v7 with `@hookform/resolvers` (Zod resolver).

**Alternatives considered:**

- Formik (heavier, more re-renders)
- Native HTML forms with manual state management
- Conform (newer, less ecosystem support)

**Reasoning:** The label validation form has 15+ dynamic fields that change based on beverage type selection. React Hook Form uses uncontrolled inputs by default, which means minimal re-renders as the user types -- critical for a form this complex. The Zod resolver provides client-side validation that mirrors the server-side Zod schemas used in server actions (same validation logic, both sides). Server actions always re-validate independently -- never trust the client.

### Lazy Deadline Expiration (No Cron Jobs) *(Feb 21, 2026)*

**Chosen:** `getEffectiveStatus()` computes the true label status inline by checking `correction_deadline` against the current time. Fire-and-forget DB update on page load.

**Alternatives considered:**

- Cron job to expire deadlines (requires Vercel Cron or external scheduler)
- Database triggers
- Background job queue (BullMQ, Inngest)

**Reasoning:** On Vercel serverless, cron jobs are limited to specific intervals and add infrastructure complexity. Our approach is simpler and always accurate: when any code path reads a label's status, `getEffectiveStatus()` checks if the correction deadline has passed and returns the effective status (e.g., `needs_correction` with an expired 30-day deadline becomes `rejected`). A fire-and-forget DB update persists the transition so the database eventually converges. There is no window where a user sees stale data -- the status is computed fresh on every read. The only trade-off is that the `status` column in the database may be temporarily stale between page loads, but this has no user-visible impact.

### Client-Side Blob Uploads *(Feb 21, 2026)*

**Chosen:** `@vercel/blob/client` for direct browser-to-Blob uploads with per-file progress tracking.

**Alternatives considered:**

- Server-side uploads via server actions (limited to 4.5MB body size)
- Pre-signed S3 URLs
- Uploadthing

**Reasoning:** Server actions in Next.js have a 4.5MB request body limit. Label images can be up to 10MB each, and batch uploads may include 300+ files. Client-side direct uploads bypass this limit entirely -- the browser uploads directly to Vercel Blob's CDN after receiving a short-lived token from our API route (which validates auth and MIME types). `p-limit` controls concurrency to 5 parallel uploads to avoid overwhelming the browser or network.

### CSS Transforms for Image Zoom/Pan *(Feb 21, 2026)*

**Chosen:** Custom implementation using `transform: scale() translate()` -- approximately 80 lines of code.

**Alternatives considered:**

- react-zoom-pan-pinch (40KB+ bundle)
- panzoom library
- OpenSeadragon (overkill for single images)

**Reasoning:** The annotated image viewer needs wheel-to-zoom, drag-to-pan, and programmatic "zoom to field" (when clicking a comparison row). These three behaviors are straightforward with CSS transforms on a container div wrapping the image and SVG overlay. Adding a library for this would bring in 40KB+ of JavaScript for functionality we can implement in ~80 lines. The custom approach also gives us precise control over the "zoom to bounding box" animation when a specialist clicks a field in the comparison checklist.

### Zustand + nuqs for State Management *(Feb 21, 2026)*

**Chosen:** Zustand v5 for ephemeral client state, nuqs v2.8 for URL-persisted state.

**Alternatives considered:**

- React Context (provider nesting, performance issues with frequent updates)
- Jotai/Recoil (atomic state -- more complex than needed)
- URL state only (insufficient for transient UI state)

**Reasoning:** Two distinct state categories require different solutions. Zustand handles ephemeral UI state: image annotation interactions (zoom level, active field, pan position), batch upload progress, and review session state. These are transient -- they reset on navigation and don't belong in the URL. nuqs handles persistent filter/navigation state: table filters (status, date range, applicant), pagination, and sort order. These are URL-backed, which means filters survive page refresh, are shareable via URL, and work with React Server Components via `createSearchParamsCache`. The boundary is clean: if state should survive a page refresh or be shareable, it goes in nuqs. Everything else goes in Zustand.

### Tailwind CSS v4 + shadcn/ui *(Feb 21, 2026)*

**Chosen:** Tailwind CSS v4 with CSS-first configuration (`@theme` directive) and shadcn/ui (new-york style) for the component library.

**Alternatives considered:**

- Chakra UI (opinionated, larger bundle)
- Material UI (Google aesthetic, wrong tone for government tool)
- Radix Primitives with custom styling (more work)

**Reasoning:** shadcn/ui gives us accessible, unstyled Radix primitives with sensible defaults that we can customize heavily for the government compliance theme (deep navy, gold accents, official typography). Components are copied into the project (not imported from `node_modules`), so we own them completely -- no version lock-in or style overriding fights. Tailwind CSS v4's CSS-first configuration means theming happens in `globals.css` with the `@theme` directive, making dark mode and custom color palettes straightforward. The government aesthetic (serif headings, badge-style status indicators, shield motifs) requires significant customization that would fight against opinionated libraries like Material UI.

---

## 2. Scope Decisions

### What We Built (MVP -- Phases 1-3)

The MVP delivers a complete, end-to-end label verification workflow:

- **Authentication** -- Login/logout with role-based access (specialist and applicant roles)
- **Single label validation** -- Upload label image(s), enter Form 5100.31 application data, run hybrid AI pipeline, get field-by-field comparison results
- **Annotated image viewer** -- Bounding box overlays from Cloud Vision OCR, color-coded by match status, zoom/pan interaction, click-to-highlight from comparison checklist
- **Side-by-side field comparison** -- Application data vs. AI-extracted values with character-level diff highlighting, confidence scores, and AI reasoning
- **Validation history** -- Filterable, sortable table of all processed labels with status badges and deadline countdowns
- **Role-aware dashboard** -- Specialists see all labels with SLA metrics; applicants see their own submissions
- **Quick Approve** -- One-click approval for labels where all fields match at high confidence
- **Correspondence Timeline** -- Simulated email audit trail showing auto-generated notifications (approval, correction, rejection) with full email previews (from/to/subject/body, field discrepancy tables)
- **Keyboard shortcuts** -- Queue processing shortcuts (A/R/C/J/K/N/P) for high-throughput review

### What We Also Built (Stretch -- Phases 4-7)

Originally scoped as stretch goals, these features were implemented to demonstrate the full workflow:

| Feature                                          | What It Adds                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Review queue & specialist assignment**         | Priority-ordered queue with per-field override controls and human review audit trail                                                |
| **Batch upload (300+ labels)**                   | Multi-file upload with p-limit concurrency control, batch detail with polling progress                                              |
| **Applicant management & compliance reputation** | Applicant list/detail with compliance stats, risk badges, and submission history                                                    |
| **Reports page with charts**                     | Status distribution, validation trends, and field accuracy charts via Recharts                                                      |
| **Settings page**                                | Confidence threshold slider, per-field strictness toggles, SLA targets -- accessible to all specialists                             |
| **Specialist batch approval queue**              | Dashboard splits pending labels into "Ready to Approve" (batch-approvable) and "Needs Review" (manual attention) tabs               |
| **AI-powered form pre-fill**                     | Front-loads extraction to the applicant -- AI pre-fills form fields, applicant confirms/corrects before submission                   |

### What We Explicitly Excluded

| Feature                         | Reasoning                                                                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rate limiting**               | Prototype scope. Production would use `@upstash/ratelimit` + Upstash Redis (in-memory rate limiting does not work on Vercel serverless -- each invocation is isolated) |
| **COLA system integration**     | Out of scope per Marcus Williams (IT Systems Administrator): "For this prototype, we're not looking to integrate with COLA directly"                                   |
| **Cron jobs**                   | Lazy evaluation via `getEffectiveStatus()` handles deadline expiration without external infrastructure                                                                 |
| **Real-time WebSocket updates** | Polling every 2 seconds during batch processing is simpler and sufficient for this use case                                                                            |
| **Offline support / PWA**       | Government workstations have reliable internet; offline adds complexity with no real benefit                                                                           |
| **Internationalization (i18n)** | English-only, US government context. TTB vocabulary is English by definition                                                                                           |
| **Mobile-first responsive**     | Sarah confirmed specialists use desktop workstations ("half our team is over 50"). Desktop-first, tablet-usable                                                        |
| **Email delivery**              | The Correspondence Timeline simulates realistic email notifications (full from/to/subject/body previews with field discrepancy tables) without actually sending mail. Demonstrates the communication UX and audit trail without email infrastructure |

---

## 3. Known Limitations

**AI Pipeline:**

- Google Cloud Vision OCR may struggle with severely distorted, curved, or poorly lit label images. The system includes confidence scores and routes low-confidence results to human review rather than making incorrect determinations.
- GPT-5 Mini classification accuracy has not been validated at scale on real TTB label data. Edge cases (unusual formatting, non-standard label layouts, multi-language labels) may require upgrading to GPT-5.2 for the classification stage, which would increase cost 7x but improve reasoning quality.
- Bounding boxes from Cloud Vision are word-level polygons, not field-level regions. The classification stage maps words to fields, but grouping accuracy depends on GPT-5 Mini correctly associating spatially separated text blocks (e.g., "GOVERNMENT WARNING:" header on one line and the warning body text on the next).

**Security:**

- No rate limiting in the prototype. A publicly exposed deployment could be abused for AI API cost attacks. The production mitigation is documented (`@upstash/ratelimit` + Upstash Redis) but not implemented.
- Login credentials are simple passwords (`specialist123`, `applicant123`) for demonstration purposes. Production would enforce complexity requirements and consider SSO integration.

**Data:**

- Seed data uses fabricated AI responses and pre-computed validation results -- not actual Cloud Vision or GPT-5 Mini output. Real model behavior may differ from seeded examples, particularly for edge cases.
- The ~1,000 seeded labels reuse 100-150 unique images across multiple label records. This is realistic (same product submitted with different application data), but means the annotated image viewer shows the same images repeatedly.

**Infrastructure:**

- Lazy deadline expiration means the `status` column in the database may be temporarily stale between page loads. The application always computes the correct effective status at read time, but direct database queries (e.g., `SELECT * FROM labels WHERE status = 'needs_correction'`) may return labels whose deadlines have already expired.
- No automated accessibility testing (Lighthouse audits are manual). The app targets WCAG 2.1 AA compliance through shadcn/ui's accessible primitives and semantic HTML, but automated coverage gaps may exist.

---

## 4. Assumptions

- **Browser support:** Users have modern browsers (Chrome 120+, Edge 120+, Firefox 120+). No IE11 or legacy browser support.
- **Desktop-first:** Government workstations with large monitors are the primary device. The UI is usable on tablets but optimized for desktop.
- **Reliable internet:** No offline capability. Label images must be uploaded, and AI APIs must be reachable from Vercel's network.
- **API accessibility:** OpenAI API and Google Cloud Vision API are accessible from Vercel's edge network without firewall restrictions. Marcus flagged that TTB's internal network blocks many domains -- this prototype runs on Vercel (external), so the restriction does not apply. A production deployment behind TTB's firewall would need API endpoint whitelisting.
- **Image quality:** Label images are reasonably well-lit, oriented correctly (not upside-down), and legible to the human eye. Severely damaged, occluded, or extremely low-resolution images may produce low-confidence or incorrect results.
- **Single-tenant:** One TTB team uses the application. There is no multi-tenant isolation, tenant-scoped data, or per-organization configuration.
- **English-only labels:** The AI pipeline and comparison engine are tuned for English-language labels. International labels with non-Latin scripts may not extract correctly.
