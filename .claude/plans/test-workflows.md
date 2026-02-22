# Test Workflows: AI-Powered Alcohol Label Verification App

This document defines common and edge case user workflows that should be covered by automated tests (Vitest unit/integration + Playwright E2E) and manual QA during feature development.

---

## Conventions

- **[Unit]** = Vitest unit test (pure function, Zod schema, utility)
- **[Integration]** = Vitest integration test (server action with mocked deps)
- **[E2E]** = Playwright end-to-end test (full browser flow)
- **[Manual]** = Manual QA checkpoint (visual, subjective, or too complex to automate)

---

## 1. Authentication & Authorization

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 1.1 | Specialist login | [E2E] | Navigate to `/login`, enter valid email/password, verify redirect to dashboard, verify role badge shows "Specialist" |
| 1.2 | Admin login | [E2E] | Login as Sarah Chen, verify admin dashboard link visible in sidebar, verify "Settings" link visible |
| 1.3 | Logout | [E2E] | Click user menu → Sign Out, verify redirect to `/login`, verify protected routes are inaccessible |
| 1.4 | Session persistence | [E2E] | Login, close tab, reopen → should still be authenticated (30-day session) |
| 1.5 | Auth redirect | [E2E] | Visit `/validate` without session → redirect to `/login` with return URL |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 1.6 | Wrong password | [E2E] | Enter wrong password 3 times, verify rate limiting message appears |
| 1.7 | Specialist accesses admin route | [Integration] | Specialist session hits `/admin` → verify 403/redirect |
| 1.8 | Specialist calls admin server action | [Integration] | Call `update-settings` with specialist session → verify rejection |
| 1.9 | Expired session | [Integration] | Server action with expired session token → verify 401 |
| 1.10 | No session cookie | [Integration] | Server action with no session → verify rejection before any DB query |

---

## 2. Single Label Validation

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 2.1 | Happy path: spirits label | [E2E] | Select "Distilled Spirits", upload bourbon label image, fill all Form 5100.31 fields, click Validate, verify results page shows with annotated image + field comparison |
| 2.2 | Happy path: wine label | [E2E] | Select "Wine", verify wine-specific fields appear (grape varietal, appellation, vintage, sulfite), fill and validate |
| 2.3 | Happy path: malt beverage | [E2E] | Select "Malt Beverages", verify standards of fill shows "Any size permitted", validate |
| 2.4 | All fields match → Quick Approve | [E2E] | Submit label where all fields match, verify Quick Approve card appears with green bboxes, one-click approve, verify status = Approved |
| 2.5 | Field mismatch → Needs Correction | [E2E] | Submit with wrong ABV (form says 45%, label says 40%), verify Needs Correction status, verify diff highlighting shows the discrepancy |
| 2.6 | Health warning mismatch | [E2E] | Submit label with "Government Warning" (title case, not all caps), verify rejection with specific health warning error |
| 2.7 | Standards of fill violation | [Integration] | Submit 600mL bourbon → verify `standards_of_fill` validation item shows mismatch (600mL not in spirits list) |
| 2.8 | Class/type code selection | [E2E] | Type "bourbon" in class/type dropdown → verify "101 - Straight Bourbon Whisky" appears, select it |
| 2.9 | Qualifying phrase selection | [E2E] | Select "Bottled by" from qualifying phrase dropdown, verify it's stored in application_data |
| 2.10 | Health warning pre-fill | [E2E] | Verify health warning textarea pre-fills with exact 27 CFR Part 16 text, verify it's editable |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 2.11 | Brand name case variation | [Integration] | Application: "STONE'S THROW", Label extracted: "Stone's Throw" → verify moderate match (not mismatch) |
| 2.12 | ABV format normalization | [Integration] | Application: "45%", Extracted: "45% Alc./Vol. (90 Proof)" → verify match after normalization |
| 2.13 | Net contents unit normalization | [Integration] | Application: "750 mL", Extracted: "750ml" → verify match. Also test "75cL" ↔ "750 mL" |
| 2.14 | Special characters in brand name | [Integration] | "Chateau Lafite-Rothschild" with accent marks, apostrophes, hyphens → verify extraction handles UTF-8 |
| 2.15 | Missing optional fields | [Integration] | Domestic spirits label with no country of origin → verify field is skipped, not flagged as "not found" |
| 2.16 | Very long brand name | [Integration] | 100+ character brand name → verify no truncation in comparison, UI doesn't break |
| 2.17 | Non-image file upload | [Integration] | Upload a .pdf or .txt file → verify magic byte check rejects it with clear error |
| 2.18 | Oversized file | [Integration] | Upload >10MB image → verify rejection with file size error |
| 2.19 | Corrupt image file | [Integration] | Upload file with .jpg extension but invalid image data → verify graceful error |
| 2.20 | AI timeout/failure | [Integration] | Mock OpenAI returning 500 → verify error message, label status stays `pending`, retry possible |
| 2.21 | Low confidence extraction | [Integration] | Mock AI returning 65% confidence on brand name → verify field routes to `needs_correction` |
| 2.22 | Wine without sulfite declaration | [Integration] | Wine label missing sulfite declaration → verify flagged (mandatory for wine) |
| 2.23 | Spirits without age statement | [Integration] | Bourbon under 4 years without age statement → verify flagged (required for spirits <4 years) |
| 2.24 | Malt beverage ABV rules | [Integration] | Hard seltzer with alcohol from flavors → verify ABV is required. Regular beer → verify ABV optional per state |
| 2.25 | Multi-image label | [E2E] | Upload front + back + neck images, verify tabbed image viewer, verify fields extracted from correct image |
| 2.26 | Country of origin mismatch | [Integration] | Application: "Scotland", Label: "Product of Scotland, United Kingdom" → verify lenient match |

