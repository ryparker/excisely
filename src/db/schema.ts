import { relations } from 'drizzle-orm'
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum('user_role', ['admin', 'specialist'])

export const batchStatusEnum = pgEnum('batch_status', [
  'processing',
  'completed',
  'failed',
])

export const beverageTypeEnum = pgEnum('beverage_type', [
  'distilled_spirits',
  'wine',
  'malt_beverage',
])

export const labelStatusEnum = pgEnum('label_status', [
  'pending',
  'processing',
  'approved',
  'conditionally_approved',
  'needs_correction',
  'rejected',
])

export const imageTypeEnum = pgEnum('image_type', [
  'front',
  'back',
  'neck',
  'strip',
  'other',
])

export const fieldNameEnum = pgEnum('field_name', [
  'brand_name',
  'fanciful_name',
  'class_type',
  'alcohol_content',
  'net_contents',
  'health_warning',
  'name_and_address',
  'qualifying_phrase',
  'country_of_origin',
  'grape_varietal',
  'appellation_of_origin',
  'vintage_year',
  'sulfite_declaration',
  'age_statement',
  'state_of_distillation',
  'standards_of_fill',
])

export const validationItemStatusEnum = pgEnum('validation_item_status', [
  'match',
  'mismatch',
  'not_found',
  'needs_correction',
])

/** Subset of validationItemStatusEnum without needs_correction */
export const resolvedStatusEnum = pgEnum('resolved_status', [
  'match',
  'mismatch',
  'not_found',
])

