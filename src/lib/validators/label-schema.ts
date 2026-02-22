import { z } from 'zod'

export const validateLabelSchema = z.object({
  beverageType: z.enum(['distilled_spirits', 'wine', 'malt_beverage']),
  containerSizeMl: z.number().int().positive(),
  classTypeCode: z.string().optional(),
  serialNumber: z.string().optional(),
  brandName: z.string().min(1, 'Brand Name is required'),
  fancifulName: z.string().optional(),
  classType: z.string().optional(),
  alcoholContent: z.string().optional(),
  netContents: z.string().optional(),
  healthWarning: z.string().optional(),
  nameAndAddress: z.string().optional(),
  qualifyingPhrase: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  grapeVarietal: z.string().optional(),
  appellationOfOrigin: z.string().optional(),
  vintageYear: z.string().optional(),
  sulfiteDeclaration: z.boolean().optional(),
  ageStatement: z.string().optional(),
  stateOfDistillation: z.string().optional(),
  applicantId: z.string().optional(),
  batchId: z.string().optional(),
  priorLabelId: z.string().optional(),
})

export type ValidateLabelInput = z.infer<typeof validateLabelSchema>
