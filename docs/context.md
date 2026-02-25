# TTB Label Verification — Real-World Context

This document provides real-world background on the TTB COLA process, regulatory requirements, and industry context relevant to building the AI-powered label verification prototype.

---

## What Is a COLA?

A **Certificate of Label Approval (COLA)** is a federal certificate issued by the Alcohol and Tobacco Tax and Trade Bureau (TTB), a bureau within the U.S. Department of the Treasury. Every alcohol producer or importer must obtain a COLA before a product can legally be sold in the United States. No COLA = no sales.

- **Form**: TTB Form 5100.31 ("Application for and Certification/Exemption of Label/Bottle Approval")
- **No application fee** (paper or electronic)
- **Applies to**: All containers of wine (7%+ ABV), distilled spirits, and malt beverages
- **Digital system**: COLAs Online (ttbonline.gov) — available 22 hours/day, 7 days/week

---

## Volume & Scale

| Metric                               | Value              | Year         |
| ------------------------------------ | ------------------ | ------------ |
| Label applications per year          | ~190,000–193,000   | FY 2020–2022 |
| Formula applications per year        | ~27,000            | FY 2022      |
| Total COLAs in registry (cumulative) | 2.6 million+       | All time     |
| Approved breweries                   | 14,597             | End 2023     |
| Active wineries                      | ~11,000+           | Est.         |
| Active distilleries                  | ~2,700+            | Est.         |
| Label application error rate         | 28%                | FY 2023      |
| Formula application error rate       | 23%                | FY 2023      |
| Typical COLA processing time         | 5–15 business days | Varies       |

The 150,000 figure mentioned in the task doc is actually conservative — real volume is closer to **190,000+ per year**.

---

## TTB Staffing & the DOGE Situation

- **Pre-2025**: ~520 employees total
- **Post-DOGE cuts (May 2025)**: ~450 employees — a **13% reduction** via two rounds of "voluntary resignations"
- **Impact**: DSP permit approvals running at 81 days (exceeds 75-day target), label processing times increasing
- **Budget**: ~$149.6M direct appropriations (FY 2024); TTB collects ~$25 billion annually in excise taxes — one of the most cost-efficient federal agencies
- **TTB is actively exploring AI for label review** — driven by necessity after staff cuts, not by proactive planning

> "The agency is exploring artificial intelligence to assist with label review and approval — something it should have pursued long ago." — Reason Magazine, June 2025

This makes our prototype **extremely timely** — TTB is literally looking for exactly this kind of tool right now.

---

## The COLA Review Process

### Submission Flow