---

## 3. Side-by-Side Comparison & Annotations

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 3.1 | Diff highlighting | [E2E] | View detail page for mismatched label, verify character-level diff (green=match, red=different) |
| 3.2 | Bbox click-to-highlight | [E2E] | Click a field in the comparison panel → verify corresponding bbox highlights on image |
| 3.3 | Image tab switching | [E2E] | Multi-image label: click field from back label → verify image viewer auto-switches to "Back" tab |
| 3.4 | Compact mode toggle | [E2E] | Toggle compact mode on → verify all fields visible without expanding. Toggle off → verify expandable rows return |
| 3.5 | AI reasoning expandable | [E2E] | Click expand arrow on a field row → verify AI reasoning text appears |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 3.6 | Health warning diff | [E2E] | Health warning with one word different → verify the specific differing word is highlighted red |
| 3.7 | Empty extracted value | [E2E] | Field not found on label → verify "Not Found" badge, no diff (just "—" in extracted column) |
| 3.8 | Bbox outside visible area | [Manual] | Zoomed image where bbox is off-screen → verify scroll/pan brings it into view when clicked |
| 3.9 | Overlapping bboxes | [Manual] | Two fields physically overlapping on the label → verify both are distinguishable (opacity, z-index) |

---

## 4. Keyboard Shortcuts

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 4.1 | Approve via keyboard | [E2E] | On detail page, press `A` → verify confirmation dialog, confirm → verify status = Approved |
| 4.2 | Reject via keyboard | [E2E] | Press `R` → verify status = Rejected |
| 4.3 | Navigate fields with J/K | [E2E] | Press `J` to move to next field, `K` to move to previous, verify visual focus indicator |
| 4.4 | Navigate labels with N/P | [E2E] | Press `N` to go to next label in queue, `P` to go to previous |
| 4.5 | Show shortcut overlay | [E2E] | Press `?` → verify overlay appears with all shortcuts listed |
| 4.6 | Shortcut bar visibility | [E2E] | Verify fixed footer shows context-appropriate shortcuts per page |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 4.7 | Shortcuts disabled in input | [E2E] | Focus on notes textarea, press `A` → verify it types "a" instead of triggering Approve |
| 4.8 | Shortcuts on wrong page | [Unit] | Verify review-specific shortcuts (1/2/3 for override) don't fire on history page |
| 4.9 | Rapid key presses | [E2E] | Press `N` 5 times quickly → verify navigates 5 labels, doesn't double-trigger |

---

