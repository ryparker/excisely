# Excisely — Decisions & Trade-offs

This document explains the major engineering decisions, scope choices, known limitations, and assumptions behind this prototype. The goal is to show thoughtful decision-making — not just what we built, but why.

---

## 1. Engineering Decisions

### Hybrid AI Pipeline: Google Cloud Vision + GPT-5 Mini

**Chosen:** Two-stage pipeline -- Cloud Vision for OCR with pixel-accurate bounding boxes, then GPT-5 Mini for semantic field classification on the extracted text.

**Alternatives considered:**

- Single LLM (GPT-5.2 vision) for both OCR and classification
- Gemini 2.5 Pro (best LLM at mAP 13.3 for bounding boxes)
- Tesseract or other open-source OCR

**Reasoning:** GPT-5.2 vision has an mAP50:95 of 1.5 for bounding boxes -- the worst of any frontier model (per Roboflow benchmarks). That means bounding box overlays on the label image would be unreliable, undermining the annotated-image UI that specialists need. Google Cloud Vision is purpose-built for OCR: pixel-accurate word-level bounding polygons, sub-second latency, and $0.0015/image. By splitting OCR from classification, we can use GPT-5 Mini for the reasoning step -- it only receives text (no image tokens), making it 7x cheaper than GPT-5.2 ($0.25 vs $1.75 per 1M input tokens). Total cost per label drops from ~$0.0105 to ~$0.003. Total latency stays under 5 seconds (Cloud Vision <1s + GPT-5 Mini ~1-2s), meeting Sarah's "5-second or nobody will use it" requirement from the pilot vendor disaster.

### Next.js 16 with App Router (RSC-First)

**Chosen:** React Server Components by default, client components only for interactivity (file uploads, image annotations, forms).

**Alternatives considered:**

- Traditional SPA (React + Vite)
- Next.js Pages Router
- Remix

**Reasoning:** RSC eliminates client-side data fetching entirely -- label data, validation results, and dashboard stats load on the server with zero client-side waterfalls. Server Actions replace exposed API routes for all mutations, reducing the attack surface. This is a data-heavy internal tool where most pages display read-only results; RSC is the natural fit. Next.js 16 specifically gives us Turbopack (2-5x faster builds), `proxy.ts` running on Node.js runtime (not Edge), and `use cache` for explicit caching control.

### Drizzle ORM over Prisma

**Chosen:** Drizzle ORM with Neon Postgres (`@neondatabase/serverless`).

**Alternatives considered:**

- Prisma (heavier ORM, larger bundle, slower cold starts on serverless)
- Raw SQL with `pg` driver
- Kysely (query builder)

**Reasoning:** Drizzle is SQL-first and lightweight -- ideal for a prototype where we want the full power of SQL without the overhead of Prisma's client generation and migration engine. `$inferSelect`/`$inferInsert` derive TypeScript types directly from the schema, and `drizzle-orm/zod` auto-generates Zod validation schemas. This makes `schema.ts` the single source of truth for database structure, TypeScript types, and runtime validation -- zero manual type maintenance. Neon's serverless driver means no connection pooling headaches on Vercel.

### Nano IDs over UUIDs

**Chosen:** 21-character nanoid strings for all primary keys (e.g., `V1StGXR8_Z5jdHi6B-myT`).

**Alternatives considered:**

- UUID v4 (36 characters with hyphens)
- CUID2
- Auto-increment integers

**Reasoning:** Nano IDs are shorter (21 vs 36 chars), URL-friendly (no hyphens to encode), produce smaller database indexes, and are collision-resistant (1% probability of collision after generating 1 billion IDs per second for 149 years). They work well in URLs like `/history/V1StGXR8_Z5jdHi6B-myT` without encoding issues. Generated in application code via `$defaultFn(() => nanoid())` on Drizzle schema definitions.

### Better Auth over NextAuth / Clerk

**Chosen:** Better Auth v1.4 with Drizzle adapter, email/password login, session-based auth.

**Alternatives considered:**

- NextAuth/Auth.js (complex configuration, frequent breaking changes)
- Clerk (SaaS vendor lock-in, overkill for prototype)
- Roll-our-own JWT auth

**Reasoning:** Better Auth is simpler to configure, self-hosted (no vendor dependency), and integrates directly with Drizzle ORM. For a prototype with 6 pre-provisioned test accounts and two roles (specialist/applicant), we need reliable session management without the configuration overhead of NextAuth or the cost/lock-in of Clerk. Sessions use 30-day expiry with 1-day refresh, and every server action validates the session before executing.

### Vercel AI SDK (Not Raw OpenAI SDK)

**Chosen:** `ai` v6 + `@ai-sdk/openai` provider for the GPT-5 Mini classification stage.

**Alternatives considered:**

- Raw `openai` SDK (direct API calls)
- LangChain (heavy abstraction layer)

**Reasoning:** The Vercel AI SDK provides `generateText` + `Output.object()` with Zod schema enforcement -- structured outputs with automatic retry on schema validation failures. It is provider-agnostic, so swapping GPT-5 Mini for another model (or another provider entirely) requires changing one line. The SDK handles token counting, usage tracking, and streaming natively. LangChain was rejected as too heavy for a single-provider, single-model use case.

### No AI Gateway

**Chosen:** Direct API calls to OpenAI and Google Cloud Vision -- no intermediate proxy.

**Alternatives considered:**

- Vercel AI Gateway
- Portkey, Helicone, or similar AI proxy

