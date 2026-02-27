# Changelog

All notable changes to Excisely are documented here. This project follows a narrative changelog format — entries describe what changed and why, not just what files were touched. Newer entries appear first.

---

## Unreleased

### Added

- **Batch CSV upload for applicants** — New `/submit/batch` route lets applicants upload a CSV file (each row = one COLA application) alongside label images, then batch-submit up to 50 labels at once. Client-side CSV parsing with Papaparse, Zod validation per row, semicolon-delimited image filenames, per-row progress tracking with `p-limit(3)` concurrency, and a results summary with retry-failed capability. Reuses the existing AI validation pipeline via a new `submitApplicationCore()` extracted from `submitApplication`.
- **Local-first pipeline: Cloud APIs opt-in** — The app now defaults to the local Tesseract.js OCR pipeline, making it fully functional without any cloud API keys. Cloud AI (Google Cloud Vision + OpenAI GPT-4.1 Nano) is an opt-in upgrade when keys are configured. Settings page shows cloud API status, disables Cloud AI when keys are missing, and the specialist dashboard shows a dismissable upgrade banner. Validation pipeline automatically falls back to local if cloud extraction fails. Applicant pre-fill scan is disabled in local mode with an explanatory message.
- **Local VLM comparison pipeline** — Added SmolVLM-256M-Instruct via Transformers.js for browser-local label comparison with zero cloud API calls. Runs entirely in a Web Worker with ONNX Runtime WASM.
- **`/tools/local-compare` page** — New route for browser-local label comparison using the VLM pipeline. Per-field image inference with streaming results.
- **Per-field VLM inference with streaming results** — Each field is extracted individually by the local VLM and compared using the existing `compareField()` engine, with results streaming to the UI as they complete.
- **`preloadedBuffers` optimization** — Image bytes are now fetched in parallel with DB writes during submission, shaving ~150ms off the pipeline by overlapping I/O that was previously sequential.
- **Specialist can submit labels on behalf of applicants** — Specialists can now select an applicant when submitting a label through the validation form, enabling bulk processing workflows.
- **E2E test suite with 11 labels** — 4 real-world and 7 AI-generated test labels covering all beverage types (spirits, wine, malt beverages), exercising the full submission pipeline end-to-end.
- **Server-side caching with `use cache`** — Settings cached for hours, SLA metrics cached for minutes, label data cached for seconds. Uses Next.js 16's `cacheTag()` + `cacheLife()` directives. Previously every page was `force-dynamic` with zero caching.
- **React Compiler** — Enabled `reactCompiler: true` for automatic memoization across all components. Eliminates the need for manual `useCallback`/`useMemo`.
- **Optimistic batch approval** — Selected labels show approved status immediately in the UI via `useOptimistic` while the server action runs. Reverts on error.
- **Deferred error recovery** — `submit-application.ts` uses `after()` from `next/server` to defer label status cleanup on pipeline failure, returning the error response immediately.

### Changed

