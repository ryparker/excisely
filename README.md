# Excisely

**Label verification, precisely.**

AI-powered alcohol label verification for TTB labeling specialists. Compares uploaded label images against COLA application data (Form 5100.31) using a hybrid AI pipeline — Google Cloud Vision for pixel-accurate OCR, GPT-5 Mini for semantic field classification — with annotated image overlays and field-by-field comparison.

Built as a prototype to demonstrate how AI can reduce the 5-10 minute manual label review process to under 5 seconds.

> **Why "Excisely"?** In 1791, Alexander Hamilton created the excise tax on whiskey — the origin of federal alcohol regulation and the direct ancestor of TTB. "Excisely" blends "excise" with "precisely": the AI checks labels with precision, powered by the same regulatory authority Hamilton established 235 years ago. See [docs/naming.md](./docs/naming.md) for the full story.

## Quick Start

### Prerequisites

- Node.js 22+ (via `mise use node@22`)
- Yarn (`corepack enable && corepack prepare yarn@stable --activate`)
- PostgreSQL database ([Neon](https://neon.tech) recommended)
- OpenAI API key (GPT-5 Mini)
- Google Cloud Vision API credentials
- Vercel Blob storage token

### Setup

```bash
# Clone the repository
git clone https://github.com/ryparker/excisely.git
cd excisely

# Install dependencies
yarn install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your credentials
# DATABASE_URL, OPENAI_API_KEY, GOOGLE_APPLICATION_CREDENTIALS,
# BLOB_READ_WRITE_TOKEN, BETTER_AUTH_SECRET, BETTER_AUTH_URL

# Push database schema (development)
yarn db:push

# Seed with ~1,000 sample labels
yarn db:seed

# Start development server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with a test account.

### Test Accounts

| Role       | Name          | Email                 | Password      |
| ---------- | ------------- | --------------------- | ------------- |
| Admin      | Sarah Chen    | sarah.chen@ttb.gov    | admin123      |
| Specialist | Dave Morrison | dave.morrison@ttb.gov | specialist123 |
| Specialist | Jenny Park    | jenny.park@ttb.gov    | specialist123 |

## How It Works

### 1. Upload & Enter Application Data

A labeling specialist uploads 1-4 label images (front, back, neck, strip) and enters the corresponding Form 5100.31 application data — brand name, alcohol content, health warning statement, etc. The form is beverage-type-aware: selecting "Wine" surfaces wine-specific fields (sulfite declaration, appellation of origin, grape varietal).

### 2. Hybrid AI Pipeline

The system processes each label through two stages:

**Stage 1 — Google Cloud Vision OCR** (<1 second, $0.0015/image)

- Extracts every word on the label with pixel-accurate bounding polygons (4 vertices per word)
- Runs on each image in parallel

**Stage 2 — GPT-5 Mini Classification** (~1-2 seconds, ~$0.0015/label)

- Receives OCR text only (no image tokens — fast and cheap)
- Classifies text blocks into TTB regulatory fields (brand name, alcohol content, health warning, etc.)
- Each classified field inherits bounding box coordinates from Stage 1

Total: **~$0.003/label, 2-4 seconds.**

### 3. Field Comparison

Each extracted field is compared against the application data using field-appropriate strategies:

| Field             | Strategy    | Example                            |
| ----------------- | ----------- | ---------------------------------- |
| Health Warning    | Exact match | Case-sensitive, word-for-word      |
| Brand Name        | Fuzzy match | "STONE'S THROW" = "Stone's Throw"  |
| Alcohol Content   | Normalized  | "45% Alc./Vol. (90 Proof)" = "45%" |
| Net Contents      | Normalized  | "750 mL" = "750ml" = "0.75L"       |
| Qualifying Phrase | Enum match  | "Bottled by" = "BOTTLED BY"        |

### 4. Annotated Results

The results page shows the label image with color-coded bounding box overlays (green = match, red = mismatch, yellow = uncertain) alongside a field-by-field comparison table with character-level diff highlighting. Clicking a field in the comparison zooms the image to that region.

Labels are assigned a TTB status:

- **Approved** — all fields match
- **Conditionally Approved** — minor discrepancies (7-day correction window)
- **Needs Correction** — substantive mismatch (30-day correction window)
- **Rejected** — fundamental issues (missing health warning, illegal container size)

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system diagrams, data flow, database schema, and module descriptions.

### Stack

- **Framework:** Next.js 16 (App Router, RSC-first, Turbopack)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 + shadcn/ui + Source Serif 4 / Inter / JetBrains Mono
- **Database:** Drizzle ORM + Neon Postgres
- **Storage:** Vercel Blob (signed URLs, client-side direct uploads)
- **AI:** Google Cloud Vision (OCR) + GPT-5 Mini via Vercel AI SDK v6
- **Auth:** Better Auth v1.4 (admin + specialist roles)
- **Forms:** React Hook Form v7 + Zod
- **State:** Zustand v5 (client) + nuqs v2.8 (URL params)
- **Testing:** Vitest + React Testing Library + Playwright

## Commands

```bash
yarn dev                # Start dev server (Turbopack)
yarn build              # Production build
yarn start              # Start production server
yarn lint               # ESLint
yarn lint:fix           # ESLint autofix
yarn format             # Prettier format
yarn test               # Vitest watch mode
yarn test:coverage      # Vitest with V8 coverage
yarn test:e2e           # Playwright E2E tests
yarn db:generate        # Generate Drizzle migrations
yarn db:migrate         # Run pending migrations
yarn db:seed            # Seed database (~1,000 labels)
yarn db:studio          # Open Drizzle Studio
yarn knip               # Find unused code
```

## Engineering Decisions

See [DECISIONS.md](./DECISIONS.md) for detailed rationale on all technical choices, scope decisions, known limitations, and assumptions.

Key decisions:

- **Hybrid AI pipeline** over single-model — Cloud Vision provides pixel-accurate bounding boxes (GPT-5.2 vision has mAP 1.5, worst frontier model), GPT-5 Mini handles text classification at 7x lower cost
- **RSC-first** — server components for data loading, server actions for mutations, zero client-side waterfalls
- **Lazy deadline expiration** — `getEffectiveStatus()` computes true status inline, no cron infrastructure needed
- **Nano IDs** — shorter than UUIDs, URL-friendly, smaller indexes

## Scope

**MVP (implemented):** Auth, single label validation, annotated results, history, dashboard, keyboard shortcuts, communication reports.

**Deferred:** Review queue, batch upload (300+ labels), applicant management, admin analytics, settings management, PDF export.

See [DECISIONS.md](./DECISIONS.md) for full scope rationale.

## Environment Variables

```bash
DATABASE_URL=                        # Neon Postgres connection string
OPENAI_API_KEY=                      # OpenAI API key (GPT-5 Mini)
GOOGLE_APPLICATION_CREDENTIALS=      # Path to GCP service account JSON (local)
GOOGLE_APPLICATION_CREDENTIALS_JSON= # GCP SA JSON content (Vercel deployment)
BLOB_READ_WRITE_TOKEN=               # Vercel Blob storage token
BETTER_AUTH_SECRET=                   # Session secret
BETTER_AUTH_URL=                      # App URL (http://localhost:3000 in dev)
```

## License

This project was built as a take-home assessment and is not licensed for production use.