## 5. Human Review Queue

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 5.1 | Queue populated | [E2E] | Login, navigate to `/review`, verify all `needs_correction` labels appear |
| 5.2 | Queue badge count | [E2E] | Verify sidebar "Review" link shows badge with correct count of pending items |
| 5.3 | Filter by field type | [E2E] | Filter queue to "Health Warning" → verify only labels with health warning issues shown |
| 5.4 | Override: confirm match | [E2E] | Open review detail, click "Confirm Match" on a flagged field, add notes, verify field status updates |
| 5.5 | Override: mark mismatch | [E2E] | Click "Mark Mismatch" on a field the AI was uncertain about, verify status updates |
| 5.6 | Complete review | [E2E] | Resolve all flagged fields, click "Complete Review", verify label removed from queue, status updated |
| 5.7 | Partial review | [E2E] | Resolve some but not all fields, verify "Complete Review" button stays disabled, label stays in queue |
| 5.8 | Review audit trail | [E2E] | After completing review, navigate to `/history/[id]`, verify "Reviewed by [specialist]" indicator with notes |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 5.9 | Empty queue | [E2E] | When no items need review → verify helpful empty state message |
| 5.10 | Priority sort | [E2E] | Queue has both new labels and resubmissions → verify resubmissions (priority) appear first |
| 5.11 | Deadline sort | [E2E] | Sort by deadline → verify labels closest to expiration appear first |
| 5.12 | Override changes outcome | [Integration] | AI said all mismatch → specialist confirms all match → verify label transitions to `approved` |
| 5.13 | Review by wrong specialist | [Integration] | Specialist A tries to complete review started by Specialist B → verify it's allowed (any specialist can review) |

---

## 6. Correction Deadlines

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 6.1 | 30-day deadline set | [Integration] | Label transitions to `needs_correction` → verify `correction_deadline` = now + 30 days |
| 6.2 | 7-day deadline set | [Integration] | Label transitions to `conditionally_approved` → verify `correction_deadline` = now + 7 days |
| 6.3 | Deadline badge colors | [E2E] | View labels with various remaining times: >7 days (green), 3 days (amber), 12 hours (red) |
| 6.4 | Expiring Soon widget | [E2E] | Dashboard shows labels expiring within 7 days, sorted by urgency |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 6.5 | Auto-expiration | [Integration] | Run `expire-deadlines` action → verify expired `needs_correction` labels transition to `rejected` |
| 6.6 | Deadline after correction | [Integration] | Resubmission received before deadline → verify original label's deadline is cleared/irrelevant |
| 6.7 | Approved label has no deadline | [Integration] | Approved labels → verify `correction_deadline` is null |
| 6.8 | Already expired on page load | [E2E] | Navigate to label with passed deadline → verify red "Expired" badge, status = rejected |

---

## 7. Resubmission Linking

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 7.1 | Create resubmission | [E2E] | On a rejected label, click "Submit Correction", verify form pre-fills from original data |
| 7.2 | Prior label link | [E2E] | On resubmission detail page, verify "Resubmission of [prior label]" header with clickable link |
| 7.3 | Diff between versions | [E2E] | View resubmission detail, verify diff showing which fields changed from original |
| 7.4 | Priority badge | [E2E] | Resubmission appears in review queue with "Priority" badge |
| 7.5 | Priority sorting | [E2E] | Queue with mix of new and resubmissions → verify resubmissions sort above new |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 7.6 | Chain of resubmissions | [Integration] | Original → Rejection → Resubmission 1 → Still needs correction → Resubmission 2 → verify full chain navigable |
| 7.7 | Resubmission of approved label | [Integration] | Verify you cannot create a resubmission from an already-approved label (button not shown) |
| 7.8 | Pre-fill with new image | [E2E] | Create resubmission, upload a new image, verify old application data + new image |
| 7.9 | Applicant detail chain view | [E2E] | On applicant page, verify resubmission chain visible (Original → Corrected → Approved lifecycle) |

---