- **Restored Cloud Vision + OpenAI pipeline** — Reverted from the local Tesseract.js WASM + rule-based classification experiment back to Google Cloud Vision OCR + GPT-4.1 classification. The local pipeline produced garbled OCR on alcohol labels despite an 8-tier matching waterfall. Cloud Vision's purpose-built OCR and GPT-4.1's contextual understanding produce dramatically better accuracy. Local pipeline code preserved on `local-pipeline` branch.
- **Submission pipeline under 5 seconds** — Optimized the core verification pipeline through three changes: model switch (gpt-5-mini → gpt-4.1-nano), prompt compression (~1700 → ~600 input tokens), and schema trimming (removed reasoning field). Total pipeline drops from ~15-20s to ~3-5s, well under Sarah Chen's "about 5 seconds" usability threshold. The comparison engine — not the AI model — determines match/mismatch outcomes, so validation quality is unchanged.
- **Tag-based cache invalidation replaces `revalidatePath`** — All server actions now use granular `updateTag('labels' | 'sla-metrics' | 'settings')` instead of full-page `revalidatePath()`. Specialists see changes immediately without invalidating unrelated cached data.
- **`connection()` replaces `force-dynamic`** — All 9 app pages now use `await connection()` from `next/server` instead of `export const dynamic = 'force-dynamic'`. This is the modern Next.js 16 approach for opting into dynamic rendering.
- **`experimental.useCache` over `cacheComponents`** — After discovering that `cacheComponents: true` requires all dynamic data inside `<Suspense>` boundaries (incompatible with auth-gated layouts), switched to `experimental: { useCache: true }` which enables `use cache` without the strict enforcement.
- **Auto-detect beverage type from label images** — Applicants can now skip the beverage type selection step. The AI pipeline detects the product type from OCR keywords (whiskey/bourbon → spirits, cabernet/sulfites → wine, ale/lager → malt) before running type-specific extraction. Happy path runs in ~3-5s (same as manual selection). Falls back to the generic pipeline for ambiguous labels. Auto-detected type shows an "AI detected" badge that disappears when the user overrides it.
- **Correspondence Timeline replaces copy-to-clipboard reports** — The original plan called for "Send Report" buttons with copy-to-clipboard as a stopgap. We replaced this entirely with a Correspondence Timeline on each label's detail page. It shows a reverse-chronological feed of every communication event (automatic status notifications, specialist override notices, deadline warnings) with expandable email previews showing full From/To/Subject/Body headers and field discrepancy tables. This feels more like a real system — specialists see the audit trail of what was communicated and when, rather than manually copying text into emails.
- **Dashboard redesigned with SLA metrics** — The specialist dashboard now shows real-time SLA tracking (processing time targets, review queue depth, approval rates) instead of just label counts. Gives specialists visibility into team performance at a glance.
- **Labels table upgraded** — Added inline search, multi-column sorting, status filters, and deadline countdown badges. The table now handles the full workflow without needing to navigate to individual label pages for basic triage.
- **Review field list expanded** — Per-field review controls are more detailed, with inline diff highlighting, confidence indicators, and specialist notes. Supports the "review by exception" workflow where specialists focus on flagged fields.
- **Settings page field strictness reworked** — Cleaner UI for configuring per-field matching strictness (exact, fuzzy, normalized). Moved from a flat list to grouped controls by field category.
- **Reanalyze button improvements** — Better loading states, error handling, and feedback when re-running the AI pipeline on a label.
- **Annotated image viewer polish** — Improved bounding box rendering, better zoom/pan behavior, and smoother transitions when clicking fields in the comparison list.
- **Sidebar navigation updated** — Reorganized nav items, added AI Errors page link, improved active state styling.
- **Label upload form overhauled** — Major refactor of the validation form with better field organization, improved dropzone UX, and clearer beverage-type-aware field visibility.
- **Batch upload redesigned as CSV-based** — The original multi-file batch upload was removed because it treated every image as a separate application. Replaced with CSV batch upload: applicants upload a CSV (one row per COLA application) alongside label images, each row becomes a separate submission through the same AI pipeline. The specialist "bulk approve" feature is unaffected.
- **Regulations Reference page** — New `/regulations` route with curated plain-English summaries of ~30 key CFR sections across Parts 4 (Wine), 5 (Spirits), 7 (Malt Beverages), and 16 (Health Warning). Searchable, filterable by part and field, with deep links to eCFR for authoritative full text. Progressive disclosure: summary first, key requirements on expand, full legal text one click away.
- **Contextual regulation links in field tooltips** — Hovering over any field label (Brand Name, Alcohol Content, etc.) now shows CFR citation badges linking to the specific regulation. Puts regulatory context right where specialists already look.
- **Regulation links on flagged fields** — When a field shows a mismatch or needs correction, a "See regulation" link appears below the AI reasoning, connecting the discrepancy to the specific rule being enforced.
- **Regulations config** (`src/config/regulations.ts`) — Curated regulatory data with types, summaries, key requirements, beverage type mappings, and eCFR deep links. Follows the existing config-file pattern.
- **Regulation lookup utilities** (`src/lib/regulations/lookup.ts`) — Search by field name, beverage type, or free text across all curated sections.
- **AI Errors page** — New route for viewing and triaging AI pipeline failures (OCR errors, classification timeouts, malformed responses). Previously these were silent failures visible only in server logs.
- **Auto-refresh component** — Shared polling component for pages that need live updates (queue status).
- **Reanalysis guard** — Prevents concurrent re-analysis of the same label, with UI feedback showing when a label is already being processed.
- **Hover card component** — Added shadcn/ui hover card for rich tooltips on field labels and status badges.
- **Zustand stores** — Client-side state management for annotation interactions, upload progress, and review session state.
- **Field tooltips expanded** — TTB field descriptions now cover all Form 5100.31 fields with regulatory context.
- **AI prompt improvements** — Enhanced classification prompts with beverage-type-aware instructions for better field extraction accuracy.
- **Get settings helper** — Server-side utility for reading specialist-configured thresholds and strictness settings.
- **Override reason codes** — Predefined reason codes for status overrides (regulatory basis for specialist decisions).

### Fixed

- **Extract label pipeline hardened** — Better error handling for OCR failures, classification timeouts, and edge cases in the field merging step.
- **Schema refinements** — Minor column additions to support new features.

---

## 0.3.0 — Feb 23, 2026

### Added

- **Comprehensive test suite** — 284 tests across 19 test files covering the AI comparison engine, config validators, label processing pipeline, correspondence timeline, SLA metrics, and server action integration tests (override status, update settings, reanalyze label). Includes test factory utilities and mock helpers.

