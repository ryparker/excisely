# Excisely

**Label verification, precisely.**

AI-powered alcohol label verification tool for TTB labeling specialists. Compares label images against COLA application data (Form 5100.31) using a hybrid AI pipeline (Google Cloud Vision OCR + GPT-5 Mini classification).

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack, `proxy.ts`, `use cache`, React 19.2)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 (CSS-first config, `@theme` directive) + shadcn/ui (new-york style)
- **Animation:** Motion (framer-motion v12)
- **Database:** Drizzle ORM + Neon Postgres (`@neondatabase/serverless`)
- **Storage:** Vercel Blob (signed URLs, client-side direct uploads via `@vercel/blob/client`)
- **AI:** Hybrid pipeline — Google Cloud Vision (`@google-cloud/vision`) for OCR + bounding boxes, GPT-5 Mini (`ai` + `@ai-sdk/openai`) for field classification via `generateText` + `Output.object()` + Zod schemas
- **Forms:** React Hook Form v7 + `@hookform/resolvers` (Zod resolver)
- **State:** Zustand v5 (client stores) + nuqs v2.8 (URL search params)
- **Auth:** Better Auth v1.4 (admin + specialist roles, session-based)
- **IDs:** nanoid (21-char, URL-friendly) — no UUIDs
- **Analytics:** Vercel Analytics
- **Theme:** next-themes (light/dark mode)
- **Testing:** Vitest + React Testing Library (unit/integration), Playwright (E2E)
- **Package Manager:** Yarn

## Commands

```bash
yarn dev                # Start dev server (Turbopack)
yarn build              # Production build
yarn start              # Start production server
yarn lint               # ESLint (flat config — no `next lint` in Next.js 16)
yarn lint:fix           # ESLint autofix
yarn format             # Prettier format all files
yarn format:check       # Prettier check (CI)
yarn test               # Vitest watch mode
yarn test:coverage      # Vitest with V8 coverage
yarn test:e2e           # Playwright E2E tests
yarn knip               # Find unused files, exports, dependencies
yarn db:generate        # Generate Drizzle migrations from schema changes
yarn db:migrate         # Run pending migrations
yarn db:seed            # Seed database with ~1,000 sample labels
yarn db:studio          # Open Drizzle Studio (web UI)
```

## Database Access (Read-Only)

Use `psql` for all database inspection. **Never run mutating queries** (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE).

```bash
# Quick connection test
psql "$DATABASE_URL" -c "SELECT count(*) FROM labels;"

# Schema source of truth is src/db/schema.ts
```

Use the `/db-inspect` skill for common queries — it has ready-made queries for counts, labels by status, applicant stats, review queue, validation items, and more.

## Architecture Rules

1. **RSC by default** — everything is a React Server Component unless it needs interactivity
2. **`'use client'` only for interactivity** — file upload dropzone, image annotations, form inputs, charts
3. **All mutations via Server Actions** with Zod validation — no exposed API routes
4. **Every server action starts with `getSession()`** — reject unauthenticated requests before any logic
5. **Admin-only actions check `session.user.role === 'admin'`** — specialists are blocked from settings, admin dashboard
6. **No raw SQL** — all queries through Drizzle's parameterized query builder
7. **`proxy.ts` (not middleware.ts)** — Next.js 16 renamed middleware to proxy, runs on Node.js runtime
8. **File uploads validated** — MIME type + file extension + magic byte verification + 10MB size limit
9. **Nano IDs everywhere** — all PKs use `nanoid()` via `$defaultFn`, never UUID. Exception: Better Auth managed tables.
10. **Types from schema** — derive TypeScript types via `$inferSelect`/`$inferInsert` and Zod schemas via `drizzle-orm/zod`. No manual type files.
11. **Zustand for client state, nuqs for URL state** — Zustand stores for ephemeral UI state (annotations, uploads, reviews). nuqs for persistent filter/pagination/sort state (URL-backed, shareable, RSC-compatible).
12. **AI: Hybrid pipeline** — Stage 1: `@google-cloud/vision` for OCR + pixel-accurate bounding boxes. Stage 2: `generateText` + `Output.object()` from `ai` with `@ai-sdk/openai` provider, model `openai('gpt-5-mini')` for text classification. No AI Gateway. Use `.nullable()` not `.optional()` in Zod schemas (OpenAI structured output limitation).
13. **Migrations forward-only** — `drizzle-kit push` in dev, `drizzle-kit generate` + `drizzle-kit migrate` for production. No down migrations.
14. **No dotenv** — Next.js handles `.env` / `.env.local` natively. Use `NEXT_PUBLIC_` prefix only for client-exposed vars.
15. **React Hook Form for all multi-field forms** — `useForm` + `zodResolver` for client-side validation. Server actions re-validate independently.
16. **Lazy deadline expiration** — no cron jobs. `getEffectiveStatus()` computes true status inline from `correction_deadline`. Fire-and-forget DB update on page load.
17. **Bounding boxes are pixel-accurate** — Google Cloud Vision provides word-level bounding polygons. No fallback/degradation needed. Every detected text region has exact coordinates.
18. **Next.js file conventions** — every route group has `loading.tsx` (Suspense skeleton), `error.tsx` (error boundary), `not-found.tsx`. Root has `global-error.tsx`.
19. **Rate limiting deferred** — not implemented for prototype. Production would use `@upstash/ratelimit` + Upstash Redis.

