---
name: db-inspect
description: Inspect the Neon Postgres database using psql. Use when you need to check data, verify seed state, debug issues, count rows, inspect schema, or answer questions about what's in the database. All access is READ-ONLY.
---

# Database Inspect

Query the Neon Postgres database using `psql` via the `DATABASE_URL` environment variable. **All access is strictly read-only** — never run INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or any mutating statement.

## Connection

```bash
psql "$DATABASE_URL" -c "<query>"
```

If `DATABASE_URL` is not set, check `.env.local`:
```bash
source .env.local 2>/dev/null && psql "$DATABASE_URL" -c "<query>"
```

## Common Queries

### Schema & Structure

```bash
# List all tables
psql "$DATABASE_URL" -c "\dt"

# Describe a specific table (columns, types, constraints)
psql "$DATABASE_URL" -c "\d labels"
psql "$DATABASE_URL" -c "\d application_data"
psql "$DATABASE_URL" -c "\d validation_items"

# List enums
psql "$DATABASE_URL" -c "SELECT typname, enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid ORDER BY typname, enumsortorder;"
```

### Row Counts

```bash
# Quick counts for all main tables
psql "$DATABASE_URL" -c "
  SELECT 'users' as tbl, count(*) FROM users
  UNION ALL SELECT 'applicants', count(*) FROM applicants
  UNION ALL SELECT 'batches', count(*) FROM batches
  UNION ALL SELECT 'labels', count(*) FROM labels
  UNION ALL SELECT 'label_images', count(*) FROM label_images
  UNION ALL SELECT 'application_data', count(*) FROM application_data
  UNION ALL SELECT 'validation_results', count(*) FROM validation_results
  UNION ALL SELECT 'validation_items', count(*) FROM validation_items
  UNION ALL SELECT 'human_reviews', count(*) FROM human_reviews
  UNION ALL SELECT 'settings', count(*) FROM settings
  UNION ALL SELECT 'accepted_variants', count(*) FROM accepted_variants
  ORDER BY tbl;
"
```

### Labels

```bash
# Labels by status
psql "$DATABASE_URL" -c "SELECT status, count(*) FROM labels GROUP BY status ORDER BY count DESC;"

# Labels by beverage type
psql "$DATABASE_URL" -c "SELECT beverage_type, count(*) FROM labels GROUP BY beverage_type;"

# Recent labels (last 10)
psql "$DATABASE_URL" -c "SELECT id, status, beverage_type, overall_confidence, created_at FROM labels ORDER BY created_at DESC LIMIT 10;"

# Single label full detail
psql "$DATABASE_URL" -c "SELECT l.*, ad.brand_name, ad.fanciful_name, ad.class_type, ad.alcohol_content, ad.net_contents FROM labels l JOIN application_data ad ON ad.label_id = l.id WHERE l.id = '<label-id>';"

# Labels with expiring deadlines
psql "$DATABASE_URL" -c "SELECT id, status, correction_deadline, deadline_expired FROM labels WHERE correction_deadline IS NOT NULL AND deadline_expired = false ORDER BY correction_deadline ASC LIMIT 20;"

# Priority resubmissions
psql "$DATABASE_URL" -c "SELECT id, prior_label_id, status, is_priority FROM labels WHERE prior_label_id IS NOT NULL ORDER BY created_at DESC LIMIT 10;"
```

### Validation Items

```bash
# Validation items for a specific label (current results only)
psql "$DATABASE_URL" -c "
  SELECT vi.field_name, vi.status, vi.confidence, vi.expected_value, vi.extracted_value
  FROM validation_items vi
  JOIN validation_results vr ON vi.validation_result_id = vr.id
  WHERE vr.label_id = '<label-id>' AND vr.is_current = true
  ORDER BY vi.field_name;
"

# Most common failing fields
psql "$DATABASE_URL" -c "SELECT field_name, count(*) FROM validation_items WHERE status = 'mismatch' GROUP BY field_name ORDER BY count DESC;"
```

### Review Queue

```bash
# Pending reviews (review queue depth)
psql "$DATABASE_URL" -c "SELECT count(*) as queue_depth FROM labels WHERE status = 'needs_correction';"

# Human review history
psql "$DATABASE_URL" -c "SELECT hr.id, u.name as specialist, hr.original_status, hr.resolved_status, hr.reviewed_at FROM human_reviews hr JOIN users u ON hr.specialist_id = u.id ORDER BY hr.reviewed_at DESC LIMIT 10;"
```

### Applicants

```bash
# Applicant compliance stats
psql "$DATABASE_URL" -c "
  SELECT a.company_name,
    count(l.id) as total_labels,
    count(CASE WHEN l.status = 'approved' THEN 1 END) as approved,
    round(100.0 * count(CASE WHEN l.status = 'approved' THEN 1 END) / NULLIF(count(l.id), 0), 1) as approval_rate
  FROM applicants a
  LEFT JOIN labels l ON l.applicant_id = a.id
  GROUP BY a.id, a.company_name
  ORDER BY total_labels DESC;
"
```

### Users & Specialists

```bash
# List all users with roles
psql "$DATABASE_URL" -c "SELECT id, name, email, role FROM users ORDER BY role, name;"

# Labels per specialist
psql "$DATABASE_URL" -c "SELECT u.name, count(l.id) as labels_processed FROM users u LEFT JOIN labels l ON l.specialist_id = u.id WHERE u.role = 'specialist' GROUP BY u.id, u.name ORDER BY labels_processed DESC;"
```

### Settings

```bash
# Current validation settings
psql "$DATABASE_URL" -c "SELECT key, value FROM settings ORDER BY key;"

# Accepted variants
psql "$DATABASE_URL" -c "SELECT field_name, canonical_value, variant_value FROM accepted_variants ORDER BY field_name, canonical_value;"
```

### Dashboard Stats

```bash
# Quick dashboard summary
psql "$DATABASE_URL" -c "
  SELECT
    (SELECT count(*) FROM labels) as total_labels,
    (SELECT count(*) FROM labels WHERE status = 'approved') as approved,
    (SELECT count(*) FROM labels WHERE status = 'needs_correction') as needs_correction,
    (SELECT count(*) FROM labels WHERE status = 'rejected') as rejected,
    (SELECT count(*) FROM labels WHERE status = 'conditionally_approved') as conditionally_approved,
    (SELECT count(*) FROM labels WHERE correction_deadline IS NOT NULL AND deadline_expired = false AND correction_deadline < now() + interval '7 days') as expiring_soon,
    (SELECT count(*) FROM human_reviews) as total_reviews,
    (SELECT count(*) FROM batches) as total_batches;
"
```

## Rules

1. **READ-ONLY** — never run INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or any DDL/DML that modifies data
2. Use `LIMIT` on exploratory queries to avoid dumping huge result sets
3. Use `\x` (expanded display) for wide rows: `psql "$DATABASE_URL" -c "\x" -c "SELECT * FROM labels WHERE id = '...'"`
4. If a query returns too many rows, add `LIMIT 20` or filter with WHERE
5. For the schema source of truth, read `src/db/schema.ts` — it defines all tables, columns, enums, and relationships
