# Excisely -- User Flows

End-to-end workflows for the two primary roles (applicant and labeling specialist), covering happy paths, edge cases, and security considerations.

---

## Happy Paths

### 1. Applicant Single Submission

The most common flow -- an applicant submits one label for verification against their COLA application data.

1. **Login** -- Applicant logs in with their credentials (e.g., `labeling@oldtomdistillery.com`)
2. **Navigate to New Submission** -- Dashboard shows "Submit New Label" action or applicant clicks "New Submission" in the sidebar
3. **Upload Label Image** -- Drag-and-drop or click to upload a label image (JPEG/PNG, up to 10MB). Client-side validation checks MIME type, file extension, and magic bytes before upload begins
4. **AI Extraction (First Pass)** -- The hybrid AI pipeline runs automatically:
   - Stage 1: Google Cloud Vision OCR extracts all text with word-level bounding polygons
   - Stage 2: GPT-4.1 classifies extracted text into Form 5100.31 fields (brand name, fanciful name, alcohol content, health warning, etc.)
   - Form fields pre-fill with extracted values within 2-5 seconds
5. **Review and Correct Pre-Fill** -- Applicant reviews each pre-filled field against their actual application data. They correct any AI misreads (e.g., OCR read "Barrel Aged" as "Barrel Aqed") and fill in any fields the AI could not extract. Applicants see extracted text values only -- no confidence scores, no match results
6. **Select Beverage Type** -- Applicant selects the product type (wine, beer, distilled spirits), which determines mandatory fields and valid container sizes
7. **Submit** -- Applicant submits the form. Server action re-validates all fields with Zod, then runs the AI pipeline a second time for verification:
   - The second pass compares applicant-confirmed values against a fresh AI read of the label
   - Field comparison engine runs exact, fuzzy, and normalized matching
   - Results generate per-field match status, confidence scores, and AI reasoning
8. **Confirmation** -- Applicant sees a confirmation page with their submission ID and current status (`received` or `processing`). They can track the label in their submissions list

### 2. Applicant Batch Submission

For applicants submitting multiple labels at once (e.g., a seasonal product line).

1. **Login** -- Same as single submission
2. **Navigate to Batch Upload** -- Applicant selects "Batch Upload" from the sidebar or dashboard
3. **Upload Multiple Images** -- Drag-and-drop or select up to 300 label images. `p-limit` controls concurrency to 5 parallel uploads to Vercel Blob. Per-file progress bars show upload status
4. **AI Extraction per Image** -- Each image is processed through the hybrid pipeline independently. Results populate as they complete (not blocked by other images in the batch)
5. **Review Each Label** -- Applicant steps through each label in the batch, reviewing and correcting pre-filled form data. Navigation controls (next/previous) move between labels in the batch
6. **Submit All** -- Batch submission triggers verification for all labels. Each label is processed as an independent server action (`process-batch-item`). A polling interval (2 seconds) updates the batch detail page with per-label progress
7. **Batch Confirmation** -- Applicant sees a batch summary with per-label status. They can click into any individual label for detailed results

### 3. Specialist Monday Morning

The high-throughput workflow for clearing a weekend's worth of submissions.

1. **Login** -- Specialist logs in (e.g., `sarah.chen@ttb.gov`)
2. **Dashboard Overview** -- Dashboard shows SLA metrics (labels processed today, average processing time, approaching deadlines) and two submission queues:
   - **"Ready to Approve" tab** -- Labels where: status is `pending_review`, AI proposed `approved`, all validation items match, and overall confidence >= threshold (default 95%). These are safe for batch approval
   - **"Needs Review" tab** -- Everything else in `pending_review` status. These require manual field-by-field review
3. **Batch Approve High-Confidence Labels** -- Specialist switches to "Ready to Approve" tab. They can:
   - Scan the list (sorted by submission date, oldest first)
   - Spot-check a few by clicking into the detail view, confirming all fields match
   - Select multiple labels via checkboxes
   - Click "Approve Selected" to batch-approve all selected labels in one action
