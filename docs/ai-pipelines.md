# AI Pipeline Architecture

How Excisely extracts, classifies, and verifies alcohol label fields using a hybrid AI pipeline.

---

## Overview

Every label that enters the system goes through a 3-stage pipeline:

```
                    Stage 1              Stage 2                Stage 3
                  +---------+     +------------------+     +----------------+
  Label Images -->|   OCR   |---->|  Classification  |---->|  Bounding Box  |--> Structured
  (Blob URLs)     | (Vision)|     |    (OpenAI)      |     |   Resolution   |    Fields
                  +---------+     +------------------+     +----------------+
                   ~600ms            ~3-15s                     ~1ms
```

**Stage 1 — OCR** (`@google-cloud/vision`): Extracts every word from label images with pixel-accurate bounding polygons. Runs in parallel across all images.

**Stage 2 — Classification** (OpenAI): Maps the raw OCR text to TTB-regulated field names (brand_name, alcohol_content, health_warning, etc.) with confidence scores and reasoning.

**Stage 3 — Bounding Box Resolution** (local CPU): Matches classified field values back to their OCR word positions, producing normalized bounding boxes for the annotation viewer.

This hybrid approach plays to each system's strengths: Cloud Vision for pixel-accurate text localization, OpenAI for semantic understanding of what each piece of text _means_ on a TTB label.

---

## The Five Pipelines

The system has five pipelines optimized for different use cases. They all share Stage 1 (OCR) and Stage 3 (bounding box resolution) but differ in how Stage 2 (classification) is configured.

### Pipeline Comparison

```
                          Images to    Word      Reasoning   Confidence
  Pipeline       Model    Model?    Indices?    Effort       Scores?     Speed
  ─────────────  ───────  ────────  ────────    ──────────   ──────────  ────────
  Submission     4.1      No        No          N/A          Yes         ~4-6s
  Specialist     5-mini   Yes       Yes         Default      Yes         20-60s+
  Fast Pre-fill  4.1      No        No          N/A          No (80)     ~3-5s
  Full Extract   5-mini   Yes       Yes         Default      Yes         20-60s+
  Auto-Detect    4.1*     No        No          N/A*         No* (80)    ~4-9s*
```

\* Auto-Detect uses gpt-4.1 when keywords detect the type (happy path, ~4-9s). Falls back to gpt-5-mini Full Extract pipeline when type is ambiguous (~10-20s).

---

### 1. Submission Pipeline

**Function:** `extractLabelFieldsForSubmission()`
**Model:** gpt-4.1 (text-only, `temperature: 0`)
**Used by:** All label processing actions

```
  Blob Storage        Cloud Vision            gpt-4.1              Local CPU
  ┌──────────┐       ┌────────────┐       ┌──────────────┐       ┌──────────────┐
  │  Fetch   │──────>│    OCR     │──────>│ Classify     │──────>│ Match fields  │
  │  images  │ bytes │ (parallel) │ text  │ (text-only)  │fields │ to OCR words  │
  │          │       │            │       │ temp=0       │       │               │
  │ ~200ms   │       │  ~600ms    │       │  ~3-5s       │       │    ~1ms       │
  └──────────┘       └────────────┘       └──────────────┘       └──────────────┘
       |                   |                     |                       |
   Image bytes       Word polygons         Field values +          Bounding boxes
   (for OCR,         + full text           confidence +            (normalized 0-1)
    NOT sent                               reasoning
    to LLM)
```

**Why this design:**

This is the workhorse pipeline. It handles applicant submissions, specialist validations, reanalysis, and batch processing. Two key optimizations:

1. **Images are fetched for OCR but never sent to the LLM** — saves ~30-40s of multimodal upload and processing time
2. **gpt-4.1 (non-reasoning) replaces gpt-5-mini** — drops classification from ~10-15s to ~3-5s, bringing total pipeline time under the 5-second usability threshold identified by Sarah Chen ("If we can't get results back in about 5 seconds, nobody's going to use it.")