**Reasoning:** We use exactly two AI providers (Cloud Vision for OCR, OpenAI for classification) with no fallback routing, A/B testing, or multi-provider load balancing. An AI gateway would add latency to every request for zero benefit. Usage tracking is handled by the AI SDK's built-in `usage` response field. If this were production with multiple models and providers, a gateway would make sense.

### React Hook Form over Formik / Native Forms

**Chosen:** React Hook Form v7 with `@hookform/resolvers` (Zod resolver).

**Alternatives considered:**

- Formik (heavier, more re-renders)
- Native HTML forms with manual state management
- Conform (newer, less ecosystem support)

**Reasoning:** The label validation form has 15+ dynamic fields that change based on beverage type selection. React Hook Form uses uncontrolled inputs by default, which means minimal re-renders as the user types -- critical for a form this complex. The Zod resolver provides client-side validation that mirrors the server-side Zod schemas used in server actions (same validation logic, both sides). Server actions always re-validate independently -- never trust the client.

### Lazy Deadline Expiration (No Cron Jobs)

**Chosen:** `getEffectiveStatus()` computes the true label status inline by checking `correction_deadline` against the current time. Fire-and-forget DB update on page load.

**Alternatives considered:**

- Cron job to expire deadlines (requires Vercel Cron or external scheduler)
- Database triggers
- Background job queue (BullMQ, Inngest)

**Reasoning:** On Vercel serverless, cron jobs are limited to specific intervals and add infrastructure complexity. Our approach is simpler and always accurate: when any code path reads a label's status, `getEffectiveStatus()` checks if the correction deadline has passed and returns the effective status (e.g., `needs_correction` with an expired 30-day deadline becomes `rejected`). A fire-and-forget DB update persists the transition so the database eventually converges. There is no window where a user sees stale data -- the status is computed fresh on every read. The only trade-off is that the `status` column in the database may be temporarily stale between page loads, but this has no user-visible impact.

### Client-Side Blob Uploads

**Chosen:** `@vercel/blob/client` for direct browser-to-Blob uploads with per-file progress tracking.

**Alternatives considered:**

- Server-side uploads via server actions (limited to 4.5MB body size)
- Pre-signed S3 URLs
- Uploadthing

**Reasoning:** Server actions in Next.js have a 4.5MB request body limit. Label images can be up to 10MB each, and batch uploads may include 300+ files. Client-side direct uploads bypass this limit entirely -- the browser uploads directly to Vercel Blob's CDN after receiving a short-lived token from our API route (which validates auth and MIME types). `p-limit` controls concurrency to 5 parallel uploads to avoid overwhelming the browser or network.

### CSS Transforms for Image Zoom/Pan

**Chosen:** Custom implementation using `transform: scale() translate()` -- approximately 80 lines of code.

**Alternatives considered:**

- react-zoom-pan-pinch (40KB+ bundle)
- panzoom library
- OpenSeadragon (overkill for single images)

**Reasoning:** The annotated image viewer needs wheel-to-zoom, drag-to-pan, and programmatic "zoom to field" (when clicking a comparison row). These three behaviors are straightforward with CSS transforms on a container div wrapping the image and SVG overlay. Adding a library for this would bring in 40KB+ of JavaScript for functionality we can implement in ~80 lines. The custom approach also gives us precise control over the "zoom to bounding box" animation when a specialist clicks a field in the comparison checklist.

### Zustand + nuqs for State Management

**Chosen:** Zustand v5 for ephemeral client state, nuqs v2.8 for URL-persisted state.

**Alternatives considered:**

- React Context (provider nesting, performance issues with frequent updates)
- Jotai/Recoil (atomic state -- more complex than needed)
- URL state only (insufficient for transient UI state)

**Reasoning:** Two distinct state categories require different solutions. Zustand handles ephemeral UI state: image annotation interactions (zoom level, active field, pan position), batch upload progress, and review session state. These are transient -- they reset on navigation and don't belong in the URL. nuqs handles persistent filter/navigation state: table filters (status, date range, applicant), pagination, and sort order. These are URL-backed, which means filters survive page refresh, are shareable via URL, and work with React Server Components via `createSearchParamsCache`. The boundary is clean: if state should survive a page refresh or be shareable, it goes in nuqs. Everything else goes in Zustand.

### Tailwind CSS v4 + shadcn/ui

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
- **Communication reports** -- Auto-generated approval/rejection notices with copy-to-clipboard, ready to paste into email
- **Keyboard shortcuts** -- Queue processing shortcuts (A/R/C/J/K/N/P) for high-throughput review

### What We Deferred (Stretch -- Phases 4-7)

These features add depth but are not required for a complete demonstration:

| Feature                                          | Why Deferred                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Review queue & specialist assignment**         | The validation detail page already shows flagged fields -- a dedicated queue page adds workflow optimization, not core functionality |
| **Batch upload (300+ labels)**                   | Single-label validation proves the AI pipeline works; batch is a scaling concern                                                     |
| **Applicant management & compliance reputation** | Useful for institutional memory, but not required to demonstrate AI verification                                                     |
| **Reports page with charts**                     | Validation results are visible on detail pages; aggregate reporting is a nice-to-have                                                |
| **Revalidation & resubmission linking**          | Demonstrates workflow maturity but not core AI accuracy                                                                              |

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
| **Email delivery**              | "Send Report" button is visible but disabled with a BETA badge. The copy-to-clipboard workflow demonstrates the intended UX without requiring email infrastructure     |

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
