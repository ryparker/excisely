# Excisely — Architecture

AI-powered alcohol label verification tool for TTB (Alcohol and Tobacco Tax and Trade Bureau) labeling specialists. Compares uploaded label images against COLA application data (TTB Form 5100.31) using a hybrid AI pipeline: Google Cloud Vision for pixel-accurate OCR, then GPT-5 Mini for semantic field classification.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Directory Structure](#directory-structure)
4. [Data Flow — Core Validation Workflow](#data-flow)
5. [Database Schema](#database-schema)
6. [Key Modules](#key-modules)
7. [Security Model](#security-model)
8. [Deployment](#deployment)

---

## System Overview

The application enables TTB labeling specialists to verify that physical alcohol beverage labels comply with the information submitted on Form 5100.31 (Certificate of Label Approval application). Instead of manually comparing printed labels against form data — a process that takes 5-10 minutes per label — the tool uses AI to extract text from label images, classify it into regulatory fields, and compare it against application data in under 5 seconds.

The system handles three beverage types (distilled spirits, wine, malt beverages), each with different mandatory fields, container size regulations, and formatting requirements. It supports single-label validation, batch uploads of 300+ labels, human review queues for low-confidence results, revalidation, resubmission tracking, and communication report generation.

```
+------------------------------------------------------------------+
|                        SYSTEM OVERVIEW                           |
+------------------------------------------------------------------+
|                                                                  |
|   Specialist / Admin                                             |
|        |                                                         |
|        v                                                         |
|   +------------------+     +----------------------------------+  |
|   |   Browser        |     |   Next.js 16 App                 |  |
|   |                  |     |   (React Server Components)      |  |
|   |  - Login         |     |                                  |  |
|   |  - Upload images |---->|  proxy.ts (auth + headers)       |  |
|   |  - Enter form    |     |       |                          |  |
|   |    data          |     |       v                          |  |
|   |  - Review        |     |  Server Actions (Zod-validated)  |  |
|   |    results       |     |       |                          |  |
|   |  - Approve /     |     |       +--------+--------+       |  |
|   |    reject        |     |       |        |        |       |  |
|   +------------------+     |       v        v        v       |  |
|        ^                   |   +------+ +------+ +-------+  |  |
|        |                   |   | Blob | |  AI  | |  DB   |  |  |
|        |                   |   |Upload| |Hybrid| | Query |  |  |
|        |                   |   +------+ |Pipe- | +-------+  |  |
|        |                   |       |    |line  |     |       |  |
|   +----+---+               |       |    +------+     |       |  |
|   | RSC    |<--------------+-------+--------+--------+       |  |
|   | HTML   |               |                                  |  |
|   +--------+               +----------------------------------+  |
|                                       |            |             |
|                 +---------------------+            |             |
|                 |                                  |             |
|                 v                                  v             |
|   +-------------------------+      +------------------------+   |
|   |  Vercel Blob            |      |  Neon Postgres         |   |
|   |  (Image Storage)        |      |  (Drizzle ORM)         |   |
|   |  - Signed URLs          |      |  - Labels, results     |   |
|   |  - Client-side direct   |      |  - Users, sessions     |   |
|   |    uploads              |      |  - Settings, variants  |   |
|   +-------------------------+      +------------------------+   |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Architecture Diagram

### Request Flow

```
                              BROWSER (Client)
                                    |
                    +---------------+---------------+
                    |                               |
              Page Request                    Server Action
              (GET /history)                  (validateLabel)
                    |                               |
                    v                               v
            +-------------+                 +---------------+
            |  proxy.ts   |                 |  getSession() |
            |  (auth      |                 |  (auth check) |
            |   check +   |                 +-------+-------+
            |   headers)  |                         |
            +------+------+                         v
                   |                        +---------------+
                   v                        |  Zod Input    |
            +-------------+                |  Validation   |
            |  RSC Page   |                +-------+-------+
            |  (async     |                        |
            |   server    |                        v
            |   component)|                 Server Action Logic
            |  - DB query |                 (upload, AI, DB write)
            |  - Render   |                        |
            +------+------+                        v
                   |                         Redirect / Return
                   v
            HTML streamed
            to browser
```

### Hybrid AI Pipeline

```
  +-------------+        +---------------------------+        +-------------------------+
  |  Label      |        |  STAGE 1: Google Cloud    |        |  STAGE 2: GPT-5 Mini   |
  |  Image(s)   |------->|  Vision OCR               |------->|  Field Classification  |
  |             |        |                           |        |                         |
  |  (Vercel    |        |  - TEXT_DETECTION API     |        |  - Text-only input     |
  |   Blob URL) |        |  - Word-level bounding    |        |    (no image tokens)   |
  +-------------+        |    polygons (4 vertices,  |        |  - Vercel AI SDK v6    |
                         |    pixel-accurate)        |        |    generateText +      |
                         |  - Sub-second latency     |        |    Output.object()     |
                         |  - $0.0015/image          |        |  - Zod structured      |
                         +------------+--------------+        |    output schema       |
                                      |                       |  - Classifies text     |
                                      |  OCR Result:          |    into TTB fields     |
                                      |  { words[], fullText }|  - Inherits bbox       |
                                      |                       |    coordinates from    |
                                      +------>  INPUT  ------>|    Stage 1             |
                                                              |  - $0.25/1M in tokens |
                                                              +----------+------------+
                                                                         |
                                                                         v
                                                              +---------------------+
                                                              |  Classified Fields  |
                                                              |  with Bounding      |
                                                              |  Boxes              |
                                                              |                     |
                                                              |  - brand_name       |
                                                              |  - alcohol_content  |
                                                              |  - health_warning   |
                                                              |  - net_contents     |
                                                              |  - name_and_address |
                                                              |  - (etc.)           |
                                                              |                     |
                                                              |  ~$0.003 total/label|
                                                              |  ~2-4s total latency|
                                                              +---------------------+
```

### Authentication Flow

```
  Browser                     proxy.ts                    Better Auth              Neon Postgres
    |                            |                            |                         |
    |--- GET /history ---------->|                            |                         |
    |                            |--- check session cookie -->|                         |
    |                            |                            |--- query sessions ----->|
    |                            |                            |<-- session + user -------|
    |                            |<-- session valid ----------|                         |
    |                            |--- forward to RSC -------->                          |
    |<-- rendered page ----------|                                                      |
    |                                                                                   |
    |--- GET /admin ------------>|                                                      |
    |                            |--- check session + role -->|                         |
    |                            |<-- role: specialist --------|                         |
    |<-- redirect /login --------|  (specialists blocked                                |
    |                               from /admin, /settings)                             |
```

### File Upload Flow (Client-Side Direct-to-Blob)

```
  Browser                     /api/blob/upload              Vercel Blob CDN
    |                            (token exchange)                 |
    |                                |                            |
    |--- request upload token ------>|                            |
    |                                |--- validate session        |
    |                                |--- validate MIME type      |
    |                                |--- generate signed token   |
    |<-- signed upload token --------|                            |
    |                                                             |
    |--- PUT file directly (up to 10MB) ----------------------->|
    |    (bypasses 4.5MB server action body limit)               |
    |    (onUploadProgress callback for progress bars)           |
    |<-- blob URL + metadata ------------------------------------|
    |                                                             |
    |--- server action (blob URL + form data) -------> validate + store in DB
```

---

## Directory Structure

```
excisely/
|
|-- proxy.ts                          # Next.js 16 proxy (replaces middleware.ts)
|                                     # Auth checks, route protection, security headers
|                                     # Runs on Node.js runtime (not Edge)
|
|-- eslint.config.mjs                 # ESLint v10 flat config
|-- .prettierrc                       # Prettier (tailwindStylesheet for v4)
|-- vitest.config.mts                 # Vitest (jsdom, react plugin, tsconfig paths)
|-- vitest.setup.ts                   # Global test setup (Next.js module mocks)
|-- playwright.config.ts              # Playwright E2E config
|-- knip.json                         # Unused code detection
|-- commitlint.config.mjs             # Conventional commit enforcement
|-- drizzle.config.ts                 # Drizzle Kit migration config
|
|-- .husky/
|   |-- pre-commit                    # Runs lint-staged
|   +-- commit-msg                    # Runs commitlint
|
|-- public/
|   |-- favicon.ico                   # 32x32 government-themed shield
|   |-- icon.svg                      # SVG app icon (metadata API)
|   |-- apple-icon.png                # Apple touch icon (180x180)
|   +-- robots.txt                    # Disallow all crawlers
|
|-- e2e/                              # Playwright E2E tests
|   |-- auth.spec.ts
|   |-- validate-label.spec.ts
|   |-- review-queue.spec.ts
|   |-- batch-upload.spec.ts
|   +-- keyboard-shortcuts.spec.ts
|
|-- scripts/
|   +-- fetch-sample-images.ts        # Download TTB COLA registry images for seed data
|
+-- src/
    |
    |-- app/
    |   |-- layout.tsx                # Root layout (providers, nav, theme, metadata)
    |   |-- globals.css               # Tailwind v4 + government theme (@theme directive)
    |   |-- global-error.tsx          # Root error boundary
    |   |-- not-found.tsx             # Global 404 page
    |   |
    |   |-- (auth)/
    |   |   +-- login/
    |   |       +-- page.tsx          # Email/password login (government-themed)
    |   |
    |   |-- (app)/                    # Protected route group (requires session)
    |   |   |-- layout.tsx            # App shell (sidebar, header, auth check)
    |   |   |-- loading.tsx           # Suspense skeleton for protected routes
    |   |   |-- error.tsx             # Error boundary for protected routes
    |   |   |-- not-found.tsx         # 404 for invalid IDs
    |   |   |-- page.tsx              # Dashboard (role-aware: admin vs specialist)
    |   |   |
    |   |   |-- validate/
    |   |   |   +-- page.tsx          # Single label validation form
    |   |   |
    |   |   |-- batch/
    |   |   |   |-- page.tsx          # Batch upload (300+ files)
    |   |   |   +-- [id]/
    |   |   |       +-- page.tsx      # Batch detail / progress
    |   |   |
    |   |   |-- history/
    |   |   |   |-- page.tsx          # Validation history list (paginated)
    |   |   |   +-- [id]/
    |   |   |       +-- page.tsx      # Detail: annotated image + field comparison
    |   |   |
    |   |   |-- review/
    |   |   |   |-- page.tsx          # Review queue (filterable, FIFO)
    |   |   |   +-- [id]/
    |   |   |       +-- page.tsx      # Review detail with override controls
    |   |   |
    |   |   |-- applicants/
    |   |   |   |-- page.tsx          # Applicant list (searchable)
    |   |   |   +-- [id]/
    |   |   |       +-- page.tsx      # Applicant detail + compliance stats
    |   |   |
    |   |   |-- reports/
    |   |   |   +-- page.tsx          # Reports dashboard (charts, stats)
    |   |   |
    |   |   |-- admin/                # Admin-only routes
    |   |   |   +-- page.tsx          # Admin dashboard (specialist table, flagged applicants)
    |   |   |
    |   |   +-- settings/
    |   |       +-- page.tsx          # Settings (admin-only: thresholds, strictness, variants)
    |   |
    |   |-- api/
    |   |   |-- auth/
    |   |   |   +-- [...all]/
    |   |   |       +-- route.ts      # Better Auth catch-all handler
    |   |   +-- blob/
    |   |       +-- upload/
    |   |           +-- route.ts      # Vercel Blob client upload token exchange
    |   |
    |   +-- actions/                  # Server Actions (all mutations)
    |       |-- validate-label.ts     # Upload + AI validation pipeline
    |       |-- create-batch.ts       # Batch upload creation
    |       |-- process-batch-item.ts # Process single batch item
    |       |-- submit-review.ts      # Human review override + finalize
    |       |-- revalidate-label.ts   # Re-run AI on existing label
    |       |-- manage-applicants.ts  # Create/update applicants
    |       |-- update-settings.ts    # Save settings changes
    |       |-- manage-variants.ts    # Add/remove accepted variants
    |       |-- submit-correction.ts  # Resubmission linked to prior label
    |       |-- bulk-approve.ts       # Approve all clean labels in batch
    |       +-- delete-label.ts       # Remove label + associated data
    |
    |-- components/
    |   |-- _base/                    # shadcn/ui primitives (button, card, badge, etc.)
    |   |-- auth/                     # Login form, user menu
    |   |-- layout/                   # App header, sidebar, page header
    |   |-- validation/               # Upload form, checklist, annotated image, comparisons
    |   |-- batch/                    # Upload zone, progress bar, results table
    |   |-- review/                   # Queue table, field override controls, notes
    |   |-- communication/            # Report messages, copy/send buttons, email preview
    |   |-- dashboard/                # Stats cards, recent activity, status charts
    |   |-- reports/                  # Trend charts, field accuracy, processing time
    |   |-- applicants/               # Search, table, stats cards
    |   |-- admin/                    # Specialist summary, flagged applicants
    |   |-- shared/                   # Field comparison row, deadline badge, shortcuts bar
    |   +-- settings/                 # Threshold slider, strictness toggles, variant manager
    |
    |-- db/
    |   |-- index.ts                  # Drizzle client initialization
    |   |-- schema.ts                 # Schema definitions (single source of truth)
    |   |-- seed.ts                   # Seed script (~1,000 labels, yarn db:seed)
    |   |-- seed-data/                # Seed data generators (users, applicants, labels, etc.)
    |   +-- migrations/               # SQL migration files (forward-only)
    |
    |-- lib/
    |   |-- ai/
    |   |   |-- ocr.ts                # Stage 1: Google Cloud Vision OCR
    |   |   |-- classify-fields.ts    # Stage 2: GPT-5 Mini field classification
    |   |   |-- extract-label.ts      # Pipeline orchestrator (OCR -> classify -> merge)
    |   |   |-- compare-fields.ts     # Field comparison engine (fuzzy, strict, normalized)
    |   |   +-- prompts.ts            # Classification prompts (beverage-type-aware)
    |   |
    |   |-- reports/
    |   |   |-- generate-report.ts    # Build approval/rejection message from data
    |   |   +-- render-annotated-image.ts  # Server-side bbox overlay on static image
    |   |
    |   |-- storage/
    |   |   +-- blob.ts               # Vercel Blob upload/download helpers
    |   |
    |   |-- validators/
    |   |   |-- label-schema.ts       # Zod schemas for application data
    |   |   |-- file-schema.ts        # File upload validation (type, size, magic bytes)
    |   |   +-- batch-schema.ts       # Batch upload validation
    |   |
    |   |-- settings/
    |   |   +-- get-settings.ts       # Load settings + variants from DB (cached)
    |   |
    |   |-- auth/
    |   |   |-- auth.ts               # Better Auth server config (Drizzle adapter, roles)
    |   |   |-- auth-client.ts        # Better Auth client instance
    |   |   +-- get-session.ts        # Cached session helper for RSC / server actions
    |   |
    |   |-- labels/
    |   |   +-- effective-status.ts   # getEffectiveStatus() — lazy deadline expiration
    |   |
    |   |-- security/
    |   |   +-- sanitize.ts           # Input sanitization utilities
    |   |
    |   +-- utils.ts                  # cn() helper, formatters
    |
    |-- hooks/
    |   |-- use-batch-progress.ts     # Polling hook for batch status
    |   |-- use-image-annotations.ts  # Annotation interaction state
    |   +-- use-keyboard-shortcuts.ts # Keyboard shortcut registration (context-aware)
    |
    |-- stores/                       # Zustand stores
    |   |-- annotation-store.ts       # Image viewer state (active field, zoom, pan)
    |   |-- review-store.ts           # Review session state (overrides, current field)
    |   |-- upload-store.ts           # Batch upload queue (files, progress)
    |   +-- shortcut-store.ts         # Active shortcut context per page
    |
    |-- types/
    |   +-- index.ts                  # Re-exports $inferSelect/$inferInsert from schema
    |
    +-- config/
        |-- constants.ts              # App constants
        |-- beverage-types.ts         # Mandatory fields + valid sizes per product type
        |-- class-type-codes.ts       # TTB numeric class/type codes (0-999)
        |-- qualifying-phrases.ts     # "Bottled by", "Distilled by", "Imported by", etc.
        +-- health-warning.ts         # Required "GOVERNMENT WARNING:" text + formatting rules
```

---

## Data Flow

### Core Validation Workflow

The following describes the end-to-end flow when a labeling specialist validates a single label.

```
STEP 1: Upload + Form Entry
==============================

  Specialist fills out the validation form:
  - Selects Type of Product (Distilled Spirits / Wine / Malt Beverages)
  - Selects Class/Type Code (e.g., 101 = Straight Bourbon Whisky)
  - Enters Total Bottle Capacity in mL
  - Uploads 1-4 label images (front, back, neck, strip)
  - Enters application data fields from Form 5100.31:
    Brand Name, Fanciful Name, Alcohol Content, Net Contents,
    Health Warning Statement, Name and Address, etc.
  - Optionally selects applicant and prior submission (for resubmissions)

  Client-side validation: React Hook Form + zodResolver
  Images upload directly to Vercel Blob via @vercel/blob/client


STEP 2: Server Action Receives Request
=========================================

  validate-label.ts server action:

  1. getSession()          -> Reject if unauthenticated
  2. Zod validation        -> Reject if input malformed
  3. Magic byte check      -> Reject if file is not a real image
  4. Create DB records     -> labels + application_data + label_images


STEP 3: Stage 1 — Google Cloud Vision OCR
============================================

  For each uploaded image (parallel via Promise.all):

  +-----------+      +------------------------+      +------------------+
  | Blob URL  |----->| Cloud Vision           |----->| OCR Result       |
  | (signed)  |      | TEXT_DETECTION          |      |                  |
  +-----------+      |                        |      | words: [         |
                     | - Pixel-accurate       |      |   { text: "JACK",|
                     |   bounding polygons    |      |     bbox: {      |
                     | - Word-level detection |      |       x,y,w,h }, |
                     | - Sub-second latency   |      |     conf: 0.99 },|
                     +------------------------+      |   ...            |
                                                     | ]                |
                                                     | fullText: "..."  |
                                                     +------------------+

  Cost: $0.0015/image    Latency: <1 second


STEP 4: Stage 2 — GPT-5 Mini Field Classification
====================================================

  Combined OCR text from all images -> single generateText call:

  +------------------+      +------------------------+      +--------------------+
  | OCR fullText     |----->| GPT-5 Mini             |----->| Classified Fields  |
  | (text only,      |      | (via Vercel AI SDK v6) |      |                    |
  |  no image        |      |                        |      | brand_name:        |
  |  tokens)         |      | generateText +         |      |   "JACK DANIEL'S"  |
  |                  |      | Output.object() +      |      |   word_indices:    |
  | + beverage type  |      | Zod schema             |      |     [0, 1]         |
  |   context        |      |                        |      |   confidence: 0.97 |
  +------------------+      | Prompt is beverage-    |      |                    |
                             | type-aware (knows      |      | alcohol_content:   |
                             | which fields to        |      |   "40% Alc./Vol."  |
                             | expect)                |      |   word_indices:    |
                             +------------------------+      |     [15, 16, 17]   |
                                                             |   confidence: 0.95 |
                                                             |                    |
                                                             | health_warning:    |
                                                             |   "GOVERNMENT..."  |
                                                             |   confidence: 0.92 |
                                                             | ...                |
                                                             +--------------------+

  Cost: ~$0.0015/label    Latency: 1-2 seconds


STEP 5: Bounding Box Merge
=============================

  extract-label.ts orchestrator merges classification with OCR coordinates:

  Classified field "brand_name" references word_indices [0, 1]
      -> Look up words[0] and words[1] from Stage 1 OCR result
      -> Compute union bounding box covering both words
      -> Normalize to 0-1 range (bbox_x, bbox_y, bbox_width, bbox_height)

  Result: each classified field now has pixel-accurate bounding box
  coordinates inherited from Cloud Vision, not approximated by the LLM.


STEP 6: Field Comparison Engine
==================================

  compare-fields.ts runs per-field comparison between
  application_data (expected) and AI-extracted values:

  +-------------------+----------+----------------------------------+
  | Field             | Strategy | Example                          |
  +-------------------+----------+----------------------------------+
  | Health Warning     | Exact    | Case-sensitive, whitespace-      |
  |                   |          | normalized, word-for-word        |
  | Brand Name        | Fuzzy    | "STONE'S THROW" = "Stone's      |
  |                   |          | Throw" (case-insensitive)        |
  | Alcohol Content   | Normal.  | "45% Alc./Vol. (90 Proof)" =    |
  |                   |          | "45%" (parse numeric)            |
  | Net Contents      | Normal.  | "750 mL" = "750ml" = "0.75L"    |
  | Class/Type        | Fuzzy    | Lenient by default               |
  | Name and Address  | Fuzzy    | Lenient by default               |
  | Qualifying Phrase | Enum     | "Bottled by" = "BOTTLED BY"      |
  | Country of Origin | Contains | "Product of Scotland" contains   |
  |                   |          | "Scotland"                       |
  +-------------------+----------+----------------------------------+

  Comparison strictness is configurable per-field via /settings.
  Accepted variants (synonyms whitelist) are checked before fuzzy match.

  Each comparison returns:
  - status: match | mismatch | not_found | needs_correction
  - confidence: 0.0 - 1.0
  - reasoning: human-readable explanation


STEP 7: Store Results
========================

  Write to database:
  - validation_results: processing time, model used, raw AI response
  - validation_items: one per field, with status, confidence, bbox coords,
    expected vs extracted values, match reasoning

  Determine overall label status:
  - All fields match                        -> approved
  - Minor discrepancies only (brand name,   -> conditionally_approved
    fanciful name, appellation, varietal)      (7-day correction window)
  - Any substantive mismatch or missing     -> needs_correction
    mandatory field                            (30-day correction window)
  - Fundamental issues (no health warning,  -> rejected
    illegal container size)

  Set correction_deadline if applicable.
  Update overall_confidence on label record.


STEP 8: Render Results
=========================

  Redirect to /history/[id]:

  +---------------------------+----------------------------+
  |                           |                            |
  |   ANNOTATED IMAGE         |   FIELD COMPARISON         |
  |                           |                            |
  |   +-------------------+   |   Brand Name               |
  |   |   [Label Photo]   |   |   App: "Jack Daniel's"     |
  |   |                   |   |   Label: "JACK DANIEL'S"   |
  |   |   +--green box--+ |   |   Status: MATCH  95%       |
  |   |   | JACK        | |   |                            |
  |   |   | DANIEL'S    | |   |   Alcohol Content          |
  |   |   +-------------+ |   |   App: "40%"               |
  |   |                   |   |   Label: "40% Alc./Vol."   |
  |   |   +--green box--+ |   |   Status: MATCH  93%       |
  |   |   | 40% Alc/Vol | |   |                            |
  |   |   +-------------+ |   |   Health Warning            |
  |   |                   |   |   App: "GOVERNMENT..."      |
  |   |   +--red box----+ |   |   Label: "Government..."   |
  |   |   | Government  | |   |   Status: MISMATCH  88%    |
  |   |   | Warning:... | |   |   (not all caps on header) |
  |   |   +-------------+ |   |                            |
  |   +-------------------+   |   [Diff highlighting shows  |
  |                           |    character-level changes]  |
  |   Zoom/pan via CSS        |                            |
  |   transforms              |   Click field -> highlight  |
  |   Click field -> zoom     |   bbox on image             |
  |                           |                            |
  +---------------------------+----------------------------+

  If all fields match with high confidence -> Quick Approve view
  (single "Approve" button, condensed summary)
```

---

## Database Schema

All primary keys use nanoid (21-char, URL-friendly) generated via `$defaultFn(() => nanoid())`. Exception: `users` and `sessions` tables use Better Auth's managed IDs. Types are derived from schema via `$inferSelect` / `$inferInsert`. Zod schemas are auto-generated via `drizzle-orm/zod`.

### Entity Relationship Diagram

```
+------------------+       +-------------------+       +---------------------+
|     users        |       |    sessions       |       |    applicants       |
|------------------|       |-------------------|       |---------------------|
| id (PK, BA)      |<------| user_id (FK)      |       | id (PK, nanoid)     |
| name             |       | token (unique)    |       | company_name        |
| email (unique)   |       | expires_at        |       | contact_email       |
| email_verified   |       | ip_address        |       | contact_name        |
| image            |       | user_agent        |       | notes               |
| role (enum)      |       | created_at        |       | created_at          |
| created_at       |       | updated_at        |       | updated_at          |
| updated_at       |       +-------------------+       +----------+----------+
+--------+---------+                                              |
         |                                                        |
         | specialist_id                                          | applicant_id
         |                                                        |
         |    +---------------------------------------------------+
         |    |
         v    v
+------------------------------+         +---------------------+
|          labels              |         |      batches        |
|------------------------------|         |---------------------|
| id (PK, nanoid)              |<--------| id (PK, nanoid)     |
| specialist_id (FK -> users)  |  batch_ | specialist_id (FK)  |
| applicant_id (FK -> applic.) |  id     | applicant_id (FK)   |
| batch_id (FK -> batches)     |---------| name                |
| prior_label_id (FK -> self)  |         | status (enum)       |
| beverage_type (enum)         |         | total_labels        |
| container_size_ml            |         | processed_count     |
| status (enum)                |         | approved_count      |
| overall_confidence           |         | cond_approved_count |
| correction_deadline          |         | rejected_count      |
| deadline_expired             |         | needs_corr_count    |
| is_priority                  |         | created_at          |
| created_at                   |         | updated_at          |
| updated_at                   |         +---------------------+
+-------+------+------+-------+
        |      |      |
        |      |      +----------------------------------------------+
        |      |                                                      |
        |      | label_id (1:many)                                    |
        |      v                                                      |
        |  +---------------------+                                    |
        |  |   label_images      |                                    |
        |  |---------------------|                                    |
        |  | id (PK, nanoid)     |                                    |
        |  | label_id (FK)       |                                    |
        |  | image_url           |                                    |
        |  | image_filename      |                                    |
        |  | image_type (enum)   |     label_id                       |
        |  | sort_order          |     (1:many for revalidation)      |
        |  | created_at          |                                    |
        |  | updated_at          |                                    |
        |  +----------+----------+                                    |
        |             |                                               |
        |             | label_image_id                                |
        |             |                                               |
        | label_id    |                                               |
        | (1:1)       |                                               |
        v             |                                               v
+---------------------+--+                          +---------------------------+
|   application_data     |                          |   validation_results      |
|------------------------|                          |---------------------------|
| id (PK, nanoid)        |                          | id (PK, nanoid)           |
| label_id (FK, unique)  |                          | label_id (FK)             |
| serial_number          |                          | superseded_by (FK->self)  |
| brand_name             |                          | is_current (bool)         |
| fanciful_name          |                          | ai_raw_response (jsonb)   |
| class_type             |                          | processing_time_ms        |
| class_type_code        |                          | model_used                |
| alcohol_content        |                          | created_at                |
| net_contents           |                          | updated_at                |
| health_warning         |                          +-------------+-------------+
| name_and_address       |                                        |
| qualifying_phrase      |                                        | validation_result_id
| country_of_origin      |                                        | (1:many)
| grape_varietal (wine)  |                                        v
| appellation (wine)     |                          +---------------------------+
| vintage_year (wine)    |                          |   validation_items        |
| sulfite_decl (wine)    |                          |---------------------------|
| age_statement (spirit) |                          | id (PK, nanoid)           |
| state_of_dist (spirit) |                          | validation_result_id (FK) |
| fdc_yellow_5           |                          | label_image_id (FK)       |
| cochineal_carmine      |                          | field_name (enum)         |
| created_at             |                          | expected_value            |
| updated_at             |                          | extracted_value           |
+------------------------+                          | status (enum)             |
                                                    | confidence                |
                                                    | match_reasoning           |
                                                    | bbox_x (normalized 0-1)   |
                                                    | bbox_y                    |
                                                    | bbox_width                |
                                                    | bbox_height               |
                                                    | created_at                |
                                                    | updated_at                |
                                                    +-------------+-------------+
                                                                  |
                                        validation_item_id (FK)   |
                                                                  |
+---------------------------+               +---------------------+
|     human_reviews         |               |
|---------------------------|               |
| id (PK, nanoid)           |<--------------+
| specialist_id (FK->users) |
| label_id (FK->labels)     |
| validation_item_id (FK)   |
| original_status (enum)    |        +---------------------+
| resolved_status (enum)    |        |     settings        |
| reviewer_notes            |        |---------------------|
| reviewed_at               |        | id (PK, nanoid)     |
| created_at                |        | key (unique)        |
+---------------------------+        | value (jsonb)       |
                                     | created_at          |
                                     | updated_at          |
+---------------------------+        +---------------------+
|   accepted_variants       |
|---------------------------|
| id (PK, nanoid)           |
| field_name (enum)          |
| canonical_value            |
| variant_value              |
| created_at                 |
| updated_at                 |
+---------------------------+
```

### Key Relationships

| Relationship | Cardinality | Notes |
|---|---|---|
| users -> labels | 1:many | `specialist_id` tracks who processed each label |
| applicants -> labels | 1:many | Labels grouped by submitting company |
| batches -> labels | 1:many | Batch uploads contain multiple labels |
| labels -> labels | self-ref | `prior_label_id` for resubmission chains |
| labels -> label_images | 1:many | Front, back, neck, strip images |
| labels -> application_data | 1:1 | Form 5100.31 data per label |
| labels -> validation_results | 1:many | Multiple results via revalidation |
| validation_results -> self | self-ref | `superseded_by` chains result history |
| validation_results -> validation_items | 1:many | Per-field comparison results |
| validation_items -> human_reviews | 1:many | Specialist override records |

### Enums

```
beverage_type:   distilled_spirits | wine | malt_beverage

label_status:    pending | processing | approved | conditionally_approved
                 | needs_correction | rejected

batch_status:    processing | completed | failed

field_name:      brand_name | fanciful_name | class_type | alcohol_content
                 | net_contents | health_warning | name_and_address
                 | qualifying_phrase | country_of_origin | grape_varietal
                 | appellation_of_origin | vintage_year | sulfite_declaration
                 | age_statement | state_of_distillation | standards_of_fill

item_status:     match | mismatch | not_found | needs_correction

image_type:      front | back | neck | strip | other

user_role:       admin | specialist
```

---

## Key Modules

### `src/lib/ai/` — Hybrid AI Pipeline

The AI subsystem is split into three files that form a pipeline.

**`ocr.ts`** (Stage 1) wraps the Google Cloud Vision `TEXT_DETECTION` API. Accepts a Vercel Blob URL, returns word-level text with pixel-accurate bounding polygons (4 vertices per word). For multi-image labels, runs OCR on each image in parallel via `Promise.all`. Cost: $0.0015/image. Latency: <1 second.

**`classify-fields.ts`** (Stage 2) uses the Vercel AI SDK (`generateText` + `Output.object()`) with `openai('gpt-5-mini')` to classify OCR text into TTB regulatory fields. Receives text only (no image tokens), making it fast and cheap. The classification prompt is beverage-type-aware: it tells the model which fields to look for based on the product type selection. Returns structured output via Zod schema with `.nullable()` properties (OpenAI limitation: no `.optional()` in structured output). Cost: ~$0.0015/label. Latency: 1-2 seconds.

**`extract-label.ts`** is the orchestrator. Calls OCR, then classification, then merges classification results with bounding box coordinates from OCR. Each classified field references word indices from Stage 1; the orchestrator computes union bounding boxes and normalizes coordinates to 0-1 range for UI rendering. Total cost: ~$0.003/label. Total latency: 2-4 seconds.

**`prompts.ts`** contains the beverage-type-aware classification prompts. Different product types trigger different field expectations (e.g., wine labels should have sulfite declaration and appellation of origin; spirits labels may need age statements).

### `src/lib/ai/compare-fields.ts` — Field Comparison Engine

Implements per-field comparison logic with multiple match strategies:

- **Exact**: Health warning statement (case-sensitive, whitespace-normalized, word-for-word with punctuation). Special handling for "GOVERNMENT WARNING:" header formatting (must be all caps and bold).
- **Fuzzy**: Brand name, fanciful name, class/type, name and address (case-insensitive, handles apostrophes, accents, abbreviations).
- **Normalized**: Alcohol content (parses "45% Alc./Vol. (90 Proof)" to "45%") and net contents (handles mL/cL/L conversions, spacing variations).
- **Enum**: Qualifying phrase matching against the known list ("Bottled by", "Distilled by", etc.).
- **Contains**: Country of origin ("Product of Scotland" contains "Scotland").

Each comparison checks the accepted variants whitelist before fuzzy matching. Match strictness per field is configurable via `/settings` (strict / moderate / lenient). Returns `{ status, confidence, reasoning }` per field.

### `src/lib/labels/effective-status.ts` — Lazy Deadline Expiration

Implements deadline expiration without cron jobs. The `getEffectiveStatus()` function computes the true label status at read time:

- If `correction_deadline < now()` and status is `needs_correction`, the effective status is `rejected`.
- If `correction_deadline < now()` and status is `conditionally_approved`, the effective status is `needs_correction`.
- Otherwise, returns the stored status as-is.

When a label with an expired deadline is loaded (page view, queue query), a fire-and-forget database update sets `deadline_expired = true` and transitions the stored status. This means the database eventually converges to accurate status values without any background infrastructure.

All label queries throughout the application use this helper, ensuring consistent and always-accurate status display.

### `src/config/` — TTB Regulatory Data

Static configuration files encoding TTB regulatory requirements:

- **`beverage-types.ts`**: Defines mandatory label fields per product type (distilled spirits, wine, malt beverages), valid container sizes (standards of fill from January 2025 final rule), and health warning type-size requirements by container volume.
- **`class-type-codes.ts`**: All TTB numeric class/type codes (0-999) with human-readable descriptions. Examples: 101 = Straight Bourbon Whisky, 84 = Sparkling Wine, 901 = Beer.
- **`health-warning.ts`**: The exact required "GOVERNMENT WARNING:" text from 27 CFR Part 16, formatting rules (all caps, bold header, non-bold body), and minimum type size by container size.
- **`qualifying-phrases.ts`**: Valid qualifying phrases for the Name and Address field ("Bottled by", "Distilled by", "Imported by", "Brewed by", etc.).

These are separated into config files so regulatory changes can be applied without modifying business logic.

### `src/app/actions/` — Server Actions

All database mutations go through server actions. No API routes are exposed for data access. Every server action follows the same pattern:

1. Call `getSession()` to authenticate the request; reject if no session.
2. Check role if the action is admin-only (`session.user.role === 'admin'`).
3. Validate input with Zod schemas (re-validates independently from client-side validation).
4. Execute business logic (DB writes, AI calls, file operations).
5. Call `revalidatePath()` or `revalidateTag()` to bust any cached data.
6. Return result or redirect.

Key actions: `validate-label.ts` (the core validation pipeline), `submit-review.ts` (human review overrides), `bulk-approve.ts` (batch quick-approve for clean labels), `revalidate-label.ts` (re-run AI with current settings), `submit-correction.ts` (resubmission linked to prior label).

### `proxy.ts` — Auth + Security Headers

Next.js 16 renamed `middleware.ts` to `proxy.ts`. It runs on the Node.js runtime (not Edge, unlike the old middleware). Responsibilities:

- **Auth check**: Redirects unauthenticated users to `/login` on all routes except `/login` and `/api/auth/*`.
- **Role enforcement**: Redirects specialist-role users away from `/admin/*` and `/settings` routes.
- **Security headers**: Strict CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS.

---

## Security Model

### Authentication

- **Better Auth v1.4** with email/password authentication.
- Session-based with 30-day expiry and 1-day refresh window.
- Two roles: `admin` (full access) and `specialist` (scoped access).
- Login rate limiting: 3 attempts per minute per email address.
- All auth state managed server-side; no JWT tokens exposed to client.

### Authorization

- **Route-level**: `proxy.ts` enforces auth on all protected routes and blocks specialists from admin routes.
- **Action-level**: Every server action calls `getSession()` as its first operation. Admin-only actions additionally check `session.user.role === 'admin'`.
- **Data-level**: Specialists see their own workload by default. Admin sees team-wide data. Database queries are scoped by role in RSC data loading.

### Input Validation

- All server action inputs validated with Zod schemas before any processing.
- File uploads undergo triple validation: MIME type check, file extension check, and magic byte verification.
- File size limited to 10MB per image.
- React Hook Form with `zodResolver` provides client-side validation, but the server re-validates independently (never trust the client).

### Database Security

- No raw SQL anywhere in the codebase. All queries use Drizzle ORM's parameterized query builder, preventing SQL injection.
- Database connection string is a server-only environment variable. No client-side database access is possible.
- No API routes expose database access directly.

### File Storage

- Vercel Blob with signed URLs provides time-limited access to uploaded images. No public bucket access.
- Client-side direct uploads go through a token exchange endpoint that validates the user session and allowed MIME types before issuing an upload token.

### Headers & Transport

- Strict Content Security Policy via `proxy.ts`.
- `X-Frame-Options: DENY` prevents clickjacking.
- `X-Content-Type-Options: nosniff` prevents MIME sniffing.
- HSTS for HTTPS enforcement.
- `robots.txt` disallows all crawlers (internal tool).

### Error Handling

- `global-error.tsx` at root, `error.tsx` per route group, `not-found.tsx` per route.
- No stack traces leaked to users in production.
- Error boundaries display user-friendly messages with retry buttons.

### Rate Limiting (Production)

Rate limiting is deferred for the prototype. Production deployment would use `@upstash/ratelimit` with Upstash Redis (HTTP-based, serverless-compatible). In-memory rate limiting does not work on Vercel's serverless architecture because each function invocation runs in an isolated environment.

---

## Deployment

### Platform

Deployed on Vercel with the following integrations:

- **Neon Postgres** — Serverless database, linked via Vercel integration for zero-config connection.
- **Vercel Blob** — Image storage with signed URLs and client-side direct uploads.
- **Vercel Analytics** — Page views and custom events (label validated, review completed, etc.).

### Environment Variables

All secrets are server-only (no `NEXT_PUBLIC_` prefix). Managed in Vercel's environment variable settings.

```
DATABASE_URL                       # Neon Postgres connection string
OPENAI_API_KEY                     # OpenAI API key (GPT-5 Mini via @ai-sdk/openai)
GOOGLE_APPLICATION_CREDENTIALS     # Path to GCP service account JSON (local dev)
GOOGLE_APPLICATION_CREDENTIALS_JSON # GCP service account JSON content (Vercel — parsed at runtime)
BLOB_READ_WRITE_TOKEN              # Vercel Blob storage token
BETTER_AUTH_SECRET                  # Better Auth session secret
BETTER_AUTH_URL                    # App URL (http://localhost:3000 in dev, production URL in prod)
```

### Build & Deploy

```bash
yarn build              # Production build (Turbopack)
yarn start              # Start production server (local testing)
vercel deploy           # Deploy to Vercel (or auto-deploy via Git integration)
```

Vercel auto-deploys on push to `main`. Preview deployments are created for pull requests.

### Database Migrations

```bash
yarn db:generate        # Generate SQL migration files from schema changes
yarn db:migrate         # Apply pending migrations to Neon Postgres
yarn db:seed            # Seed database with ~1,000 sample labels (dev/staging only)
```

Migrations are forward-only. Rollbacks are done by creating a new forward migration that reverses the change. Migration files are committed to git and applied in order.