## 8. Quick Approve & Bulk Approve

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 8.1 | Quick Approve view | [E2E] | Submit a clean label (all match, high confidence), verify condensed Quick Approve card appears |
| 8.2 | One-click approve | [E2E] | Click "Approve" on Quick Approve card, verify status = Approved, auto-navigates to next |
| 8.3 | Expand to full detail | [E2E] | On Quick Approve card, click "View Full Details", verify full comparison layout opens |
| 8.4 | Bulk Approve Clean | [E2E] | On batch detail page with 200 labels (147 clean), click "Bulk Approve Clean", verify confirmation dialog shows count, confirm → 147 labels approved |
| 8.5 | History page indicator | [E2E] | Labels eligible for Quick Approve show subtle indicator in history list |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 8.6 | No clean labels in batch | [E2E] | Batch where all labels have issues → verify "Bulk Approve Clean" button is disabled or shows "0 eligible" |
| 8.7 | Borderline confidence | [Integration] | Label with all fields match but one field at exactly the threshold (80%) → verify it does NOT get Quick Approve (must be above, not equal) |
| 8.8 | Quick Approve + keyboard | [E2E] | On Quick Approve view, press `A` → verify same as clicking Approve button |
| 8.9 | Bulk approve partial batch | [Integration] | Batch still processing (50 of 200 done, 30 clean) → verify Bulk Approve only covers the 30 completed clean ones |

---

## 9. Batch Upload & Processing

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 9.1 | Upload batch of 10 | [E2E] | Drag 10 images into batch upload zone, fill shared application data, click process, verify progress bar, verify all 10 complete |
| 9.2 | Batch progress | [E2E] | During processing, verify counter updates ("Processing 5 of 10"), results table populates as items complete |
| 9.3 | Batch summary stats | [E2E] | After batch completes, verify approved/rejected/needs correction counts |
| 9.4 | Batch with applicant | [E2E] | Select an applicant for the batch, verify all labels in batch linked to that applicant |
| 9.5 | Export results CSV | [E2E] | Click "Export Results" on completed batch, verify CSV downloads with all label data |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 9.6 | Large batch (300 files) | [E2E] [Manual] | Upload 300 files, verify no timeout, all files process, UI remains responsive |
| 9.7 | Mixed valid/invalid files | [Integration] | Batch with 8 images + 2 PDFs → verify PDFs rejected, 8 images process normally |
| 9.8 | Empty batch | [Integration] | Try to create batch with 0 files → verify validation error |
| 9.9 | Batch mid-processing | [E2E] | Navigate away from batch page mid-processing → return → verify processing continued, progress accurate |
| 9.10 | Duplicate filenames in batch | [Integration] | Upload 5 files all named "label.jpg" → verify they're treated as separate labels (renamed or indexed) |
| 9.11 | Batch revalidation | [E2E] | On completed batch, click "Revalidate Rejected", verify only rejected/needs_correction labels re-process |

---

## 10. Applicant Management

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 10.1 | Search existing applicant | [E2E] | Type "Pacific" in applicant autocomplete → verify "Pacific Rim Imports LLC" appears |
| 10.2 | Create new applicant | [E2E] | Type new name, click "Add New Applicant", fill email → verify applicant created |
| 10.3 | Applicant detail page | [E2E] | Navigate to applicant, verify compliance stats (approval rate, total, last submission, most common rejection) |
| 10.4 | Risk badge thresholds | [Integration] | Applicant with 65% approval → red badge. 80% → amber. 95% → green |
| 10.5 | Applicant list sort | [E2E] | Sort by approval rate ascending → verify worst-compliance applicants appear first |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 10.6 | New applicant (0 labels) | [E2E] | View newly created applicant with no labels → verify empty state, no division-by-zero on approval rate |
| 10.7 | Applicant with 1 label | [Integration] | 1 approved label = 100% approval rate. 1 rejected = 0%. Verify calculation |
| 10.8 | Duplicate applicant name | [Integration] | Try to create applicant with same name as existing → verify warning/merge suggestion |

---

## 11. Revalidation

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 11.1 | Revalidate single label | [E2E] | On history detail, click Revalidate → confirm → verify new results appear, old results preserved |
| 11.2 | Revalidate with new image | [E2E] | Click Revalidate, upload replacement image, verify new image used for extraction |
| 11.3 | Audit trail preserved | [Integration] | After revalidation, verify old `validation_results` has `superseded_by` pointing to new result |
| 11.4 | Settings change + revalidate | [Integration] | Change confidence threshold from 80% to 60%, revalidate → verify previously-flagged field now passes |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 11.5 | Multiple revalidations | [Integration] | Revalidate same label 3 times → verify chain: result_1 → result_2 → result_3, only result_3 is `is_current = true` |
| 11.6 | Revalidate during review | [Integration] | Label in review queue gets revalidated → verify review queue reflects new results, old review is invalidated |
| 11.7 | Revalidation improves result | [E2E] | Label that was `needs_correction` → revalidate with better image → verify it can now be `approved` |