- **gpt-4.1** is a fast non-reasoning model with `temperature: 0` for deterministic output
- **The comparison engine is the real arbiter** — it determines match/mismatch/missing status independently of AI confidence, so the loss of reasoning model nuance doesn't affect validation outcomes
- **Local text matching** produces equivalent bounding boxes to LLM-provided word indices
- Application data from Form 5100.31 is included in the prompt for disambiguation

**What's NOT included** (vs the full multimodal pipeline):

- Image buffers are not sent to the model (biggest time saving)
- No visual verification of OCR digits (OCR errors still get caught as mismatches by the comparison engine)
- No image type classification (front/back/neck/strip — done during pre-fill)
- No word indices requested from the model (local matching is equivalent)

**Callers:**

| Server Action            | Context                                    |
| ------------------------ | ------------------------------------------ |
| `submitApplication`      | Applicant submits completed COLA form      |
| `validateLabel`          | Specialist uploads label via validation UI |
| `reanalyzeLabel`         | Specialist re-runs AI on existing label    |
| `processBatchItem`       | Batch processing of queued labels          |
| `submitBatchApplication` | Applicant batch upload                     |

---

### 2. Specialist Pipeline (Full Multimodal)

**Function:** `extractLabelFields()` / `extractLabelFieldsFromBuffers()`
**Model:** gpt-5-mini (multimodal — text + images)
**Used by:** Currently no callers (kept for future use)

```
  Blob Storage        Cloud Vision          gpt-5-mini             Index Lookup
  ┌──────────┐       ┌────────────┐       ┌──────────────────┐   ┌──────────────┐
  │  Fetch   │──────>│    OCR     │──────>│ Classify         │──>│ Map indices   │
  │  images  │ bytes │ (parallel) │ text  │ (text + images)  │   │ to OCR words  │
  │          │       │            │ +list │                  │   │               │
  │ ~200ms   │       │  ~600ms    │       │  ~20-60s+        │   │    ~1ms       │
  └──────────┘       └────────────┘       └──────────────────┘   └──────────────┘
       |                   |                     |                       |
   Image bytes       Word polygons         Field values +          Bounding boxes
   (sent to LLM     + indexed word         word indices +          (from indexed
    for visual        list                 confidence +             word lookup)
    verification)                          reasoning +
                                           image classifications
```

**Why this exists:**

