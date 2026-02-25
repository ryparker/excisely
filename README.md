# <img src="src/app/icon.svg" width="28" height="28" alt="Excisely icon" /> Excisely

**Label verification, precisely.**

![](docs/screenshots/applicant/upload.gif)

AI-powered alcohol label verification for TTB labeling specialists. Compares uploaded label images against COLA application data (Form 5100.31) using Google Cloud Vision OCR + OpenAI GPT-4.1 classification, with annotated image overlays and field-by-field comparison.

**[Live app](https://excisely.vercel.app)** | **[Submission guide](./SUBMISSION.md)** — walkthrough, screenshots, and interesting scenarios to try

> **Why "Excisely"?** In 1791, Alexander Hamilton created the excise tax on whiskey — the origin of federal alcohol regulation and the direct ancestor of TTB. "Excisely" blends "excise" with "precisely." [Full story](./docs/naming.md)

## Quick Start

```bash
git clone https://github.com/ryparker/excisely.git && cd excisely
yarn install
cp .env.example .env.local   # then fill in credentials (see below)
yarn db:push && yarn db:seed  # create tables + seed ~1,000 labels
yarn dev                      # http://localhost:3000
```

### Prerequisites

- Node.js 22+ and Yarn
- PostgreSQL ([Neon](https://neon.tech) recommended)
- OpenAI API key, Google Cloud Vision credentials, Vercel Blob token

### Test Accounts

| Role       | Email                         | Password      |
| ---------- | ----------------------------- | ------------- |
| Specialist | sarah.chen@ttb.gov            | specialist123 |
| Applicant  | labeling@oldtomdistillery.com | applicant123  |

## How It Works

1. **Applicant uploads label images** — AI extracts text via Cloud Vision OCR, classifies fields via GPT-4.1, and pre-fills the form (~5-9s)
2. **Applicant reviews, corrects, and submits** — gets instant AI verification (approved, needs correction, etc.)
3. **Specialist opens the submission** — AI analysis is already done. Annotated images, field comparison, and the AI's recommendation are ready. They approve or override.

The specialist never waits for AI. The applicant gets instant feedback.

### Field Comparison

Each extracted field is compared using a field-appropriate strategy:

| Field           | Strategy    | Example                            |
| --------------- | ----------- | ---------------------------------- |
| Health Warning  | Exact match | Case-sensitive, word-for-word      |
| Brand Name      | Fuzzy match | "STONE'S THROW" = "Stone's Throw"  |
| Alcohol Content | Normalized  | "45% Alc./Vol. (90 Proof)" = "45%" |
| Net Contents    | Normalized  | "750 mL" = "750ml" = "0.75L"       |

Results show color-coded bounding box overlays (green = match, red = mismatch) with character-level diff highlighting. Clicking a field zooms the image to that region.

## Stack

| Layer     | Technology                                                         |
| --------- | ------------------------------------------------------------------ |
| Framework | Next.js 16 (App Router, RSC-first, Turbopack)                      |
| Language  | TypeScript (strict mode)                                           |
| Styling   | Tailwind CSS v4 + shadcn/ui                                        |
| Database  | Drizzle ORM + Neon Postgres                                        |
| Storage   | Vercel Blob (signed URLs, client-side direct uploads)              |
| AI        | Google Cloud Vision (OCR) + OpenAI GPT-4.1 / GPT-5 Mini via AI SDK |
| Auth      | Better Auth v1.4 (specialist + applicant roles)                    |
| Testing   | Vitest (133 tests) + Playwright                                    |

## Commands

```bash
yarn dev                # Dev server (Turbopack)
yarn build && yarn start # Production build + serve
yarn lint               # ESLint
yarn test               # Vitest watch mode
yarn test:e2e           # Playwright E2E
yarn db:seed            # Seed ~1,000 labels
yarn db:studio          # Drizzle Studio (web UI)
```

## Environment Variables

```bash
DATABASE_URL=                        # Neon Postgres connection string
OPENAI_API_KEY=                      # OpenAI API key
GOOGLE_APPLICATION_CREDENTIALS=      # Path to GCP service account JSON (local dev)
GOOGLE_APPLICATION_CREDENTIALS_JSON= # GCP SA JSON content (Vercel deployment)
BLOB_READ_WRITE_TOKEN=               # Vercel Blob storage token
BETTER_AUTH_SECRET=                   # Session secret (openssl rand -hex 32)
BETTER_AUTH_URL=                      # App URL (http://localhost:3000 in dev)
```

## Documentation

| Document                                       | Description                                                    |
| ---------------------------------------------- | -------------------------------------------------------------- |
| **[SUBMISSION.md](./SUBMISSION.md)**           | **Start here** — walkthrough, screenshots, cost analysis       |
| [docs/architecture.md](./docs/architecture.md) | System diagrams, data flow, DB schema                          |
| [docs/ai-pipelines.md](./docs/ai-pipelines.md) | AI pipeline deep dive — 5 pipelines, models, comparison engine |
| [docs/decisions.md](./docs/decisions.md)       | 14 engineering decisions with rationale                        |
| [docs/production.md](./docs/production.md)     | Production readiness gaps (security, scale, FedRAMP)           |
| [docs/changelog.md](./docs/changelog.md)       | What changed and why                                           |

## License

Built as a take-home assessment. Not licensed for production use.