---

## 12. Communication Reports

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 12.1 | Approval report | [E2E] | View approved label detail, verify approval notice generated with correct brand name, status |
| 12.2 | Rejection report | [E2E] | View rejected label, verify rejection notice lists each failed field with "Expected vs Found" |
| 12.3 | Conditionally Approved report | [E2E] | View conditionally approved label, verify notice references 7-day accept/decline window |
| 12.4 | Needs Correction report | [E2E] | View needs correction label, verify notice references 30-day correction window and priority processing for resubmissions |
| 12.5 | Copy to clipboard | [E2E] | Click "Copy to Clipboard", verify success feedback, paste into text area → verify content matches |
| 12.6 | Format toggle | [E2E] | Toggle between plain text and formatted → verify both versions are well-formed |
| 12.7 | Annotated image in report | [Manual] | Verify report includes static annotated image with color-coded bboxes baked in |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 12.8 | Report after human review | [Integration] | Specialist overrides AI → verify report includes specialist notes and override reasoning |
| 12.9 | Send Report button disabled | [E2E] | Verify "Send Report" shows BETA badge, clicking shows preview dialog with read-only fields |
| 12.10 | Report with special characters | [Integration] | Brand name "Chateau Lafite-Rothschild" → verify report renders correctly without encoding issues |
| 12.11 | Multi-field rejection | [Integration] | 5 fields failed → verify report lists all 5 with separate "Expected vs Found" for each |

---

## 13. Settings & Configuration

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 13.1 | Adjust confidence threshold | [E2E] | Admin changes threshold from 80% to 70%, verify new validations use 70% |
| 13.2 | Change field strictness | [E2E] | Set brand name to "Strict", verify exact-match required on next validation |
| 13.3 | Add accepted variant | [E2E] | Add "KY Straight Bourbon" as variant of "Kentucky Straight Bourbon Whiskey", verify it matches on next validation |
| 13.4 | Update health warning template | [E2E] | Add a new approved warning text version, verify it's accepted in validation |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 13.5 | Settings persist immediately | [Integration] | Change setting → next validation (no restart) → verify new setting applied |
| 13.6 | Specialist cannot access settings | [E2E] | Login as specialist, verify no "Settings" link, direct URL to `/settings` redirects |
| 13.7 | Invalid threshold value | [Integration] | Try to set threshold to 150% → verify validation rejects it |
| 13.8 | Remove accepted variant | [E2E] | Remove a variant, verify it's no longer treated as equivalent in validation |

---

## 14. Dashboard & Admin

### Common Flows

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 14.1 | Specialist dashboard | [E2E] | Login as specialist, verify personal stats: my validations today, my approval rate, pending reviews |
| 14.2 | Admin dashboard | [E2E] | Login as admin, verify team-wide stats, specialist summary table, flagged applicants |
| 14.3 | Expiring Soon widget | [E2E] | Dashboard shows labels with deadlines in next 7 days |
| 14.4 | Quick Approve Ready count | [E2E] | Dashboard shows number of clean labels awaiting one-click approval |
| 14.5 | Quick action buttons | [E2E] | Verify "Validate New Label", "Upload Batch", "Review Queue" buttons navigate correctly |

### Edge Cases

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 14.6 | Empty dashboard (new specialist) | [E2E] | New specialist with 0 labels → verify "0" stats, no errors, helpful empty state |
| 14.7 | Admin specialist table | [E2E] | Verify all specialists listed with correct metrics, sortable |
| 14.8 | Dashboard data freshness | [E2E] | Approve a label, navigate to dashboard → verify stats updated immediately (no stale cache) |

---

## 15. Cross-Cutting Concerns

### Performance

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 15.1 | Validation under 5s | [Integration] | Mock AI to return in 3s → verify total pipeline < 5s |
| 15.2 | Page load times | [E2E] | History page with 100+ labels → verify renders within 2s |
| 15.3 | Image lazy loading | [Manual] | Scroll through history → verify images load on demand |

