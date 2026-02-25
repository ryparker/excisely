# Excisely — Production Readiness Considerations

Things I deliberately deferred for this prototype but would address before a production release. This isn't a wish list — these are the specific gaps I identified during development that would need to be closed before putting this system in front of real TTB specialists processing real COLA applications.

---

## 1. Authentication & Access Control

### Passkey / Biometric Authentication

The prototype uses simple email + password authentication — adequate for demonstrating the workflow, but not what I'd ship.

**What I'd implement:** WebAuthn / passkeys with biometric support (Touch ID, Windows Hello, hardware security keys). This gives specialists a fast, phishing-resistant login on their government workstations — tap a fingerprint reader instead of typing a password. Passkeys are the FIDO2 standard and align with NIST 800-63B guidance for government systems.

**Why it matters for TTB:** Specialists process sensitive alcohol industry data. Phishing-resistant auth is table stakes for a federal agency tool. Biometric convenience also reduces the "I'm locked out" support burden that plagues password-based systems.

### Multi-Factor Authentication (MFA)

**What I'd implement:** Required MFA for all accounts. Options: TOTP authenticator app (Google Authenticator, Authy), email OTP as a fallback, and hardware security keys (YubiKey) for high-privilege roles. MFA should be enforced at the organization level — not opt-in per user.

**Why it's deferred:** Better Auth supports MFA plugins, but configuring TOTP enrollment, backup codes, and recovery flows adds significant UI surface area that doesn't demonstrate the core AI verification capability.

### Account Recovery

**What I'd implement:** Self-service recovery via verified email + MFA reset flow. Manager-initiated account unlock for locked-out specialists. Recovery audit trail (who recovered what, when). Backup codes generated at MFA enrollment.

**Why it matters:** In a government context, account lockout means a specialist can't process labels — a direct SLA impact. Recovery needs to be fast but auditable.

### Manager Role & Administrative Dashboard

The prototype has two roles: specialist and applicant. In production, I'd add a third:

**Manager role capabilities:**

- View specialist workload and throughput metrics (labels processed per day, average review time, approval/rejection rates)
- Reassign labels between specialists for load balancing
- Access the AI pipeline configuration (confidence thresholds, field strictness) — this is currently on the specialist settings page, but in production it should be restricted to managers only. Tuning the AI pipeline affects every label processed; it's a policy decision, not an individual specialist preference
- View and export compliance reports for TTB leadership

**Why the current placement is wrong:** Right now any specialist can adjust the confidence threshold slider and field strictness toggles. In production, a specialist lowering the confidence threshold to auto-approve more labels could undermine the verification process. These controls need to be behind a role gate with proper authorization.

---

## 2. AI Pipeline

### Pipeline Versioning & Audit Trail

This is the biggest gap between prototype and production.

**The problem:** Right now the AI pipeline is a fixed configuration in code — Cloud Vision for OCR, GPT-4.1 for classification, with prompts defined in `src/lib/ai/prompts.ts` and comparison logic in `src/lib/ai/compare-fields.ts`. If I change a prompt, swap a model, or adjust matching thresholds, there's no record of what version of the pipeline produced previous results.

**What I'd implement:**

- **Pipeline version identifier** — a semantic version (e.g., `v1.2.0`) attached to every validation result. The version encodes: OCR provider + model, classification provider + model, prompt template hash, comparison algorithm version, and confidence thresholds
- **Version stored per label** — each `validation_items` row records which pipeline version produced it. When anything changes, the version bumps and new validations use the new version while historical results retain their version tag
- **Changelog** — human-readable description of what changed in each version ("Switched classification from GPT-4.1 to GPT-5.2 for improved multi-line field grouping")
- **A/B comparison** — ability to re-run a sample of historical labels through a new pipeline version and compare accuracy before promoting it to production
- **Rollback** — if a new version degrades accuracy, revert to the previous version without a code deploy

**Why it matters for TTB:** If a label approval is ever challenged, the agency needs to say "this label was processed by pipeline v1.3.0 which used X model with Y prompt and had Z% accuracy on our validation set." That's an audit trail. Without versioning, the answer is "nobody knows what code processed it" — unacceptable for a regulatory agency.

### Model Portability

The current architecture already abstracts the AI SDK provider (swapping `openai('gpt-4.1')` for another model is a one-line change), but production would need:

- Configuration-driven model selection (not hardcoded)
- Cost and latency monitoring per model
- Graceful fallback if a provider has an outage (e.g., fall back from GPT-4.1 to GPT-4.1 Nano)
- Evaluation harness to benchmark new models against the existing validation dataset before deployment

---

## 3. Data & Validation

### Larger Test Dataset

**Current state:** The prototype uses ~1,000 seeded labels with 100-150 unique images. The AI responses in seed data are fabricated — they demonstrate the UI but don't reflect real model behavior on real labels.

**What production needs:** A curated dataset of 2,000-5,000+ real label images spanning:

- All major beverage types (wine, beer, spirits, malt beverages)
- Edge cases: curved labels, metallic/reflective surfaces, multi-panel labels, labels with non-standard layouts
- Low-quality images: poor lighting, slight blur, partial occlusion
- Known-good ground truth: manually verified field values for each image to measure extraction accuracy

**Why this matters:** I can't confidently quote accuracy numbers without testing against a representative sample. The hybrid pipeline may perform well on clean, well-lit label photos but degrade on the messy real-world images that specialists actually encounter. A production release would need measured precision and recall per field type, not just "it works on my test images."

**The challenge:** High-quality label images with ground truth data are hard to source. TTB's existing COLA database has application data but not necessarily the corresponding label images in a machine-readable format. Building this dataset would likely require a dedicated data collection effort with the TTB team.

### Accuracy Benchmarking

Before production, I'd want to measure and publish:

- Per-field extraction accuracy (brand name, alcohol content, health warning, etc.)
- False positive rate (fields marked as "match" that actually differ)
- False negative rate (fields marked as "mismatch" that actually match)
- Confidence calibration (when the model says 90% confident, is it right 90% of the time?)
- Performance by beverage type (spirits labels may be harder than wine labels)

This data would feed into setting appropriate confidence thresholds — right now those thresholds are educated guesses.

---

## 4. Security Hardening

### Rate Limiting

Documented in DECISIONS.md but worth reiterating: the prototype has no rate limiting. Production would use `@upstash/ratelimit` + Upstash Redis with per-user and per-endpoint limits. Critical for preventing AI API cost abuse — an unauthenticated request loop hitting the validation endpoint could burn through the OpenAI/Cloud Vision budget in minutes.

### Input Sanitization & Content Security

The prototype validates file uploads (MIME type, extension, magic bytes, size limit), but production would add:

- Virus/malware scanning on uploaded images before processing
- Stricter Content Security Policy (currently permissive for development)
- Subresource Integrity (SRI) for external scripts
- Regular dependency vulnerability scanning (automated via Dependabot or Snyk)

### Session Management

Better Auth handles session basics, but production would need:

- Concurrent session limits (prevent credential sharing)
- Session invalidation on password change
- Idle timeout appropriate for government use (15-30 minutes per NIST guidelines)
- IP-based anomaly detection (flag logins from unexpected locations)

### Automated Secret Rotation