/** Subset of fieldNameEnum without standards_of_fill */
export const acceptedVariantFieldNameEnum = pgEnum(
  'accepted_variant_field_name',
  [
    'brand_name',
    'fanciful_name',
    'class_type',
    'alcohol_content',
    'net_contents',
    'health_warning',
    'name_and_address',
    'qualifying_phrase',
    'country_of_origin',
    'grape_varietal',
    'appellation_of_origin',
    'vintage_year',
    'sulfite_declaration',
    'age_statement',
    'state_of_distillation',
  ],
)

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * Users — managed by Better Auth.
 * PK is Better Auth's own ID format (not nanoid).
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  role: userRoleEnum('role').notNull().default('specialist'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

/**
 * Accounts — managed by Better Auth.
 * Links users to auth providers (email/password stores hashed password here).
 * PK is Better Auth's own ID format (not nanoid).
 */
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
    withTimezone: true,
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

/**
 * Verifications — managed by Better Auth.
 * Stores email verification tokens, password reset tokens, etc.
 * PK is Better Auth's own ID format (not nanoid).
 */
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

/**
 * Sessions — managed by Better Auth.
 * PK is Better Auth's own ID format (not nanoid).
 */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

export const applicants = pgTable('applicants', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  companyName: text('company_name').notNull(),
  contactEmail: text('contact_email'),
  contactName: text('contact_name'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

export const batches = pgTable('batches', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  specialistId: text('specialist_id')
    .notNull()
    .references(() => users.id),
  applicantId: text('applicant_id').references(() => applicants.id),
  name: text('name'),
  status: batchStatusEnum('status').notNull().default('processing'),
  totalLabels: integer('total_labels').notNull().default(0),
  processedCount: integer('processed_count').notNull().default(0),
  approvedCount: integer('approved_count').notNull().default(0),
  conditionallyApprovedCount: integer('conditionally_approved_count')
    .notNull()
    .default(0),
  rejectedCount: integer('rejected_count').notNull().default(0),
  needsCorrectionCount: integer('needs_correction_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

export const labels = pgTable('labels', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  specialistId: text('specialist_id')
    .notNull()
    .references(() => users.id),
  applicantId: text('applicant_id').references(() => applicants.id),
  batchId: text('batch_id').references(() => batches.id),
  priorLabelId: text('prior_label_id'),
  beverageType: beverageTypeEnum('beverage_type').notNull(),
  containerSizeMl: integer('container_size_ml').notNull(),
  status: labelStatusEnum('status').notNull().default('pending'),
  overallConfidence: numeric('overall_confidence'),
  correctionDeadline: timestamp('correction_deadline', {
    withTimezone: true,
  }),
  deadlineExpired: boolean('deadline_expired').notNull().default(false),
  isPriority: boolean('is_priority').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

export const labelImages = pgTable('label_images', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  labelId: text('label_id')
    .notNull()
    .references(() => labels.id),
  imageUrl: text('image_url').notNull(),
  imageFilename: text('image_filename').notNull(),
  imageType: imageTypeEnum('image_type').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

/** Mirrors TTB Form 5100.31 fields — one row per label. */
export const applicationData = pgTable('application_data', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  labelId: text('label_id')
    .notNull()
    .references(() => labels.id)
    .unique(),
  serialNumber: text('serial_number'),
  brandName: text('brand_name'),
  fancifulName: text('fanciful_name'),
  classType: text('class_type'),
  classTypeCode: text('class_type_code'),
  alcoholContent: text('alcohol_content'),
  netContents: text('net_contents'),
  healthWarning: text('health_warning'),
  nameAndAddress: text('name_and_address'),
  qualifyingPhrase: text('qualifying_phrase'),
  countryOfOrigin: text('country_of_origin'),
  grapeVarietal: text('grape_varietal'),
  appellationOfOrigin: text('appellation_of_origin'),
  vintageYear: text('vintage_year'),
  sulfiteDeclaration: boolean('sulfite_declaration'),
  ageStatement: text('age_statement'),
  stateOfDistillation: text('state_of_distillation'),
  fdcYellow5: boolean('fdc_yellow_5'),
  cochinealCarmine: boolean('cochineal_carmine'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

export const validationResults = pgTable('validation_results', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  labelId: text('label_id')
    .notNull()
    .references(() => labels.id),
  supersededBy: text('superseded_by'),
  isCurrent: boolean('is_current').notNull().default(true),
  aiRawResponse: jsonb('ai_raw_response').notNull(),
  processingTimeMs: integer('processing_time_ms').notNull(),
  modelUsed: text('model_used').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

export const validationItems = pgTable('validation_items', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  validationResultId: text('validation_result_id')
    .notNull()
    .references(() => validationResults.id),
  labelImageId: text('label_image_id').references(() => labelImages.id),
  fieldName: fieldNameEnum('field_name').notNull(),
  expectedValue: text('expected_value').notNull(),
  extractedValue: text('extracted_value').notNull(),
  status: validationItemStatusEnum('status').notNull(),
  confidence: numeric('confidence').notNull(),
  matchReasoning: text('match_reasoning'),
  bboxX: numeric('bbox_x'),
  bboxY: numeric('bbox_y'),
  bboxWidth: numeric('bbox_width'),
  bboxHeight: numeric('bbox_height'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

export const settings = pgTable('settings', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

export const acceptedVariants = pgTable('accepted_variants', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  fieldName: acceptedVariantFieldNameEnum('field_name').notNull(),
  canonicalValue: text('canonical_value').notNull(),
  variantValue: text('variant_value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

export const humanReviews = pgTable('human_reviews', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  specialistId: text('specialist_id')
    .notNull()
    .references(() => users.id),
  labelId: text('label_id')
    .notNull()
    .references(() => labels.id),
  validationItemId: text('validation_item_id').references(
    () => validationItems.id,
  ),
  originalStatus: validationItemStatusEnum('original_status').notNull(),
  resolvedStatus: resolvedStatusEnum('resolved_status').notNull(),
  reviewerNotes: text('reviewer_notes'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
})

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  batches: many(batches),
  labels: many(labels),
  humanReviews: many(humanReviews),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))

export const verificationsRelations = relations(verifications, () => ({}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const applicantsRelations = relations(applicants, ({ many }) => ({
  batches: many(batches),
  labels: many(labels),
}))

export const batchesRelations = relations(batches, ({ one, many }) => ({
  specialist: one(users, {
    fields: [batches.specialistId],
    references: [users.id],
  }),
  applicant: one(applicants, {
    fields: [batches.applicantId],
    references: [applicants.id],
  }),
  labels: many(labels),
}))

export const labelsRelations = relations(labels, ({ one, many }) => ({
  specialist: one(users, {
    fields: [labels.specialistId],
    references: [users.id],
  }),
  applicant: one(applicants, {
    fields: [labels.applicantId],
    references: [applicants.id],
  }),
  batch: one(batches, {
    fields: [labels.batchId],
    references: [batches.id],
  }),
  priorLabel: one(labels, {
    fields: [labels.priorLabelId],
    references: [labels.id],
  }),
  images: many(labelImages),
  applicationData: one(applicationData),
  validationResults: many(validationResults),
  humanReviews: many(humanReviews),
}))

export const labelImagesRelations = relations(labelImages, ({ one }) => ({
  label: one(labels, {
    fields: [labelImages.labelId],
    references: [labels.id],
  }),
}))

export const applicationDataRelations = relations(
  applicationData,
  ({ one }) => ({
    label: one(labels, {
      fields: [applicationData.labelId],
      references: [labels.id],
    }),
  }),
)

export const validationResultsRelations = relations(
  validationResults,
  ({ one, many }) => ({
    label: one(labels, {
      fields: [validationResults.labelId],
      references: [labels.id],
    }),
    supersededByResult: one(validationResults, {
      fields: [validationResults.supersededBy],
      references: [validationResults.id],
    }),
    items: many(validationItems),
  }),
)

export const validationItemsRelations = relations(
  validationItems,
  ({ one }) => ({
    validationResult: one(validationResults, {
      fields: [validationItems.validationResultId],
      references: [validationResults.id],
    }),
    labelImage: one(labelImages, {
      fields: [validationItems.labelImageId],
      references: [labelImages.id],
    }),
  }),
)

export const acceptedVariantsRelations = relations(acceptedVariants, () => ({}))

export const humanReviewsRelations = relations(humanReviews, ({ one }) => ({
  specialist: one(users, {
    fields: [humanReviews.specialistId],
    references: [users.id],
  }),
  label: one(labels, {
    fields: [humanReviews.labelId],
    references: [labels.id],
  }),
  validationItem: one(validationItems, {
    fields: [humanReviews.validationItemId],
    references: [validationItems.id],
  }),
}))

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert

export type Verification = typeof verifications.$inferSelect
export type NewVerification = typeof verifications.$inferInsert

export type Applicant = typeof applicants.$inferSelect
export type NewApplicant = typeof applicants.$inferInsert

export type Batch = typeof batches.$inferSelect
export type NewBatch = typeof batches.$inferInsert

export type Label = typeof labels.$inferSelect
export type NewLabel = typeof labels.$inferInsert

export type LabelImage = typeof labelImages.$inferSelect
export type NewLabelImage = typeof labelImages.$inferInsert

export type ApplicationData = typeof applicationData.$inferSelect
export type NewApplicationData = typeof applicationData.$inferInsert

export type ValidationResult = typeof validationResults.$inferSelect
export type NewValidationResult = typeof validationResults.$inferInsert

export type ValidationItem = typeof validationItems.$inferSelect
export type NewValidationItem = typeof validationItems.$inferInsert

export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert

export type AcceptedVariant = typeof acceptedVariants.$inferSelect
export type NewAcceptedVariant = typeof acceptedVariants.$inferInsert

export type HumanReview = typeof humanReviews.$inferSelect
export type NewHumanReview = typeof humanReviews.$inferInsert