### Security

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 15.4 | Zod validation on all actions | [Unit] | Each server action schema: test valid input passes, invalid input rejected with correct error |
| 15.5 | File magic byte check | [Unit] | JPEG magic bytes (FF D8 FF) pass, wrong magic bytes rejected even with .jpg extension |
| 15.6 | Rate limiting | [Integration] | Send 15 validation requests in 10s → verify rate limit kicks in after 10 |
| 15.7 | CSP headers present | [E2E] | Verify response headers include Content-Security-Policy |
| 15.8 | No PII in error messages | [Integration] | Trigger error with user data → verify error message doesn't include email/name |

### Accessibility

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 15.9 | Keyboard navigation | [E2E] | Tab through validation form → verify all fields reachable, focus indicators visible |
| 15.10 | Screen reader labels | [Manual] | Verify all form inputs have labels, images have alt text, status badges have aria-labels |
| 15.11 | Color contrast | [Manual] | Status badges (green/amber/red) meet WCAG AA contrast ratios against their backgrounds |
| 15.12 | Focus management after action | [E2E] | After approving label, verify focus moves to next actionable element (not lost) |

### Error Handling

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 15.13 | Network error during upload | [E2E] | Simulate offline during image upload → verify error toast with retry option |
| 15.14 | Database error | [Integration] | Mock DB insert failure → verify error returned to user, no partial state |
| 15.15 | Blob storage error | [Integration] | Mock Vercel Blob upload failure → verify graceful error, no orphaned DB records |
| 15.16 | Concurrent modifications | [Integration] | Two specialists approve same label simultaneously → verify no duplicate records, last write wins |

---

## 16. Beverage-Type-Specific Validation

### Distilled Spirits

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 16.1 | Bourbon with age statement | [Integration] | Bourbon < 4 years old → verify age statement required |
| 16.2 | Vodka (no age statement) | [Integration] | Vodka label → verify age statement not flagged as missing |
| 16.3 | State of distillation | [Integration] | "Kentucky Straight Bourbon" → verify state of distillation matches |
| 16.4 | Legal spirits sizes | [Unit] | Test all 25 authorized sizes pass, non-standard sizes fail |

### Wine

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 16.5 | Sulfite declaration required | [Integration] | Wine without sulfite declaration → verify flagged |
| 16.6 | Appellation of origin | [Integration] | "Napa Valley" appellation → verify matches Form 5100.31 Item 14 |
| 16.7 | Grape varietal | [Integration] | "Cabernet Sauvignon" varietal → verify matches Item 10 |
| 16.8 | Vintage date | [Integration] | Vintage "2019" → verify matches Item 15 |
| 16.9 | Legal wine sizes | [Unit] | Test all 22 authorized sizes pass |

### Malt Beverages

| # | Workflow | Type | Description |
|---|---------|------|-------------|
| 16.10 | Any size permitted | [Unit] | 355mL, 473mL, 600mL, 1000mL → all pass (no federal standard) |
| 16.11 | ABV conditional requirement | [Integration] | Regular beer → ABV optional. Hard seltzer (alcohol from flavors) → ABV required |
| 16.12 | IPA class/type gotcha | [Integration] | "India Pale Ale" not a TTB-recognized class type → verify uses "Beer" or "Ale" designation |

---

## Test Priority Matrix

For a prototype, prioritize testing in this order:

### P0 — Must Test (blocks demo)
- 2.1-2.3: Core validation happy paths (all 3 beverage types)
- 2.7: Standards of fill (key differentiator)
- 2.6: Health warning validation (most common real rejection)
- 5.6: Complete review flow
- 8.1-8.2: Quick Approve (throughput story)
- 1.1-1.2: Login works
- 15.4-15.5: Security basics (Zod, file validation)

### P1 — Should Test (validates features)
- 2.11-2.13: Normalization/fuzzy matching
- 3.1-3.2: Side-by-side comparison + annotations
- 4.1-4.4: Keyboard shortcuts
- 6.1-6.3: Deadline tracking
- 7.1-7.4: Resubmission linking
- 9.1-9.3: Batch upload
- 12.1-12.5: Communication reports

### P2 — Nice to Test (polish)
- All edge cases marked [Integration]
- 10.x: Applicant management
- 11.x: Revalidation
- 14.x: Dashboard/admin
- 13.x: Settings

### P3 — Manual QA Only
- 3.8-3.9: Bbox visual edge cases
- 12.7: Annotated image quality
- 15.10-15.11: Accessibility manual checks
- 15.3: Lazy loading
