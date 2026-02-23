import { z } from 'zod'

export const validateLabelSchema = z.object({
  beverageType: z.enum(['distilled_spirits', 'wine', 'malt_beverage'], {
    required_error: 'Select a beverage type',
    invalid_type_error: 'Select a beverage type',
  }),
  containerSizeMl: z
    .number({
      required_error: 'Enter bottle capacity',
      invalid_type_error: 'Enter a valid number',
    })
    .int('Capacity must be a whole number')
    .positive('Capacity must be greater than 0'),
  classTypeCode: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
  brandName: z.string().trim().min(1, 'Brand Name is required'),
  fancifulName: z.string().trim().optional(),
  classType: z.string().trim().optional(),
  alcoholContent: z.string().trim().optional(),
  netContents: z.string().trim().optional(),
  healthWarning: z.string().trim().optional(),
  nameAndAddress: z.string().trim().optional(),
  qualifyingPhrase: z.string().trim().optional(),
  countryOfOrigin: z.string().trim().optional(),
  grapeVarietal: z.string().trim().optional(),
  appellationOfOrigin: z.string().trim().optional(),
  vintageYear: z.string().trim().optional(),
  sulfiteDeclaration: z.boolean().optional(),
  ageStatement: z.string().trim().optional(),
  stateOfDistillation: z.string().trim().optional(),
  applicantId: z.string().trim().optional(),
  batchId: z.string().trim().optional(),
  priorLabelId: z.string().trim().optional(),
})

export type ValidateLabelInput = z.infer<typeof validateLabelSchema>