4. **Switch to Needs Review** -- Specialist switches to the "Needs Review" tab for labels that need human judgment
5. **Detailed Review of Flagged Labels** -- For each flagged label:
   - Open the review detail page
   - View the annotated image with color-coded bounding boxes (green = match, amber = partial, red = mismatch)
   - Step through the field comparison checklist
   - For each flagged field, the specialist can: accept the AI result, override with a manual value, or mark the field as requiring applicant correction
   - Use keyboard shortcuts (A = approve, R = reject, C = conditionally approve, J/K = next/previous field, N/P = next/previous label) for throughput
6. **Submit Review Decision** -- Specialist submits their review with a status (approved, needs correction, conditionally approved, rejected) and optional notes. The system generates a communication report automatically
7. **Move to Next Label** -- Keyboard shortcut N advances to the next label in the queue

### 4. Specialist Re-Analysis

When a specialist suspects the AI made an error or wants a fresh analysis.

1. **Open Label Detail** -- Specialist navigates to a label that seems off (e.g., AI said "match" but the health warning looks truncated in the image)
2. **Click "Re-Analyze"** -- Triggers a fresh run of the hybrid AI pipeline on the same label image(s)
3. **Pipeline Re-Runs** -- Cloud Vision OCR re-processes the image, GPT-4.1 re-classifies. This produces new extraction results, new confidence scores, and new comparison results
4. **Review Updated Results** -- Specialist compares the new results against the previous analysis. If the re-analysis produces different results, the specialist uses their judgment to determine which is correct
5. **Make Final Decision** -- Specialist proceeds with their review based on the updated results

---

## Edge Paths

### 1. AI Extraction Fails

When the AI pipeline cannot extract fields from a label image (corrupt image, extremely unusual layout, API error).

1. **Applicant uploads image** -- Image is sent to Cloud Vision OCR
2. **OCR returns empty or error** -- Cloud Vision cannot read the image (e.g., blank image, non-label document, severely distorted photo)
3. **Graceful degradation** -- The form loads with empty fields instead of pre-filled values. An informational message tells the applicant that automatic extraction was not available for this image
4. **Manual entry** -- Applicant fills in all form fields manually, just as they would without AI assistance
5. **Submission proceeds normally** -- The verification pass (second AI run) still executes. Even if the first extraction failed, the second verification attempt may succeed on a re-read, or it may flag the label for specialist review due to low confidence
6. **End-to-end works** -- The system does not depend on successful AI extraction. Manual entry is always available as a fallback

### 2. Applicant Uploads Additional Images After Extraction

When an applicant adds more label images after the initial AI extraction has already pre-filled the form.

1. **Initial upload and extraction** -- Applicant uploads one image, AI extracts and pre-fills the form
2. **Applicant adds another image** -- Applicant realizes they need to include the back label or a detail shot and uploads additional images
3. **"Re-Scan" prompt appears** -- The UI detects that new images were added after extraction and prompts: "New images added. Re-scan to update extracted fields?"
4. **Applicant triggers re-scan** -- AI pipeline re-runs on all images (original + new). Updated extraction results may change pre-filled values
5. **Applicant reviews updated fields** -- Any changed fields are highlighted so the applicant can see what the new images affected
6. **Applicant confirms and submits** -- Normal submission flow continues

### 3. Specialist Changes Approval Threshold

When a specialist (or team lead) adjusts the confidence threshold that determines the "Ready to Approve" queue boundary.

1. **Navigate to Settings** -- Specialist opens the settings page
2. **Adjust confidence threshold** -- Slider moves from the default 95% to, say, 90% (more permissive) or 98% (more conservative)
3. **Save settings** -- Server action persists the new threshold
4. **Queue counts update** -- On the next dashboard load, the "Ready to Approve" and "Needs Review" counts recalculate based on the new threshold. A lower threshold moves more labels into "Ready to Approve"; a higher threshold moves more into "Needs Review"
5. **No retroactive changes** -- Labels that were already approved or rejected are not affected. The threshold only governs queue assignment for labels currently in `pending_review`