1. Applicant must hold a valid TTB permit (Brewer's Notice, Basic Permit, or DSP)
2. Register for COLAs Online (TTB Form 5013.2)
3. Upload label images: JPEG or PNG, max 1.5 MB, 120–170 dpi recommended
4. Complete application fields (Form 5100.31)
5. System performs built-in validation (catches common omissions)
6. Submit — receives TTB ID number for tracking

### Application Statuses

- **Received**: Initial submission accepted
- **Approved**: Label meets all requirements
- **Conditionally Approved**: Approval with noted conditions
- **Needs Correction**: 30-day window to fix issues (corrected apps get **priority processing**)
- **Rejected**: Final denial (if 30-day correction window lapses or fundamental issues)

### Common Rejection Reasons

1. **Government Warning Statement errors** — wrong formatting, caps, bold, punctuation, type size
2. **Net contents violations** — non-standard sizes, wrong units, wrong format for beverage type
3. **Misleading information** — false origin claims, incorrect age statements
4. **Missing mandatory information** — sulfite declaration, name/address, alcohol content
5. **Type size below minimums** for the container size
6. **Unapproved ingredients or health claims**

The 28% error rate means roughly **1 in 4 label applications has issues** — this is exactly the kind of thing AI can catch before it reaches a human reviewer.

---

## TTB Official Vocabulary

Our app must use TTB's exact terminology to feel authentic. Key terms:

| TTB Term                              | NOT This                   | Notes                                                                                                        |
| ------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Brand Name**                        | Trade Name                 | Form Item 6: "The name under which the product is sold"                                                      |
| **Fanciful Name**                     | Product Name, Subtitle     | Form Item 7: "A name that further identifies the product" — separate from Brand Name                         |
| **Alcohol Content**                   | ABV, Proof                 | Expressed as "% alc/vol" on labels; "Alcohol Content" on the form                                            |
| **Net Contents**                      | Volume, Size               | Form Item 12: "Total Bottle Capacity (Net Contents)"                                                         |
| **Health Warning Statement**          | Government Warning         | The _requirement_ is "Health Warning Statement" (27 CFR Part 16). The _label text_ says "GOVERNMENT WARNING" |
| **Name and Address**                  | Producer, Manufacturer     | Must include a qualifying phrase: "Bottled by", "Distilled by", "Imported by", etc.                          |
| **Class, Type, or Other Designation** | Category, Style            | Shortened to "Class/Type" in data fields; uses numeric codes (0-999)                                         |
| **Type of Product**                   | Beverage Type              | Form Item 5: Wine / Distilled Spirits / Malt Beverages                                                       |
| **Labeling Specialist**               | Agent, Reviewer, Examiner  | Official TTB job title for the person who reviews COLAs                                                      |
| **Applicant**                         | Submitter                  | The entity submitting the COLA application                                                                   |
| **Certificate Holder**                | Permit Holder              | The entity holding an approved COLA                                                                          |
| **TTB ID**                            | COLA Number                | 14-character unique identifier per application                                                               |
| **Serial Number**                     | Application Number         | Applicant-assigned sequential number (Item 4, format: `YY-NNN`)                                              |
| **eApplication**                      | Online Application         | TTB's term for electronically filed applications (lowercase 'e')                                             |
| **Needs Correction**                  | Returned, Pending Revision | Official intermediate status                                                                                 |
| **Conditionally Approved**            | Tentatively Approved       | TTB proposes minor field corrections; 7-day accept/decline window                                            |

### Form 5100.31 Key Fields (Exact Item Labels)

| Item # | Field Label                              | Notes                                                             |
| ------ | ---------------------------------------- | ----------------------------------------------------------------- |
| 1      | REP. ID. NO.                             | Third-party representative ID                                     |
| 2      | PLANT REGISTRY/BASIC PERMIT/BREWER'S NO. | Permit/authorization number                                       |
| 3      | SOURCE                                   | Domestic / Imported                                               |
| 4      | SERIAL NUMBER                            | Applicant-assigned, format `YY-NNN`                               |
| 5      | TYPE OF PRODUCT                          | Wine / Distilled Spirits / Malt Beverages                         |
| 6      | BRAND NAME                               | Name under which product is sold                                  |
| 7      | FANCIFUL NAME                            | Distinctive/descriptive name (optional for standard products)     |
| 8      | NAME AND ADDRESS OF APPLICANT            | As shown on permit/notice                                         |
| 9      | EMAIL ADDRESS                            | Contact for TTB response                                          |
| 10     | GRAPE VARIETAL(S)                        | Wine only                                                         |
| 11     | FORMULA                                  | Pre-COLA product evaluation reference                             |
| 12     | TOTAL BOTTLE CAPACITY (NET CONTENTS)     | Container size(s)                                                 |
| 13     | ALCOHOL CONTENT                          | As stated on label                                                |
| 14     | WINE APPELLATION OF ORIGIN               | Wine only                                                         |
| 15     | WINE VINTAGE DATE                        | Wine only                                                         |
| 16-17  | PHONE / FAX NUMBER                       | Contact info                                                      |
| 18     | TYPE OF APPLICATION                      | (a) COLA, (b) Exemption, (c) Distinctive Bottle, (d) Resubmission |

### Name and Address Qualifying Phrases

The label must include one of these before the name and address:
"Bottled by", "Packed by", "Distilled by", "Blended by", "Produced by", "Prepared by", "Manufactured by", "Made by", "Brewed by", "Imported by", "Cellared and bottled by", "Vinted and bottled by", "Estate Bottled"

---

## Application Status Lifecycle

```
[Saved Not Submitted] → [Received] → [Assigned] → Decision
                                                      |
                    +---------------+-----------------+-----------------+
                    |               |                 |                 |
              [Approved]   [Conditionally      [Needs            [Rejected]
                            Approved]         Correction]
                              |                   |
                        7 days to            30 days to
                        accept/decline        correct
                           |    |               |         |
                      Accept  Decline/     Corrected    Not corrected
                         |    No action       |         within 30 days
                         v        v           v              |
                    [Approved]  [Needs    [Received]         v
                              Correction] (priority!)   [Rejected]
```

**Key statuses:**

- **Received** — in queue awaiting specialist assignment
- **Needs Correction** — returned with specific issues; 30-day correction window; corrected resubmissions get **priority processing**
- **Conditionally Approved** — TTB proposes minor changes to 4 fields only (Brand Name, Fanciful Name, Appellation, Grape Variety); 7-day accept/decline window
- **Approved** — COLA issued; posted to Public COLA Registry after 48-hour delay
- **Rejected** — final denial (usually from expired 30-day window)

---

## Class/Type Codes (Selected)

TTB uses numeric codes (0-999) for product classification:

**Whisky (100-199):** 101 = Straight Bourbon Whisky, 102 = Straight Rye Whisky, 130 = Whisky Blends, 150 = Scotch Whisky
**Gin (200-299):** 200 = Distilled Gin, 201 = London Dry Distilled Gin
**Vodka (300-399):** 300 = Vodka, 330 = Vodka - Flavored
**Rum (400-499):** 400 = Rum, 430 = Rum Flavored
**Brandy (500-599):** 500+ = various brandy types
**Cordials (600-699):** 660 = Cordials (Herbs & Seeds), 690 = Specialties
**Wine (80-89):** 80 = Table Red Wine, 81 = Table White Wine, 84 = Sparkling Wine/Champagne, 88 = Dessert/Port/Sherry
**Malt Beverages (900-909):** 901 = Beer, 902 = Ale, 903 = Malt Liquor, 906 = Malt Beverages Specialties - Flavored

---

## Mandatory Label Elements by Beverage Type

### All Beverages (Common)

- Brand name (Form Item 6)
- Fanciful name (Form Item 7, when applicable)
- Class/type designation (with numeric code)
- Alcohol content
- Net contents
- Name and address with qualifying phrase ("Bottled by", etc.)
- Health Warning Statement ("GOVERNMENT WARNING" on label)
- Country of origin (imports only)

### Distilled Spirits (27 CFR Part 5) — Additional

- Age statement (required for certain spirits)
- State of distillation
- Neutral spirits disclosure
- Coloring/wood treatment disclosure
- Standards of fill (January 2025 final rule, expanded): 50mL, 100mL, 187mL, 200mL, 250mL, 331mL, 350mL, 355mL, 375mL, 475mL, 500mL, 570mL, 700mL, 710mL, 720mL, 750mL, 900mL, 945mL, 1L, 1.5L, 1.75L, 1.8L, 2L, 3L, 3.75L

### Wine (27 CFR Part 4) — Additional

- Appellation of origin (conditional)
- Vintage date (optional, but triggers appellation requirement)
- Grape varietal (optional, triggers 75% minimum from named variety)
- Sulfite declaration (mandatory if 10+ ppm SO2)
- Alcohol tolerance: wines 7–14% may use "table wine" or "light wine" instead of numeric ABV
- Standards of fill (January 2025 final rule): 180mL, 187mL, 200mL, 250mL, 300mL, 330mL, 360mL, 375mL, 473mL, 500mL, 550mL, 568mL, 600mL, 620mL, 700mL, 720mL, 750mL, 1L, 1.5L, 1.8L, 2.25L, 3L

### Malt Beverages (27 CFR Part 7) — Additional

- ABV required if alcohol from flavors or non-beverage ingredients
- **No federal standard of fill** — any container size is permitted
- 2023 rule change: strength claims like "strong" or "full strength" now permitted
- "IPA" alone triggers rejection — must spell out "India Pale Ale" or include "Ale" separately on label
- Specialty malt beverages (fruit/spice/honey) require fanciful name + statement of composition instead of traditional class designation

---

## Government Warning Statement — Exact Required Text

> **GOVERNMENT WARNING**: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

### Formatting Requirements (27 CFR 16.22)

- **"GOVERNMENT WARNING"** must be in **CAPITAL LETTERS** and **BOLD**
- The rest of the text must **NOT** be bold
- Must be a **continuous statement** (no line breaks splitting the meaning)
- Must be **readily legible** under ordinary conditions
- Must appear on a **contrasting background**
- Must be **separate and apart** from all other information

### Minimum Type Size by Container

| Container Size        | Min Type Size | Max Characters/Inch |
| --------------------- | ------------- | ------------------- |
| 237 mL (8 oz) or less | 1 mm          | 40                  |
| 237 mL – 3 L          | 2 mm          | 25                  |
| Over 3 L              | 3 mm          | 12                  |

### Penalty

Civil penalty of up to **$26,225 per day** for violations.

---

## Type Size Requirements (General)

### Distilled Spirits

- All mandatory info: minimum **1 mm**
- Net contents: minimum **2 mm** for containers over 200 mL

### Wine

- Up to 187 mL: minimum **1 mm**
- 188 mL – 3 L: minimum **2 mm**
- Over 3 L: minimum **3 mm**
- ABV statement: not larger than 3 mm nor smaller than 1 mm (containers 5L or less)

### Malt Beverages

- Similar minimums based on container size

---

## Upcoming Regulatory Changes

### Proposed "Alcohol Facts" Panel (January 2025)

Two major proposed rules would require an **"Alcohol Facts"** panel (like FDA Nutrition Facts) on all TTB-regulated beverages:

**Required disclosures**: serving size, servings per container, ABV, fluid ounces of pure alcohol per serving, calories, carbohydrates, protein, fat

**Major Food Allergen Labeling**: Would require declaration of 9 major allergens (milk, eggs, fish, shellfish, tree nuts, wheat, peanuts, soybeans, sesame)

**Timeline**: 5-year phase-in from final rule. Comment period extended to August 15, 2025.

This is relevant because it means **label requirements are about to get more complex**, making AI verification even more valuable.

---

## Allowable Revisions (No New COLA Needed)

Changes that do **NOT** require a new COLA:

- Removing non-mandatory text/illustrations
- Repositioning label information
- Changing background color, text color, shape, font
- Changing type size or font style
- Updating net contents statement
- Updating address within same state
- Adding/removing QR codes, websites, phone numbers
- Adding holiday-themed graphics

Changes that **DO** require a new COLA:

- New graphics, pictures, or representations
- New wording, phrases, text, or certifications
- Changes to any mandatory information (brand name, class/type, ABV, etc.)

**Key nuance**: Deletion of optional info is generally fine; **addition** of new non-mandatory language typically requires a new COLA.

---

## Industry Pain Points

1. **Inconsistent reviewer decisions** — different ALFD reviewers sometimes interpret regulations differently
2. **Processing time volatility** — swings from 3 days to 20+ days based on staffing and volume
3. **Opaque rejection reasons** — rejection notices sometimes lack sufficient specificity
4. **No expedite option** — no paid priority lane exists
5. **Seasonal crunch** — Q4 accounts for ~70% of alcohol sales; producers submit holiday labels in late summer/early fall, creating surge periods
6. **Government shutdowns** create additional backlog risk

---

## Existing Tech in the Space

- **COLAs Online**: TTB's electronic filing system with built-in validation rules (reduces errors vs paper)
- **myTTB**: Modernization initiative to unify all TTB online services ($1.784M FY2025 request)
- **Sovos LabelVision**: OCR-based tool for searching TTB-approved label images in the COLA registry
- **COLA Cloud**: AI-enriched structured data from the COLA registry (2.6M+ records, REST API, LLM-powered feature extraction)
- **No evidence of AI-based label image analysis within TTB itself** — the scanning vendor pilot referenced in the task doc has no match in public TTB documentation

---

## Key Implications for Our Prototype

1. **Volume is real**: 190K+ applications/year, 28% error rate — there's genuine need for automated verification
2. **Timing is perfect**: TTB is actively exploring AI for label review after DOGE staff cuts
3. **Government warning is the #1 issue**: Most common rejection reason, and the formatting rules are strict and specific — our AI needs to nail this
4. **Multiple beverage types matter**: Spirits, wine, and beer have different requirements — our tool should handle all three
5. **The 5-second target is reasonable**: Current human review takes 5–10 minutes; the failed vendor took 30–40 seconds; 5 seconds would be genuinely transformative
6. **Error rate context**: If 28% of applications have errors, a pre-submission AI check could theoretically prevent those errors before they ever reach TTB — massive value prop
7. **Upcoming Alcohol Facts rules** will make labels more complex and verification more valuable
8. **Batch processing is real**: Large importers submit hundreds of labels at once during seasonal rushes

---

## Sources

- [TTB COLA Overview](https://www.ttb.gov/alfd/certificate-of-label-aproval-cola)
- [TTB Processing Times](https://www.ttb.gov/labeling/processing-times)
- [TTB Distilled Spirits Labeling](https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-brand-label)
- [TTB Wine Labeling](https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/anatomy-of-a-label)
- [TTB Malt Beverage Labeling](https://www.ttb.gov/beer/labeling/malt-beverage-mandatory-label-information)
- [27 CFR Part 16 — Health Warning](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16)
- [TTB Allowable Revisions](https://www.ttb.gov/regulated-commodities/labeling/allowable-revisions)
- [TTB FY2025 Budget](https://home.treasury.gov/system/files/266/13.-TTB-FY-2025-BIB.pdf)
- [TTB Staff Shrinks 13% — FIVE x 5](https://fx5.com/ttb-staff-shrinks-13/)
- [Reason — TTB Efficiency After DOGE](https://reason.com/2025/06/14/some-federal-agencies-are-actually-getting-more-efficient/)
- [Sovos LabelVision](https://sovos.com/shipcompliant/products/labelvision/)
- [COLA Cloud](https://colacloud.us/)
- [COLAs Online FAQs](https://www.ttb.gov/faqs/colas-and-formulas-online-faqs)
- [Brewers Association — Proposed Regulations](https://www.brewersassociation.org/government-affairs-updates/ttb-proposes-sweeping-new-regulations/)
- [TTB Form 5100.31 PDF](https://www.ttb.gov/media/70320/download)
- [TTB eApplication Statuses (PDF)](https://www.ttb.gov/system/files/images/pdfs/labeling_colas-docs/eapplication-statuses-in-colas.pdf)
- [TTB Conditionally Approved COLAs](https://www.ttb.gov/public-information/what-are-conditionally-approved-colas)
- [TTB ALFD Division](https://www.ttb.gov/about-ttb/who-we-are/offices/alcohol-labeling-and-formulation-division)
- [TTB Boot Camp for Brewers: Labeling](https://www.ttb.gov/system/files/images/pdfs/TTB_Boot_Camp_for_Brewers-_Labeling.pdf)
- [27 CFR Part 13 — Labeling Proceedings](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-13)
- [27 CFR Part 5 — Distilled Spirits Standards of Identity](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-I)
- [Federal Register: Standards of Fill Final Rule (Jan 2025)](https://www.federalregister.gov/documents/2025/01/10/2025-00271/standards-of-fill-for-wine-and-distilled-spirits)
- [COLA Cloud — TTB Data Definitions](https://www.colacloud.us/posts/ttb-data-definitions)
- [Lehrman Beverage Law — COLA Services](https://bevlaw.com/services/labeling/)
- [Lindsey Zahn P.C. — What is a TTB COLA?](https://www.zahnlawpc.com/what-is-a-ttb-cola/)
- [Park Street Imports — Common COLA Mistakes](https://www.parkstreet.com/the-most-common-cola-mistakes-to-avoid/)
- [TTB Malt Beverage Class and Type](https://www.ttb.gov/regulated-commodities/beverage-alcohol/beer/labeling/malt-beverage-class-and-type)
- [TTB Distilled Spirits Label Anatomy Tool](https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/anatomy-of-a-distilled-spirits-label-tool)