### Fixed

- **Gitignore pattern fix** — `config/` pattern was accidentally ignoring `src/config/`, hiding TTB configuration files from git. Scoped the ignore to root `config/` only.
- **Vitest scope** — Restricted test runner to `src/` to exclude Playwright E2E specs from unit test runs.

---

## 0.2.0 — Feb 22, 2026

### Added

- **Applicant context on review page** — Company name, contact info, and email now display in the review header so specialists have applicant context without navigating away.
- **Annotation drawing improvements** — Adjustment mode with resize handles, move support, confirm/redraw workflow, and two-level Escape. AI overlays auto-hide during drawing for a clean canvas.
- **Live crop preview** — Drawn annotation rectangle shows a live crop preview that dynamically repositions to avoid overlapping the selection area.
- **Status override dialog** — Specialists can override AI-determined status with justification and reason codes directly from the review page.
- **Multi-image tab support** — Labels with multiple images now show tabbed navigation in the review detail panels.

### Changed

- **Banner field display** — Field name banner now sits above the image (not overlapping) with seamless border radius and TTB field description tooltips.
- **Layout and sidebar refactored** — Cleaner page structure, improved sidebar navigation, updated settings page layout.
- **Deprecated pages removed** — Removed old history and reports pages that were superseded by the labels table and dashboard metrics.

### Fixed

- **Turbopack build panic** — Duplicate icon files (icon.png + icon.svg) in `src/app/` triggered a known Turbopack bug. Removed redundant files.

---

## 0.1.1 — Feb 22, 2026

### Fixed

- **Private blob storage** — Switched Vercel Blob to private access with signed download URLs. Added `getSignedImageUrl()` and `fetchImageBytes()` for server-side image access.
- **OCR pipeline updated** — Now accepts Buffer instead of URL since private blobs require authentication for access.
- **Better Auth adapter** — Removed `usePlural` option that caused model lookup failures ("users" not found in schema).
- **Local dev setup** — Support local Postgres in seed script with conditional Neon/pg driver detection. Changed Docker Compose port to 5433 to avoid OrbStack conflicts.
- **Seed data URL handling** — Added `isBlobUrl()` guard so placeholder URLs from seed data bypass Vercel Blob signing. Allowed placehold.co in CSP and Next.js remote patterns.
- **Playwright tooling** — Switched from Playwright MCP to playwright-cli for browser automation.

---

## 0.1.0 — Feb 22, 2026

### Added

- **Full application implementation** — All 7 phases (25 steps) built in a single implementation pass. 116 source files, ~15,100 lines of TypeScript across 17 routes.
- **Phase 1 (Scaffolding):** Next.js 16 with Turbopack, Drizzle schema (14 tables, 9 enums), Better Auth (specialist + applicant roles), shadcn/ui government theme (navy/gold/slate), ESLint/Prettier/Husky/Vitest/Playwright tooling.
- **Phase 2 (AI Pipeline):** Google Cloud Vision OCR for word-level bounding polygons, GPT-5 Mini classification via AI SDK structured output, field comparison engine (exact/fuzzy/normalized matching with Dice coefficient), TTB config files (beverage types, class/type codes, health warning text, qualifying phrases).
- **Phase 3 (Core UI):** Validation form with React Hook Form + dropzone + Vercel Blob upload, annotated image viewer with SVG bounding box overlays + CSS transform zoom/pan, side-by-side field comparison with character-level diff highlighting, paginated validation history with nuqs URL state, role-aware dashboard.
- **Phase 4 (Review Queue):** Review list with priority/FIFO ordering, review detail with per-field override controls, human review audit trail.
- **Phase 5 (Specialist Bulk Approval):** Dashboard splits pending labels into "Ready to Approve" and "Needs Review" queues for efficient triage.
- **Phase 6 (Applicants/Reports/Settings):** Applicant list with compliance stats and risk badges, reports page with Recharts charts, settings page with confidence threshold slider and per-field strictness toggles.
- **Phase 7 (Polish):** Security headers (CSP, HSTS, X-Frame-Options), robots.txt, input sanitization, Vercel Analytics, loading skeletons and error boundaries per route, seed script (~1,000 labels), Docker Compose for local Postgres.

---

## 0.0.1 — Feb 22, 2026

### Added

- **Planning documentation** — Implementation plan (25 steps, 7 phases, 20+ key decisions), architecture document with system diagrams and DB schema, engineering decisions with rationale, TTB research context, test workflow definitions (150+ test cases), README with setup instructions.
- **Risk mitigation update** — Replaced GPT-5.2 fallback strategy with human review routing for low-confidence AI extractions (cheaper, more reliable for a prototype).
- **Project naming** — Chose "Excisely" (excise + precisely) with documented alternatives.