### 4. Deadline Expires While Label Is in Review Queue

When a label's correction deadline passes before a specialist has completed their review.

1. **Label has status `needs_correction`** -- Applicant was notified of required corrections with a 30-day deadline
2. **30 days elapse** -- No correction is submitted
3. **Specialist (or applicant) loads the label** -- `getEffectiveStatus()` runs at read time. It checks the `correction_deadline` column against the current timestamp
4. **Lazy expiration triggers** -- The function detects the deadline has passed and returns `rejected` as the effective status. A fire-and-forget database update persists the status change to the `labels` table
5. **UI reflects the true status** -- The label shows as "Rejected" with a note that the correction deadline expired. No cron job, no background process -- the expiration is computed inline on every read
6. **Same behavior for `conditionally_approved`** -- Labels with 7-day conditional approval deadlines follow the same pattern. Expired conditional approvals transition to `needs_correction`

---

## Security Considerations (Analyzed, Not Implemented)

These attack vectors were identified during design but are outside the scope of a prototype. They are documented here to demonstrate awareness and inform a production security posture.

### Adversarial Label Design

**Threat:** An applicant could design label artwork specifically to fool the AI pipeline -- using fonts, colors, or layouts that cause OCR misreads, or embedding text that reads differently to a machine than to a human eye.

**Examples:**

- Using a font where "l" (lowercase L) and "I" (uppercase I) are visually identical but OCR maps them differently
- Placing required text (e.g., health warning) in a color that blends with the background, visible to humans at certain angles but invisible to flat image scanning
- Splitting mandatory text across non-contiguous regions so the classifier cannot associate them

**Mitigation ideas (not implemented):**

- **Dual-model verification** -- Run two independent AI pipelines (e.g., Cloud Vision + Gemini OCR) and flag labels where results diverge
- **Suspicion scoring** -- Track per-applicant AI confidence trends. A sudden drop in extraction confidence for a previously reliable applicant could indicate adversarial intent
- **Rate limiting extraction** -- Prevent applicants from iterating rapidly on label designs by monitoring the scan-to-submit ratio
- **Canary fields** -- Include known-text fields in the verification (e.g., the exact GOVERNMENT WARNING text is static) as a baseline. If the AI cannot read the canary field correctly, flag the entire label for human review

### Batch Upload Abuse

**Threat:** A malicious or compromised account could submit hundreds of batch uploads to drain AI API credits (each label costs ~$0.003 in Cloud Vision + GPT-4.1 calls).

**Mitigation ideas (not implemented):**

- **Per-applicant daily cap** -- Limit each applicant to N label submissions per 24-hour period (e.g., 50 for standard accounts, 500 for verified high-volume producers)
- **API cost circuit breaker** -- Monitor aggregate AI API spend per hour. If spend exceeds a threshold (e.g., $50/hour), pause new submissions and alert administrators
- **Progressive rate limiting** -- First 10 submissions per hour are instant. Submissions 11-50 are queued with a 5-second delay. Beyond 50, the applicant is asked to contact support
- **Abuse detection** -- Flag accounts that submit labels with consistently low confidence scores or high rejection rates. These could indicate either adversarial testing or a misunderstanding of the system

### Session and Authentication

**Threat:** Prototype uses simple passwords (`specialist123`, `applicant123`) and 30-day session expiry, which are inappropriate for production.

**Production mitigations (not implemented):**

- SSO integration with TTB's identity provider (likely PIV/CAC card authentication for government workstations)
- Session expiry reduced to 8 hours (one work shift) with re-authentication required
- IP allowlisting for specialist accounts (government network only)
- Audit logging of all specialist actions (approvals, rejections, overrides) for compliance
