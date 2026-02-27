'use server'

import { guardApplicant } from '@/lib/auth/action-guards'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'
import {
  submitApplicationCore,
  type SubmitApplicationResult,
} from './submit-application'

export async function batchSubmitRow(input: {
  data: ValidateLabelInput
  imageUrls: string[]
}): Promise<SubmitApplicationResult> {
  const guard = await guardApplicant()
  if (!guard.success) return guard

  return submitApplicationCore({
    applicantEmail: guard.session.user.email,
    data: input.data,
    imageUrls: input.imageUrls,
  })
}
