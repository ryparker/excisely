# Cloud AI Features

The app works fully without cloud APIs — but I also built and wired up a **cloud AI pipeline** (Google Cloud Vision OCR + OpenAI GPT-4.1 Nano via AI SDK) to demonstrate modern AI integration.

## How to Enable

1. Add API keys to `.env.local`:

   ```bash
   OPENAI_API_KEY=sk-...                     # OpenAI API key
   GOOGLE_APPLICATION_CREDENTIALS=./path.json # Path to GCP service account JSON (local dev)
   ```

2. Start the dev server (`yarn dev`)
3. Log in as a specialist → go to **Settings** → toggle **Submission Pipeline** to "Cloud AI"

On Vercel, use `GOOGLE_APPLICATION_CREDENTIALS_JSON` (raw JSON content) instead of a file path.

## Cloud-Only Features

These features require the cloud pipeline to be enabled.

### AI Pre-Fill for Applicants

Upload a label image, click **"Scan Labels,"** and the form auto-populates in ~3-5s. Uses Google Cloud Vision for OCR and OpenAI GPT-4.1 Mini for field classification.

### Pixel-Accurate Bounding Box Overlays

Google Cloud Vision returns word-level bounding polygons. The specialist review page renders these as color-coded SVG overlays (green = match, red = mismatch). Click any field in the comparison table to auto-pan and zoom to that region on the label.

![Interactive image viewer](screenshots/specialist/interactive-image-viewer-botanist.gif)

#### Interactive Image Viewer

On any label detail page with cloud results:

- **Click a field** in the comparison table — the image auto-pans and zooms to that exact region
- **Scroll to zoom**, drag to pan, toolbar buttons to rotate
- **Toggle overlays** on/off to see the clean label vs. annotated view
- **Expand to fullscreen** for detailed inspection

This is how a specialist would work through a label — click each field, verify it visually, move on.

### Applicant Corrections Tracking

When an applicant uses "Scan Labels" to AI pre-fill and then corrects a value before submitting, the specialist sees a badge showing what the AI originally extracted vs. what the applicant corrected. This gives specialists context: "The AI read it as X, but the applicant says it should be Y."

![Applicant corrections tracking](screenshots/specialist/applicant-correction.png)

### Structured Output with Zod Schemas

All AI classification uses `generateText` + `Output.object()` from the Vercel AI SDK with Zod schemas for type-safe structured output. Beverage-type-aware prompts adjust extraction rules per product type (beer, wine, distilled spirits).

### Automatic Fallback

If a cloud API call fails (network error, rate limit, etc.), the system automatically falls back to the local pipeline. No manual intervention needed.

## Local vs. Cloud Comparison

| Feature                       | Local (default)              | Cloud (opt-in)                          |
| ----------------------------- | ---------------------------- | --------------------------------------- |
| OCR engine                    | Tesseract.js (in-process)    | Google Cloud Vision (API)               |
| Field classification          | Rule-based                   | OpenAI GPT-4.1 Nano (structured output) |
| Bounding box overlays         | Not available                | Pixel-accurate, color-coded             |
| AI pre-fill for applicants    | Not available                | "Scan Labels" button (~3-5s)            |
| Applicant correction tracking | Not available                | Shows AI vs. applicant values           |
| Processing time               | ~2-4s                        | ~3-5s                                   |
| API keys required             | None                         | OpenAI + Google Cloud                   |
| Network requirements          | None (fully offline-capable) | Outbound HTTPS to OpenAI + Google       |
| Cost per label                | $0                           | ~$0.004                                 |

## Cost Analysis

| Component                             | Cost per label    | Annual (150K labels) |
| ------------------------------------- | ----------------- | -------------------- |
| Google Cloud Vision OCR               | ~$0.0015          | ~$225                |
| OpenAI GPT-4.1 Nano (submission)      | ~$0.002           | ~$300                |
| OpenAI GPT-4.1 Mini (pre-fill)        | ~$0.001           | ~$150                |
| OpenAI GPT-5 Mini (specialist review) | ~$0.004           | ~$600                |
| **Total**                             | **~$0.004-0.008** | **~$600-1,275**      |

For TTB's full 150K annual label volume, the cloud pipeline costs roughly $600-1,275/year — less than a single day of a specialist's time.

## Further Reading

- [AI Pipeline Deep Dive](./ai-pipelines.md) — all 5 pipelines, stages, models, comparison engine
- [Architecture](./architecture.md) — system diagrams, data flow, DB schema
- [Decisions](./decisions.md) — engineering trade-offs including the local → cloud migration
