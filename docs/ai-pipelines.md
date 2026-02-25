# AI Pipeline Architecture

How Excisely extracts, classifies, and verifies alcohol label fields using a fully local pipeline — no external API calls.

---

## Overview

Every label that enters the system goes through a 3-stage pipeline:

```
                    Stage 1              Stage 2                Stage 3
                  +---------+     +------------------+     +----------------+
  Label Images -->|   OCR   |---->|  Classification  |---->|  Bounding Box  |--> Structured
  (Blob URLs)     |(Tesseract)|   | (Rules or LLM)  |     |   Resolution   |    Fields
                  +---------+     +------------------+     +----------------+
                   ~1-3s            ~5ms or ~1-2s                ~1ms
```

**Stage 1 — OCR** (Tesseract.js WASM): Extracts every word from label images with bounding boxes. Runs sequentially (WASM is single-threaded).

**Stage 2 — Classification** (hybrid): Two engines depending on the flow:
- **Specialist flow** (Rule Engine): Maps OCR text to TTB fields using regex, dictionary matching, and fuzzy text search. When application data is available, classification is a text-search problem. Zero outbound API calls.
- **Applicant pre-fill** (GPT-4.1-mini, optional): When `OPENAI_API_KEY` is set, uses GPT-4.1-mini for better brand_name/fanciful_name extraction. Falls back to rule engine when key is absent or on error.

**Stage 3 — Bounding Box Resolution** (local CPU): Matches classified field values back to their OCR word positions, producing normalized bounding boxes for the annotation viewer.

The specialist flow requires **zero outbound network calls** — critical for TTB's restricted network. The applicant pre-fill flow optionally calls OpenAI's API, with automatic rule-based fallback if the network blocks it.

---

## The Five Pipelines

The system has five pipelines optimized for different use cases. They all share Stage 1 (OCR) and Stage 3 (bounding box resolution) but differ in how Stage 2 (classification) is configured.

### Pipeline Comparison

```
                          App Data    Beverage    Word       Engine         Speed
  Pipeline       Flow     Provided?  Type Known? Indices?   (Stage 2)      (2 images)
  ─────────────  ───────  ────────   ──────────  ────────   ─────────────  ──────────
  Submission     special  Yes        Yes         No         rules          ~2-3.5s
  Specialist     special  Optional   Yes         Yes        rules          ~2-3.5s
  Fast Pre-fill  applic   No         Yes         No         LLM → rules   ~3-5s / ~2-3.5s
  Full Extract   applic   No         No          No         LLM → rules   ~3-5s / ~2-3.5s
  Auto-Detect    applic   No         Detected    No         LLM → rules   ~3-5s / ~2-3.5s
```

Specialist pipelines always use the rule engine (~5ms classification). Applicant pipelines auto-upgrade to GPT-4.1-mini when `OPENAI_API_KEY` is set (~1-2s classification), with automatic rule-based fallback. The bottleneck remains Tesseract.js OCR (~1-3s per image).

---

### 1. Submission Pipeline (Critical Path)

**Function:** `extractLabelFieldsForSubmission()`
**Used by:** All label processing actions

```
  Blob Storage        Tesseract.js          Rule Engine          Local CPU
  ┌──────────┐       ┌────────────┐       ┌──────────────┐     ┌──────────────┐
  │  Fetch   │──────>│    OCR     │──────>│ Fuzzy text   │────>│ Match fields  │
  │  images  │ bytes │  (WASM)    │ text  │ search with  │     │ to OCR words  │
  │          │       │            │       │ app data     │     │               │
  │ ~200ms   │       │  ~1-3s     │       │  ~5ms        │     │    ~1ms       │
  └──────────┘       └────────────┘       └──────────────┘     └──────────────┘
                                                |
                                          For each expected value
                                          from Form 5100.31:
                                          find WHERE it appears
                                          in OCR text (or confirm missing)
```

**Why this works:**

The specialist submission flow always has application data — the expected field values from Form 5100.31. This transforms classification from an identification problem ("figure out WHAT this text is") into a text-search problem ("find WHERE this expected value appears"). The rule engine:

1. **Exact substring match** (95% confidence) — handles clean OCR
2. **Ampersand normalization** (93%) — "Produced & Bottled by" → "Produced and Bottled by"
3. **Space-collapsed match** (90%) — "750mL" matches "750 mL"
4. **Fuzzy match via Dice coefficient** (variable) — handles OCR errors

**Callers:**

| Server Action            | Context                                    |
| ------------------------ | ------------------------------------------ |
| `submitApplication`      | Applicant submits completed COLA form      |
| `validateLabel`          | Specialist uploads label via validation UI |
| `reanalyzeLabel`         | Specialist re-runs AI on existing label    |
| `processBatchItem`       | Batch processing of queued labels          |
| `submitBatchApplication` | Applicant batch upload                     |

---

### 2. Specialist Pipeline (Full Extraction)

**Function:** `extractLabelFields()` / `extractLabelFieldsFromBuffers()`
**Used by:** Test scripts, direct extraction