## TTB Vocabulary

Use TTB's exact terminology everywhere — UI, code, comments, variable names.

| Correct | Incorrect |
|---------|-----------|
| Labeling Specialist | Agent, Reviewer |
| Health Warning Statement / GOVERNMENT WARNING | Government warning |
| Alcohol Content | ABV (in form context) |
| Type of Product | Beverage type |
| Fanciful Name (Item 7) | Subtitle, tagline |
| Brand Name (Item 6) | Trade name |
| Name and Address (Item 8) | Producer info |
| Qualifying Phrase | Producer type |
| Needs Correction | Failed, needs review |
| Conditionally Approved | Partial approval |
| Class/Type Code | Category number |
| Serial Number (Item 4) | Application number |

## User Roles & Test Accounts

| Role | Name | Email | Password |
|------|------|-------|----------|
| Admin | Sarah Chen | sarah.chen@ttb.gov | admin123 |
| Specialist (senior) | Dave Morrison | dave.morrison@ttb.gov | specialist123 |
| Specialist (junior) | Jenny Park | jenny.park@ttb.gov | specialist123 |
| Specialist | Marcus Williams | marcus.williams@ttb.gov | specialist123 |
| Specialist | Janet Torres | janet.torres@ttb.gov | specialist123 |
| Specialist | Robert Kim | robert.kim@ttb.gov | specialist123 |
| Specialist (part-time) | Lisa Chen | lisa.chen@ttb.gov | specialist123 |

## Label Statuses

```
Received → Processing → Approved
                      → Conditionally Approved (7-day correction window)
                      → Needs Correction (30-day correction window)
                      → Rejected
```

## Key Files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Database schema — single source of truth for all tables, types (`$inferSelect`/`$inferInsert`), and Zod schemas (`drizzle-orm/zod`) |
| `src/app/actions/` | Server actions — all mutations live here |
| `src/lib/ai/ocr.ts` | Stage 1: Google Cloud Vision OCR — word-level bounding polygons |
| `src/lib/ai/classify-fields.ts` | Stage 2: GPT-5 Mini field classification — text-only input |
| `src/lib/ai/extract-label.ts` | AI pipeline orchestrator — runs OCR → classification → merges bounding boxes |
| `src/lib/labels/effective-status.ts` | Lazy deadline expiration — `getEffectiveStatus()` |
| `src/lib/ai/compare-fields.ts` | Field comparison engine (fuzzy, strict, normalized) |
| `src/lib/ai/prompts.ts` | Classification prompts (beverage-type-aware) |
| `src/config/beverage-types.ts` | Mandatory fields + valid sizes per product type |
| `src/config/class-type-codes.ts` | TTB numeric class/type codes (0-999) |
| `src/config/health-warning.ts` | Exact GOVERNMENT WARNING text + formatting rules |
| `src/config/qualifying-phrases.ts` | "Bottled by", "Distilled by", etc. |
| `proxy.ts` | Auth checks, redirects, security headers |
| `.claude/plans/20260221-ai-label-verification-app.md` | Full implementation plan |
| `.claude/plans/test-workflows.md` | 150+ test cases by feature area |
| `CONTEXT.md` | TTB research — vocabulary, Form 5100.31 fields, regulations |

## Available Skills

| Skill | When to Use |
|-------|-------------|
| `/db-inspect` | Check database state, verify data, debug queries |
| `/check-deployment` | Verify Vercel deployment health |
| `/test-page <url>` | Test a page or flow with Playwright screenshots |
| `/run-all-tests-and-fix` | Run test suite and fix failures |
| `/improve-design-of-page <url>` | Iteratively improve page design via screenshots |
| `/security-audit` | Comprehensive security review |
| `/code-review-checklist` | Code review before merge |
| `/vercel-react-best-practices` | Performance optimization check |
| `/commit-and-push` | Create descriptive commit and push |
| `/create-pr` | Create well-structured pull request |

## Environment Variables

```bash
DATABASE_URL=              # Neon Postgres connection string
OPENAI_API_KEY=            # OpenAI API key (used by @ai-sdk/openai provider for GPT-5 Mini)
GOOGLE_APPLICATION_CREDENTIALS=  # Path to Google Cloud service account JSON (for Cloud Vision OCR)
BLOB_READ_WRITE_TOKEN=     # Vercel Blob storage token
BETTER_AUTH_SECRET=        # Better Auth session secret
BETTER_AUTH_URL=           # App URL (http://localhost:3000 in dev)
# Note: .env.local for local secrets, .env for defaults. No dotenv package needed.
# For Vercel deployment: set GOOGLE_APPLICATION_CREDENTIALS_JSON env var with the JSON content,
# then parse it at runtime (Cloud Vision client accepts credentials object directly).
```