This is the most thorough pipeline — the model can _see_ the label images and cross-check OCR results. It catches digit misreads that text-only pipelines miss (e.g., "52%" OCR'd as "12%"). The trade-off is speed: sending full-resolution images to a reasoning model means ~30-40s of multimodal upload + internal processing on top of the text classification time.

**When it matters:**

Visual verification is most valuable for:

- Alcohol content (a misread % changes the entire validation)
- Vintage year (2019 vs 2014)
- Net contents (750 mL vs 150 mL)

In practice, the comparison engine catches these as mismatches anyway (the extracted value won't match the application data), routing them to specialist review. The specialist then verifies visually themselves. This is why the submission pipeline dropped multimodal — the safety net works without it.

**Key differences from submission pipeline:**

- Images sent to model (multimodal messages)
- Word indices requested and provided by model
- Visual verification instructions in prompt
- Image type classification (front/back/neck/strip/other)
- Bounding boxes resolved via index lookup (not text matching)

---

### 3. Fast Pre-fill Pipeline

**Function:** `extractLabelFieldsForApplicantWithType()`
**Model:** gpt-4.1 (non-reasoning, `temperature: 0`)
**Used by:** Applicant form pre-fill when beverage type is known

```
  Blob Storage        Cloud Vision            gpt-4.1              Local CPU
  ┌──────────┐       ┌────────────┐       ┌──────────────┐       ┌──────────────┐
  │  Fetch   │──────>│    OCR     │──────>│ Extract      │──────>│ Match fields  │
  │  images  │ bytes │ (parallel) │ text  │ (text-only)  │fields │ to OCR words  │
  │          │       │            │       │ temp=0       │       │               │
  │ ~200ms   │       │  ~600ms    │       │  ~3-5s       │       │    ~1ms       │
  └──────────┘       └────────────┘       └──────────────┘       └──────────────┘
                                                |
                                          Minimal output:
                                          fieldName + value only
                                          (no confidence, no reasoning)
```

**Why gpt-4.1 and not gpt-5-mini:**

This pipeline exists for one reason: **speed**. When an applicant uploads label images, they're watching the form fields populate in real-time. 3-5 seconds feels responsive; 15-20 seconds feels broken.

- **gpt-4.1** is a non-reasoning model — no internal chain-of-thought, just direct classification
- **`temperature: 0`** for deterministic output
- **Minimal schema** — only `fieldName` + `value` (no confidence, reasoning, or word indices)
- **Skips fields** — `health_warning` (auto-filled from standard text) and `standards_of_fill` (computed from container size)
- **System/user message split** — enables OpenAI prompt caching (system message is identical across calls for the same beverage type)

**Quality trade-off:**

This pipeline hardcodes confidence at 80 and provides no reasoning. That's fine — the applicant reviews and corrects every field before submitting. The submission pipeline re-classifies with gpt-4.1 for the values that actually matter to specialists.

---

### 4. Full Extraction Pipeline (No Beverage Type)

**Function:** `extractLabelFieldsForApplicant()`
**Model:** gpt-5-mini (text-only, no images sent despite being available)
**Used by:** Fallback for Pipeline 5 when keyword detection fails

```
  Blob Storage        Cloud Vision          gpt-5-mini             Index Lookup
  ┌──────────┐       ┌────────────┐       ┌──────────────────┐   ┌──────────────┐
  │  Fetch   │──────>│    OCR     │──────>│ Extract ALL      │──>│ Map indices   │
  │  images  │ bytes │ (parallel) │ text  │ fields + detect  │   │ to OCR words  │
  │          │       │            │ +list │ beverage type    │   │               │
  │ ~200ms   │       │  ~600ms    │       │  ~10-20s         │   │    ~1ms       │
  └──────────┘       └────────────┘       └──────────────────┘   └──────────────┘
                                                |
                                          Union of ALL fields
                                          + detected beverage type
                                          + image classifications
```

**Why this exists:**

When an applicant first uploads label images _before selecting a beverage type_, the system needs to:

1. Figure out what kind of product this is (spirits? wine? malt beverage?)
2. Extract all possible fields from the label

This pipeline uses the **union of all fields** from all beverage types and asks the model to detect the beverage type from context clues:

- Spirits: proof, age statements, "whiskey", "bourbon", "vodka"
- Wine: grape varietals, vintage years, appellations, "contains sulfites"
- Malt beverages: "ale", "lager", "IPA", "brewed by", "hard seltzer"

Once the beverage type is detected, the form switches to the Fast Pre-fill Pipeline for subsequent scans.

---

### 5. Auto-Detect Pipeline

**Function:** `extractLabelFieldsWithAutoDetect()`
**Model:** gpt-4.1 (happy path) or gpt-5-mini (fallback)
**Used by:** Applicant form pre-fill when beverage type is not selected

```
  Blob Storage        Cloud Vision       Keyword Detection     gpt-4.1 or 5-mini    Local CPU
  ┌──────────┐       ┌────────────┐       ┌──────────────┐     ┌──────────────┐     ┌──────────┐
  │  Fetch   │──────>│    OCR     │──────>│ Score types  │─┬──>│ Fast Extract │────>│ Match    │
  │  images  │ bytes │ (parallel) │ text  │ by keywords  │ │   │ (type-aware) │     │ fields   │
  │          │       │            │       │              │ │   │ gpt-4.1      │     │ to OCR   │
  │ ~200ms   │       │  ~600ms    │       │  ~0ms        │ │   │ ~3-8s        │     │  ~1ms    │
  └──────────┘       └────────────┘       └──────────────┘ │   └──────────────┘     └──────────┘
                                                  │        │
                                             (ambiguous?)  └──>│ Full Extract │────>│ Match    │
                                                               │ (all fields) │     │ fields   │
                                                               │ gpt-5-mini   │     │ to OCR   │
                                                               │ ~10-20s      │     │  ~1ms    │
                                                               └──────────────┘     └──────────┘
```

**Why this exists:**

Previously (Pipeline 4), when no beverage type was selected, the system sent all fields from all types to gpt-5-mini — slower (~10-20s) and less accurate than type-specific prompts. The auto-detect pipeline adds a zero-cost keyword matching step:

1. **Keyword detection** (~0ms): Score each beverage type by counting OCR text hits against type-specific keyword lists (whiskey/bourbon/proof → spirits, wine/cabernet/sulfites → wine, ale/lager/brewed → malt)
2. **Clear winner?** → Fast type-specific extraction via Pipeline 3 (gpt-4.1, ~3-8s)
3. **Ambiguous?** → Fall back to Pipeline 4's full extraction (gpt-5-mini, ~10-20s)

**Performance:**

- Happy path (clear keywords): ~4-9s — same speed as manual type selection
- Fallback (ambiguous): ~10-20s — no worse than before

**Keyword matching rules:**

- Each type has ~30 keywords (spirits: "whiskey", "bourbon", "proof", "distilled by"...)
- Score = count of matching keywords in OCR text
- Winner needs at least 1 hit AND 1+ more hits than runner-up
- Returns null (triggers fallback) if tied or no keywords found

**UX impact:**

- Applicants can skip the beverage type selection step entirely
- AI auto-fills the type card with an "AI detected" badge
- If detection fails, a toast prompts manual selection
- User can override AI-detected type at any time

---

## Stage Details

### Stage 1: OCR (Google Cloud Vision)

**File:** `src/lib/ai/ocr.ts`
**API:** `documentTextDetection()` (not `textDetection` — optimized for document-style layouts)

```
  Input: Image buffer (JPEG/PNG)
    |
    v
  Cloud Vision API
    |
    v
  Output: {
    words: [                          // Every word with pixel coordinates
      {
        text: "GOVERNMENT",
        boundingPoly: {
          vertices: [                 // 4 corners in pixel space
            { x: 120, y: 450 },      // top-left (in reading direction)
            { x: 340, y: 450 },      // top-right
            { x: 340, y: 475 },      // bottom-right
            { x: 120, y: 475 },      // bottom-left
          ]
        },
        confidence: 0.99
      },
      ...
    ],
    fullText: "GOVERNMENT WARNING...", // All text concatenated
    imageWidth: 1200,                  // Source image dimensions
    imageHeight: 1600
  }
```

**Key properties:**

- Word-level granularity (not character or paragraph)
- Pixel-accurate bounding polygons (4 vertices per word)
- Handles rotated, curved, and embossed text
- Parallel execution across multiple images (`Promise.all`)
- ~$0.0015 per image, ~600ms latency

### Stage 2: Classification (OpenAI)

**File:** `src/lib/ai/classify-fields.ts`

All classification functions use the AI SDK's `generateText()` with `Output.object()` for guaranteed JSON schema compliance.

```
  Input: OCR text + prompt + (optional) images + (optional) app data
    |
    v
  generateText({
    model: openai('gpt-5-mini'),       // or gpt-4.1 for fast pre-fill
    messages: [...],
    providerOptions: {
      openai: { reasoningEffort: 'low' } // submission pipeline only
    },
    experimental_output: Output.object({
      schema: z.object({               // Zod schema = guaranteed structure
        fields: z.array(z.object({
          fieldName: z.string(),
          value: z.string().nullable(), // .nullable() not .optional()
          confidence: z.number(),       //   (OpenAI structured output
          reasoning: z.string().nullable() //  limitation)
        }))
      })
    })
  })
    |
    v
  Output: Typed, validated field classifications
```

**Schema note:** OpenAI's structured output requires `.nullable()` instead of `.optional()` in Zod schemas. All nullable fields use this pattern.

### Stage 3: Bounding Box Resolution

**File:** `src/lib/ai/extract-label.ts`

Two strategies, both producing identical output:

```
  Strategy A: Index Lookup                 Strategy B: Text Matching
  (multimodal pipelines)                   (text-only pipelines)

  LLM returns wordIndices [3, 4, 5]       LLM returns value "750 mL"
         |                                          |
         v                                          v
  Look up words[3], words[4], words[5]     findMatchingWords("750 mL", allWords)
  from combined word list                  sliding window, fuzzy match
         |                                          |
         v                                          v
  computeNormalizedBoundingBox()           computeNormalizedBoundingBox()
  from matched OCR word vertices           from matched OCR word vertices
         |                                          |
         v                                          v
  { x: 0.12, y: 0.65,                     { x: 0.12, y: 0.65,
    width: 0.08, height: 0.02,              width: 0.08, height: 0.02,
    angle: 0 }                               angle: 0 }
```

**Text matching algorithm** (`findMatchingWords`):

1. Normalize both strings (lowercase, strip punctuation, collapse whitespace)
2. Slide a window across OCR words (up to 60 words wide)
3. Accumulate text and compare against target
4. Return best match if coverage >= 60%
5. Runs in <1ms for typical labels (~150 words)

**Coordinate normalization:**

- All bounding boxes are normalized to 0-1 range (divided by image dimensions)
- Text angle computed from word baseline vectors, snapped to nearest 90 degrees
- Supports horizontal (0), vertical (90/-90), and upside-down (180) text

---

## Comparison Engine

**File:** `src/lib/ai/compare-fields.ts`

After extraction, each field is compared against the applicant's Form 5100.31 data. Different fields use different comparison strategies:

```
  Expected: "40% Alc./Vol."     Extracted: "40% Alc/Vol."
       |                              |
       v                              v
  compareField("alcohol_content", expected, extracted)
       |
       v
  Strategy: "normalized"
  Parse both to numeric ABV --> 40.0 == 40.0 --> MATCH (100% confidence)
```

### Strategies by Field

```
  Strategy       Fields                           How it works
  ───────────    ──────────────────────────────    ─────────────────────────────
  exact          health_warning, vintage_year      Case-insensitive string match

  fuzzy          brand_name, fanciful_name,        Dice coefficient on character
                 class_type, name_and_address,     bigrams. Threshold: 0.8
                 grape_varietal, appellation,
                 sulfite_declaration,
                 state_of_distillation

  normalized     alcohol_content                   Parse to numeric %, allow
                                                   +/- 0.5% tolerance

                 net_contents                      Parse to mL, allow
                                                   +/- 1% tolerance

                 age_statement                     Parse to years, exact match

  enum           qualifying_phrase                 Match against canonical
                                                   phrase list, fuzzy fallback

  contains       country_of_origin                 Word-level overlap,
                                                   >= 50% match
```

### Dice Coefficient (Fuzzy Matching)

```
  "Knob Creek" vs "Knob creek"

  Bigrams A: { "kn", "no", "ob", "b ", " c", "cr", "re", "ee", "ek" }
  Bigrams B: { "kn", "no", "ob", "b ", " c", "cr", "re", "ee", "ek" }

  Similarity = 2 * |intersection| / (|A| + |B|)
             = 2 * 9 / (9 + 9)
             = 1.0  -->  MATCH
```

### Comparison Output

Each field comparison produces:

```typescript
{
  status: 'match' | 'mismatch' | 'missing' | 'needs_correction',
  confidence: number,     // 0-100
  reasoning: string,      // Human-readable explanation
}
```

The `needs_correction` status is applied when a mismatch occurs on a minor field (fields where small discrepancies are correctable rather than grounds for rejection).

---

## Data Flow: End-to-End Submission

```
  Applicant                         Server                              AI Services
  ─────────                         ──────                              ───────────

  1. Upload images ──────────────> Vercel Blob
                                   (direct upload)

  2. Fill form fields               (AI pre-fill available)
     (or accept AI pre-fill)

  3. Submit ─────────────────────> submitApplication()
                                   |
                                   ├─ Validate form data (Zod)
                                   ├─ Create label (status: processing)
                                   ├─ Create application_data record
                                   ├─ Create label_images records
                                   |
                                   ├─ extractLabelFieldsForSubmission()
                                   |   ├─ fetchImageBytes() ─────────> Blob Storage
                                   |   ├─ extractTextMultiImage() ───> Cloud Vision
                                   |   ├─ classifyFieldsForSubmission() ──> OpenAI
                                   |   └─ matchFieldsToBoundingBoxes()  (local CPU)
                                   |
                                   ├─ compareField() for each field
                                   |   (expected vs extracted)
                                   |
                                   ├─ Create validation_result record
                                   ├─ Create validation_items records
                                   ├─ Determine overall status
                                   |   (approved / needs_correction /
                                   |    conditionally_approved / rejected)
                                   |
                                   └─ Update label status
                                      (auto-approve or route to review)

  4. <── Redirect to submission detail page
```

---

## Cost Model

| Component           | Cost               | Per Label              |
| ------------------- | ------------------ | ---------------------- |
| Cloud Vision OCR    | $1.50 / 1K images  | ~$0.003 (2 images)     |
| gpt-4.1 (submit)   | ~$0.10 / 1M tokens | ~$0.0002 (2K tokens)   |
| gpt-4.1 (pre-fill)  | ~$0.10 / 1M tokens | ~$0.0001 (1.3K tokens) |
| **Total per label** |                    | **~$0.004**            |

Pre-fill adds ~$0.0001 per scan. A label that goes through pre-fill + submission + one reanalysis costs roughly $0.01. Switching the submission pipeline from gpt-5-mini to gpt-4.1 halved per-label cost while cutting latency from ~15-20s to ~4-6s.

---

## Why This Architecture

**Why not a single end-to-end vision model?**

No single model excels at both text localization (where exactly is each word, in pixels?) and semantic classification (what does this text mean in TTB regulatory context?). Cloud Vision provides sub-pixel bounding polygons in ~600ms at $0.0015/image. OpenAI provides regulatory understanding. The hybrid approach costs ~$0.005/label total and completes in ~4-6 seconds.

**Why text-only classification?**

The submission pipeline proved that text-only classification produces quality equivalent to multimodal for TTB labels. OCR captures the text accurately; the model's job is semantic mapping, not reading. Visual verification (catching OCR digit errors) sounds valuable in theory, but in practice: (a) OCR digit errors produce mismatches that route to specialist review anyway, and (b) sending images to a model adds 30-40 seconds. The safety net works without it.

**Why gpt-4.1 for the submission pipeline (not gpt-5-mini)?**

The 5-second usability threshold demanded a non-reasoning model. gpt-5-mini (reasoning model) took ~10-15s even with `reasoningEffort: 'low'` because it generates internal chain-of-thought. gpt-4.1 produces equivalent classification quality in ~3-5s — the comparison engine (Dice coefficient, normalized parsing, exact matching) is the real arbiter of match/mismatch outcomes, not the model's confidence score. The model's job is structured extraction; the comparison engine does validation.

**Why local bounding box matching?**

When the model doesn't receive images, it can't return word indices (it doesn't know the word positions). Rather than asking the model to guess indices from the word list, we match extracted values against OCR words locally using CPU fuzzy matching. This is both faster (~1ms vs additional LLM tokens) and more reliable (deterministic matching vs probabilistic index prediction).