Same as submission pipeline but supports optional application data and word index mapping via the combined word list. When application data is provided, behaves identically to the submission pipeline.

---

### 3. Fast Pre-fill Pipeline

**Function:** `extractLabelFieldsForApplicantWithType()`
**Used by:** Applicant form pre-fill when beverage type is known

When `OPENAI_API_KEY` is set, uses GPT-4.1-mini for extraction via `classifyFieldsForExtraction()` → `llmExtractFields()`. This significantly improves brand_name and fanciful_name accuracy (proper nouns that rules can't identify). Falls back to rule-based extraction on error or when key is absent.

**Rule-based fallback** uses type-specific field lists with per-field extractors:

- **Tier 0 (exact match):** health_warning (GOVERNMENT WARNING prefix), qualifying_phrase (21 phrases), sulfite_declaration
- **Tier 1 (regex):** alcohol_content (XX% Alc./Vol.), net_contents (750 mL), vintage_year, age_statement, country_of_origin
- **Tier 2 (dictionary):** class_type (TTB code descriptions), grape_varietal (~60 varieties), appellation_of_origin (~80 AVAs), name_and_address (text after qualifying phrase)
- **Tier 3 (heuristic):** brand_name, fanciful_name (two-pass exclusion, ~60% accuracy)

---

### 4. Full Extraction Pipeline (No Beverage Type)

**Function:** `extractLabelFieldsForApplicant()`
**Used by:** Fallback for Pipeline 5 when keyword detection fails

Extracts the union of all fields across all beverage types. Less focused than type-specific extraction but covers all possible fields.

---

### 5. Auto-Detect Pipeline

**Function:** `extractLabelFieldsWithAutoDetect()`
**Used by:** Applicant form pre-fill when beverage type is not selected

```
  Blob Storage        Tesseract.js       Keyword Detection     Rule Engine       Local CPU
  ┌──────────┐       ┌────────────┐       ┌──────────────┐     ┌──────────────┐ ┌──────────┐
  │  Fetch   │──────>│    OCR     │──────>│ Score types  │─┬──>│ Fast Extract │>│ Match    │
  │  images  │ bytes │  (WASM)    │ text  │ by keywords  │ │   │ (type-aware) │ │ fields   │
  │          │       │            │       │              │ │   │              │ │ to OCR   │
  │ ~200ms   │       │  ~1-3s     │       │  ~0ms        │ │   │  ~5ms        │ │  ~1ms    │
  └──────────┘       └────────────┘       └──────────────┘ │   └──────────────┘ └──────────┘
                                                 │         │
                                            (ambiguous?)   └──> Full Extract ──> Match fields
```

Keyword detection scores each beverage type by counting OCR text hits against type-specific keyword lists (~30 keywords per type). Winner needs 1+ more hits than runner-up. Falls back to full extraction if ambiguous.

---

## Stage Details

### Stage 1: OCR (Tesseract.js WASM)

**File:** `src/lib/ai/ocr.ts`
**Engine:** Tesseract.js v7 with `eng.traineddata` (bundled in `public/tesseract/`)

```
  Input: Image buffer (JPEG/PNG)
    |
    v
  sharp preprocessing:
    - EXIF auto-orient (fixes phone photo rotation)
    - Grayscale conversion (reduces noise)
    - Contrast normalization (helps low-contrast text)
    - Resize to max 2000px (balances accuracy vs speed)
    - Output as PNG (lossless)
    |
    v
  Tesseract WASM (PSM 11 — sparse text mode)
    |
    v
  Output: {
    words: [                          // Every word with bounding box
      {
        text: "GOVERNMENT",
        boundingPoly: {
          vertices: [                 // 4 corners (axis-aligned rectangle)
            { x: 120, y: 450 },      // top-left
            { x: 340, y: 450 },      // top-right
            { x: 340, y: 475 },      // bottom-right
            { x: 120, y: 475 },      // bottom-left
          ]
        },
        confidence: 0.92             // 0-1 (normalized from Tesseract's 0-100)
      },
      ...
    ],
    fullText: "GOVERNMENT WARNING...", // All text concatenated
    imageWidth: 1200,                  // From sharp metadata
    imageHeight: 1600
  }
```

**Key properties:**

- Word-level granularity via block → paragraph → line → word hierarchy
- Axis-aligned bounding boxes (rectangles, not rotated polygons)
- PSM 11 (sparse text) optimized for scattered label layouts
- Single worker (singleton, lazy init) — WASM is single-threaded
- Sequential multi-image processing (no benefit from Promise.all)
- ~1-3s per image depending on complexity
- $0 per image (runs locally)

**Bounding box format note:** Tesseract returns `{x0, y0, x1, y1}` rectangles. These are converted to 4-vertex polygons `[{x,y}, ...]` at OCR output time to match the interface that `bounding-box-math.ts` and the annotation viewer expect. `computeTextAngle()` returns 0 for all text (no rotation detection from axis-aligned boxes).

### Stage 2: Classification (Rule Engine)

**File:** `src/lib/ai/rule-classify.ts`

Two modes depending on whether application data is available:

**With application data (specialist flow):**

```
  For each expected field value from Form 5100.31:
    1. Exact substring match in normalized OCR text → 95% confidence
    2. Ampersand-normalized match ("&" → "and") → 93% confidence
    3. Space-collapsed match ("750mL" = "750 mL") → 90% confidence
    4. Fuzzy match via Dice coefficient sliding window → similarity * 100
    5. Not found → null value, 0% confidence
```

**Without application data (applicant flow):**

```
  Per-field extractors using regex, dictionary, and heuristic matching:
    - health_warning:      "GOVERNMENT WARNING" prefix search
    - qualifying_phrase:   Match against 21 canonical phrases (longest first)
    - alcohol_content:     /(\d+(?:\.\d+)?)\s*%\s*alc/i and proof patterns
    - net_contents:        /(\d+(?:\.\d+)?)\s*m[lL]/  and unit patterns
    - grape_varietal:      Dictionary of ~60 varietal names
    - appellation_of_origin: Dictionary of ~80 AVAs and regions
    - class_type:          Match against TTB code descriptions + common types
    - vintage_year:        /\b(19\d{2}|20[0-2]\d)\b/
    - age_statement:       /aged\s+(\d+)\s*years?/i patterns
    - country_of_origin:   "Product of X" / "Imported from X" patterns
    - name_and_address:    Text following qualifying phrase
```

### Stage 3: Bounding Box Resolution

**File:** `src/lib/ai/text-matching.ts`

All pipelines use the same text-matching strategy:

```
  Rule engine returns value "750 mL"
         |
         v
  findMatchingWords("750 mL", allOcrWords)
  sliding window, fuzzy match, smart-join for split numbers
         |
         v
  computeNormalizedBoundingBox()
  from matched OCR word vertices
         |
         v
  { x: 0.12, y: 0.65,
    width: 0.08, height: 0.02,
    angle: 0 }
```

**Text matching algorithm** (`findMatchingWords`):

1. Normalize both strings (lowercase, strip punctuation, collapse whitespace)
2. Slide a window across OCR words (up to 60 words wide)
3. Smart-join adjacent tokens that form split numbers ("12." + "5%" → "12.5%")
4. Space-collapsed fallback ("750mL" matches "750 mL")
5. Return best match if coverage >= 60%
6. Runs in <1ms for typical labels (~150 words)

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

---

## Cost Model

| Component                       | Cost               | Per Label              |
| ------------------------------- | ------------------ | ---------------------- |
| Tesseract.js OCR                | $0 (local WASM)    | $0                     |
| Rule-based classify (specialist)| $0 (local CPU)     | $0                     |
| GPT-4.1-mini (applicant, opt.)  | OpenAI pricing     | ~$0.001                |
| Blob storage fetch              | Vercel Blob pricing | ~$0.0001 (2 images)    |
| **Specialist flow**             |                    | **~$0.0001**           |
| **Applicant flow (with LLM)**   |                    | **~$0.001**            |
| **Applicant flow (rules only)** |                    | **~$0.0001**           |

The specialist flow remains at effectively $0/label. Applicant pre-fill adds ~$0.001 when `OPENAI_API_KEY` is set (text-only — no images sent to the LLM). Without the key, applicant flow costs the same as specialist.

---

## Why This Architecture

**Why not cloud AI APIs?**

Marcus Williams (TTB IT Systems Admin) explicitly warns: "our network blocks outbound traffic to a lot of domains." The scanning vendor pilot failed because their ML endpoints were blocked. Any architecture that requires `api.openai.com` or `vision.googleapis.com` would face the same fate. The local pipeline runs entirely on Vercel serverless with zero outbound API calls.

**Why Tesseract.js over other local OCR?**

Tesseract.js v7 is the most mature WASM OCR library. It runs in Node.js (Vercel serverless), handles multiple languages, and produces word-level bounding boxes. The `eng.traineddata` file (~15MB) is bundled in `public/tesseract/` and loaded at worker initialization — no CDN download needed at runtime.

**Why rule-based classification instead of a local LLM?**

The specialist flow (critical path) always has application data — expected values from Form 5100.31. Finding "WHERE does '45% Alc./Vol.' appear in this OCR text?" is a text search problem, not a language understanding problem. Regex, dictionary matching, and fuzzy search solve it in ~5ms with no GPU, no model weights, and deterministic results. A local LLM (Ollama/vLLM) would require GPU infrastructure and add deployment complexity for no practical benefit.

**Why sequential OCR (not parallel)?**

Tesseract.js WASM is single-threaded. `Promise.all` would serialize anyway. Sequential processing is clearer, and two images complete in ~2-4s total — well within the 5-second target. A worker pool could be added later if needed.

**Why axis-aligned bounding boxes are acceptable?**

Tesseract returns rectangles `{x0, y0, x1, y1}`, not rotated polygons like Google Cloud Vision. We convert to 4-vertex format for interface compatibility. `computeTextAngle()` returns 0 for all text. The SVG annotation overlay still renders correctly — rectangles are accurate for text position, just without rotation indicators. Most label text is horizontal anyway.