The prototype uses static secrets — `BETTER_AUTH_SECRET`, `OPENAI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `BLOB_READ_WRITE_TOKEN`, and `DATABASE_URL` — set once in environment variables and never rotated. In production, every secret should rotate automatically on a schedule:

- **Database credentials** — Rotate via AWS Secrets Manager or Vault with RDS integration. The application reads credentials at connection time, so rotation is transparent as long as the secrets manager provides the current value.
- **AI API keys** — OpenAI and Google Cloud support multiple active API keys per project. Rotation creates a new key, updates the secret store, then revokes the old key after a grace period.
- **Auth session secret** — Rotating `BETTER_AUTH_SECRET` invalidates existing sessions. This needs a dual-key strategy: accept tokens signed by both the old and new secret during a transition window, then drop the old key.
- **Blob storage tokens** — Rotate on a 90-day cycle with overlapping validity periods to avoid upload interruptions.
- **Rotation audit log** — Every rotation event (who triggered it, when, which secret, success/failure) logged to a tamper-evident audit trail.

The goal is zero standing secrets — no credential that works forever. If a secret is compromised, the blast radius is limited to the rotation window (ideally 24-72 hours for most credentials, shorter for high-sensitivity keys).

---

## 5. Operational Readiness

### Monitoring & Alerting

The prototype has no monitoring beyond Vercel's built-in dashboards. Production would need:

- AI API latency and error rate monitoring (alert if Cloud Vision or OpenAI degrades)
- Validation throughput metrics (labels processed per hour, queue depth)
- Cost tracking dashboards (AI API spend per day/week/month)
- Error budget tracking (SLO: 99.5% of validations complete within 10 seconds)

### Disaster Recovery

- Database backups (Neon provides point-in-time recovery, but I'd want documented RPO/RTO targets)
- Blob storage redundancy (Vercel Blob is backed by Cloudflare R2 with built-in redundancy, but I'd want explicit backup policies for label images)
- Runbook for AI provider outages (what happens when OpenAI is down? queue labels for later processing vs. manual review fallback)

---

## 6. Infrastructure Review & Government Hosting

### Why This Needs a Dedicated Review

The prototype uses commercial SaaS infrastructure — Vercel for compute, Neon for Postgres, Vercel Blob (Cloudflare R2) for file storage, OpenAI and Google Cloud for AI APIs. This was the right call for a prototype: fast to set up, zero infrastructure management, and lets us focus entirely on the application. But a federal agency deploying a tool that processes alcohol industry regulatory data would almost certainly require a formal infrastructure review before production.

Government systems typically need to meet FedRAMP authorization, operate within approved cloud environments, and satisfy data residency and sovereignty requirements. The current stack would need to be evaluated against those standards.

### What I'd Recommend

**Preferred approach: Vercel (frontend) + AWS GovCloud (data & AI)**

| Layer                   | Prototype                   | Production                                                       | Reasoning                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | --------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Compute / CDN**       | Vercel (commercial)         | Vercel Federal or AWS (see below)                                | Vercel is the best platform for Next.js — zero-config deploys, automatic support for new Next.js features on release day, built-in edge network, and preview deployments for every PR. If Vercel offers a FedRAMP-authorized or government-compliant tier, that's the ideal choice.                                                                                                                                                            |
| **Database**            | Neon Postgres (serverless)  | Amazon RDS for PostgreSQL on GovCloud                            | RDS in AWS GovCloud is FedRAMP High authorized. I'd switch from Neon's serverless driver to standard `pg` (node-postgres) with connection pooling via PgBouncer or RDS Proxy. Drizzle ORM is driver-agnostic — `src/db/index.ts` already auto-detects the driver based on the connection URL, so this is a configuration change, not a code change.                                                                                            |
| **File storage**        | Vercel Blob (Cloudflare R2) | Amazon S3 on GovCloud                                            | S3 in GovCloud is FedRAMP High authorized with server-side encryption (SSE-S3 or SSE-KMS), bucket policies, and access logging. Label images are regulatory evidence — they need encryption at rest, versioning, and retention policies. The upload flow would switch from `@vercel/blob/client` to pre-signed S3 URLs, which is a similar pattern (client-side direct upload with server-issued tokens).                                      |
| **AI — OCR**            | Google Cloud Vision         | Google Cloud Vision (with VPC-SC) or Amazon Textract on GovCloud | Google Cloud has FedRAMP High authorization for some services, but availability depends on the specific agency's ATOs. Amazon Textract on GovCloud is a direct alternative — it provides OCR with word-level bounding boxes similar to Cloud Vision. Would require updating `src/lib/ai/ocr.ts` to use the Textract SDK instead of the Vision SDK, but the output structure (text + bounding polygons) is comparable.                          |
| **AI — Classification** | OpenAI GPT-4.1              | Azure OpenAI on Government or AWS Bedrock                        | OpenAI's commercial API is not FedRAMP authorized. Azure OpenAI Service is available in Azure Government regions with FedRAMP High authorization — same models, government-compliant infrastructure. Alternatively, AWS Bedrock in GovCloud offers Claude and other models. The AI SDK is provider-agnostic, so switching from `@ai-sdk/openai` to `@ai-sdk/azure` or `@ai-sdk/amazon-bedrock` is a provider swap, not an architecture change. |

**Fallback: Full AWS deployment**

If Vercel doesn't have a government-compliant offering, the Next.js app can be deployed on AWS directly:

- **AWS Amplify** — Managed Next.js hosting on AWS, supports SSR and API routes. Less seamless than Vercel for cutting-edge Next.js features (new features may lag behind Vercel support by weeks or months), but runs within AWS GovCloud.
- **Self-hosted on ECS/Fargate** — Docker container running `next start` behind an ALB. Full control, full operational burden. Would need to manage scaling, health checks, deployments, and CDN (CloudFront) ourselves. This is the most flexible option but also the most maintenance-heavy.
- **OpenNext + SST** — Open-source adapter that deploys Next.js to AWS Lambda + CloudFront, approximating Vercel's serverless architecture. Active community but not an official Vercel or AWS product, so support risk exists.

The key point: **the application code is not coupled to Vercel**. Drizzle works with any Postgres driver, the AI SDK works with any supported provider, and file uploads are abstracted behind helper functions. The migration path is infrastructure configuration, not application rewrite.

### What the Review Would Cover

A formal infrastructure review for a government deployment would typically evaluate:

- **Data classification** — What sensitivity level is COLA application data? This determines the required FedRAMP impact level (Low/Moderate/High).
- **Data residency** — Must all data (database, images, AI processing) remain in US-based data centers? GovCloud regions guarantee this; commercial cloud regions may not.
- **Encryption** — At rest (database, blob storage) and in transit (TLS). The prototype uses TLS everywhere but doesn't configure encryption at rest beyond provider defaults.
- **Access controls** — Who can access production infrastructure? VPN requirements, IAM policies, audit logging for infrastructure access (not just application-level auth).
- **AI data handling** — Do OpenAI/Google process label images and text through shared infrastructure, or does the agency need dedicated/isolated endpoints? Government agencies may require that no training data is derived from their inputs.
- **Incident response** — What's the plan if there's a data breach? Notification timelines, containment procedures, forensic capabilities.
- **Vendor assessment** — Each third-party service (Vercel, Neon, OpenAI, Google Cloud) would need a vendor security questionnaire and potentially a SOC 2 Type II or FedRAMP authorization review.

---

## 7. Email & Notifications

### What the Prototype Does

The prototype simulates a realistic email notification system through the **Correspondence Timeline** — a reverse-chronological feed on each label's detail page that shows every communication event: automatic status notifications, specialist override notices, and deadline warnings. Each email event is expandable, showing a full email preview with From/To/Subject headers and a formatted body that includes field discrepancy tables, correction deadlines, and regulatory language. The emails are generated client-side by `build-timeline.ts` and `email-templates.ts` — they look and feel like real correspondence (with realistic TTB sender addresses and applicant recipients), but no email is actually delivered. This is intentional: it demonstrates the full communication UX and audit trail without requiring email infrastructure.

### What Production Needs

**Transactional email service** — A dedicated email provider (Amazon SES, Postmark, or Resend) for sending automated notifications from an official TTB-branded domain (e.g., `noreply@cola.ttb.gov`). Key emails:

- **Approval notice** — Sent to the applicant when a label is approved, including the COLA number and any conditions
- **Correction request** — Sent when a label needs correction, with specific field discrepancies listed, the correction deadline (7 or 30 days depending on status), and instructions for resubmission
- **Rejection notice** — Sent with the reason for rejection and regulatory citations
- **Deadline reminders** — Automated reminders at 7 days, 3 days, and 1 day before a correction deadline expires
- **Status updates** — Notify applicants when their label moves from "Received" to "Processing" and when review is complete

**Why it's more than just "hooking up email":**

- **Deliverability matters** — TTB correspondence is official government communication. Emails can't land in spam. This means proper SPF/DKIM/DMARC records, a warmed-up sending domain, and a reputable provider with high deliverability rates.
- **Templates need legal review** — Approval and rejection language carries regulatory weight. The auto-generated text in the prototype is based on TTB's published communication patterns, but production templates would need sign-off from TTB's legal or compliance team.
- **Audit trail** — Every email sent needs to be logged: recipient, timestamp, content, delivery status. If an applicant claims they never received a correction notice, TTB needs proof of delivery.
- **Preference management** — Applicants should be able to configure notification preferences (email frequency, which updates they want). Some applicants submit hundreds of labels; they don't want 300 individual emails.

**Account recovery and MFA** also depend on email infrastructure (OTP codes, password reset links), so this is a prerequisite for the auth improvements in Section 1.

---

## 8. Compliance & Accessibility

### Automated Accessibility Testing

The prototype targets WCAG 2.1 AA through shadcn/ui's accessible primitives, but I haven't run automated audits. Production would integrate:

- axe-core in CI pipeline (fail builds on accessibility regressions)
- Regular Lighthouse audits with score thresholds
- Screen reader testing with real assistive technology (NVDA, JAWS, VoiceOver)

### Section 508 Compliance

As a federal agency tool, Excisely would need to meet Section 508 requirements. The current UI is built with semantic HTML, keyboard navigation, and ARIA labels, but formal Section 508 testing and documentation would be required before deployment.

---

## 9. User Research & Testing Before GA

This is arguably the most important section in this document.

### The Limitation I'm Working With

The design decisions in this prototype were informed by a limited set of stakeholder interviews — I had access to a few structured conversations with TTB personnel, but not the kind of ongoing, iterative dialogue that produces great software. I couldn't sit with a specialist while they process labels. I couldn't watch an applicant struggle with a form field and ask "what did you expect to happen there?" I couldn't pitch half-formed ideas and let people poke holes in them.

That's a normal constraint for a take-home assignment, but it means many of my UX decisions are educated guesses informed by the interview transcripts, TTB's published documentation, and domain research — not validated by the people who would actually use this tool every day.

### What I'd Do Before General Availability

**Phase 1: Guided Demos & Feedback Sessions**

Before writing another line of code, I'd put the current prototype in front of real users:

- **Specialist walkthroughs** — Sit with 3-5 labeling specialists (including Sarah Chen's team) and watch them use the tool on real label images. Don't guide them. Note where they hesitate, what they skip, what they misunderstand. The annotated image viewer, keyboard shortcuts, and field comparison layout were all designed from interview context — they may not match how specialists actually think about label review.
- **Applicant walkthroughs** — Have 2-3 applicants (distilleries, wineries, breweries of different sizes) submit a label through the system. Do they understand the status terminology? Is the correction workflow intuitive? Does the communication report make sense to someone outside TTB?
- **Manager/supervisor input** — I assumed a manager role is needed but haven't validated what managers actually want to see. Do they care about individual specialist throughput, or aggregate team metrics? Do they want to reassign labels, or do specialists self-organize?

**Phase 2: Assumption Validation**

Several specific assumptions need testing with real users:

| Assumption I Made                                                    | How I'd Validate                                                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Specialists want keyboard shortcuts for queue processing (A/R/C/J/K) | Observe whether specialists discover and use them, or prefer mouse-driven workflow                                                  |
| Side-by-side field comparison is the right layout                    | Some specialists may prefer an overlay approach or a checklist-first view — test alternatives                                       |
| 5-second processing target is the right bar                          | Interview mentioned this, but is it 5 seconds total or 5 seconds for the AI step? Does the upload time count?                       |
| Confidence scores are meaningful to specialists                      | Do they understand what "87% confidence" means? Do they trust it? Or do they ignore scores and just look at the diff?               |
| "Needs Correction" vs "Conditionally Approved" distinction is clear  | TTB uses these terms, but do specialists and applicants interpret the correction windows consistently?                              |
| Desktop-first is correct                                             | "Half our team is over 50" doesn't necessarily mean desktop-only. Some specialists may review on tablets during meetings or at home |
| Auto-generated communication reports save time                       | Or do specialists prefer writing their own rejection/approval language for each case?                                               |

**Phase 3: Iterative Refinement**

Based on feedback, I'd run 2-3 iteration cycles before GA:

1. **Quick wins** — Fix the obvious usability issues that every user trips over. These are usually layout, labeling, and flow problems that are cheap to fix and high-impact.
2. **Workflow adjustments** — Revise the label review flow based on how specialists actually work. The current flow (open label → review fields → approve/reject) may not match reality. Maybe specialists batch-review all "high confidence" labels first, then deep-dive the flagged ones. I don't know yet.
3. **Feature priority recalibration** — Some of the stretch features I deferred (batch upload, resubmission linking, applicant compliance history) may turn out to be critical for daily use. Conversely, features I built (keyboard shortcuts, detailed diff highlighting) may turn out to be unnecessary. User testing tells us where to invest.

### Why This Matters

Government software has a reputation for being built to spec without being built for users. The interviews gave me a strong starting point — I know the domain vocabulary, the regulatory constraints, and the pain points with the pilot vendor's failed system. But knowing the problem space and knowing the right UX solution are different things. The gap gets closed by putting the tool in front of real people, listening more than talking, and iterating before locking in a GA release.
