'use client'

import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { AlertTriangle, CheckCircle } from 'lucide-react'

import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Separator } from '@/components/ui/Separator'
import { Textarea } from '@/components/ui/Textarea'
import { BEVERAGE_TYPES, isValidSize } from '@/config/beverage-types'
import { getCodesByBeverageType } from '@/config/class-type-codes'
import { QUALIFYING_PHRASES } from '@/config/qualifying-phrases'
import { FieldLabel } from '@/components/shared/FieldLabel'
import { AiFieldIndicator } from '@/components/validation/AiFieldIndicator'
import { FieldShimmer } from '@/components/validation/ScanAnimation'
import { useExtractionStore } from '@/stores/useExtractionStore'
import { cn } from '@/lib/utils'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LabelFormFieldsProps {
  mode: 'validate' | 'submit'
  showSplitPane: boolean
  onFieldFocus: (snakeCase: string) => void
  onFieldChange: (snakeCase: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabelFormFields({
  mode,
  showSplitPane,
  onFieldFocus,
  onFieldChange,
}: LabelFormFieldsProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ValidateLabelInput>()

  const extraction = useExtractionStore()

  const beverageType = watch('beverageType')
  const containerSizeMl = watch('containerSizeMl')

  const filteredCodes = useMemo(() => {
    if (!beverageType) return []
    return getCodesByBeverageType(beverageType)
  }, [beverageType])

  const standardsOfFillStatus = useMemo(() => {
    if (!beverageType || !containerSizeMl || containerSizeMl <= 0) return null

    if (beverageType === 'malt_beverage') {
      return { valid: true, message: 'Any size permitted' }
    }

    if (isValidSize(beverageType, containerSizeMl)) {
      return { valid: true, message: 'Valid standard of fill' }
    }

    const typeLabel = BEVERAGE_TYPES[beverageType].label
    return {
      valid: false,
      message: `Not a valid standard of fill for ${typeLabel}`,
    }
  }, [beverageType, containerSizeMl])

  // -------------------------------------------------------------------------
  // Extraction skeleton (shown while AI is reading the label)
  // -------------------------------------------------------------------------

  if (extraction.status === 'extracting') {
    return (
      <div className="space-y-6">
        {/* Class/Type Code + Container Size skeleton */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
            <FieldShimmer />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-muted/60" />
            <FieldShimmer />
          </div>
        </div>
        {/* Serial + Brand skeleton */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
            <FieldShimmer />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
            <FieldShimmer />
          </div>
        </div>
        {/* Fanciful + Class/Type skeleton */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
            <FieldShimmer />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-muted/60" />
            <FieldShimmer />
          </div>
        </div>
        {/* Alcohol + Net Contents skeleton */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
            <FieldShimmer />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
            <FieldShimmer />
          </div>
        </div>
        <div className="h-px animate-pulse bg-muted/40" />
        {/* Name/Address + Qualifying Phrase skeleton */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-muted/60" />
            <FieldShimmer className="h-20" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
              <FieldShimmer />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
              <FieldShimmer />
            </div>
          </div>
        </div>
        {/* Beverage-specific section skeleton */}
        {beverageType && (
          <>
            <div className="h-px animate-pulse bg-muted/40" />
            <div className="space-y-4">
              <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
                  <FieldShimmer />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
                  <FieldShimmer />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Actual form fields
  // -------------------------------------------------------------------------

  return (
    <>
      {/* Brand Name + Fanciful Name — primary identifiers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brandName" className="flex items-center gap-1.5">
            <FieldLabel fieldName="brand_name">Brand Name (Item 6)</FieldLabel>{' '}
            <span className="text-destructive">*</span>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="brand_name"
            />
          </Label>
          <Input
            id="brandName"
            placeholder="e.g., Maker's Mark"
            className={cn(
              extraction.aiOriginalValues.has('brand_name') &&
                !extraction.modifiedFields.has('brand_name') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('brandName')}
            onFocus={() => onFieldFocus('brand_name')}
            onChange={(e) => {
              register('brandName').onChange(e)
              onFieldChange('brand_name')
            }}
            aria-invalid={!!errors.brandName}
          />
          {errors.brandName && (
            <p className="text-sm text-destructive">
              {errors.brandName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fancifulName" className="flex items-center gap-1.5">
            <FieldLabel fieldName="fanciful_name">
              Fanciful Name (Item 7)
            </FieldLabel>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="fanciful_name"
            />
          </Label>
          <Input
            id="fancifulName"
            placeholder="Optional"
            className={cn(
              extraction.aiOriginalValues.has('fanciful_name') &&
                !extraction.modifiedFields.has('fanciful_name') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('fancifulName')}
            onFocus={() => onFieldFocus('fanciful_name')}
            onChange={(e) => {
              register('fancifulName').onChange(e)
              onFieldChange('fanciful_name')
            }}
          />
        </div>
      </div>

      {/* Serial Number + Class/Type Designation */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="serialNumber">Serial Number (Item 4)</Label>
          <Input
            id="serialNumber"
            placeholder="e.g., 12345678"
            {...register('serialNumber')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="classType" className="flex items-center gap-1.5">
            <FieldLabel fieldName="class_type">
              Class/Type Designation
            </FieldLabel>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="class_type"
            />
          </Label>
          <Input
            id="classType"
            placeholder="e.g., Kentucky Straight Bourbon Whisky"
            className={cn(
              extraction.aiOriginalValues.has('class_type') &&
                !extraction.modifiedFields.has('class_type') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('classType')}
            onFocus={() => onFieldFocus('class_type')}
            onChange={(e) => {
              register('classType').onChange(e)
              onFieldChange('class_type')
            }}
          />
        </div>
      </div>

      {/* Class/Type Code + Total Bottle Capacity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="classTypeCode">
            <FieldLabel fieldName="class_type">Class/Type Code</FieldLabel>
          </Label>
          <Select
            value={watch('classTypeCode') || ''}
            onValueChange={(value) =>
              setValue('classTypeCode', value, { shouldValidate: true })
            }
            disabled={!beverageType}
          >
            <SelectTrigger id="classTypeCode" className="w-full">
              <SelectValue
                placeholder={
                  beverageType
                    ? 'Select a code'
                    : 'Select a beverage type first'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {filteredCodes.map((code) => (
                <SelectItem key={code.code} value={code.code}>
                  {code.code} — {code.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="containerSizeMl"
            className="flex items-center gap-1.5"
          >
            <FieldLabel fieldName="standards_of_fill">
              Total Bottle Capacity (mL)
            </FieldLabel>
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="containerSizeMl"
            type="number"
            min={1}
            placeholder="e.g., 750"
            {...register('containerSizeMl', { valueAsNumber: true })}
          />
          {errors.containerSizeMl && (
            <p className="text-sm text-destructive">
              {errors.containerSizeMl.message}
            </p>
          )}
          {standardsOfFillStatus && (
            <p
              className={cn(
                'flex items-center gap-1.5 text-sm',
                standardsOfFillStatus.valid
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {standardsOfFillStatus.valid ? (
                <CheckCircle className="size-4" />
              ) : (
                <AlertTriangle className="size-4" />
              )}
              {standardsOfFillStatus.message}
            </p>
          )}
        </div>
      </div>

      {/* Alcohol Content + Net Contents */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="alcoholContent" className="flex items-center gap-1.5">
            <FieldLabel fieldName="alcohol_content">Alcohol Content</FieldLabel>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="alcohol_content"
            />
          </Label>
          <Input
            id="alcoholContent"
            placeholder="e.g., 45% Alc./Vol."
            className={cn(
              extraction.aiOriginalValues.has('alcohol_content') &&
                !extraction.modifiedFields.has('alcohol_content') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('alcoholContent')}
            onFocus={() => onFieldFocus('alcohol_content')}
            onChange={(e) => {
              register('alcoholContent').onChange(e)
              onFieldChange('alcohol_content')
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="netContents" className="flex items-center gap-1.5">
            <FieldLabel fieldName="net_contents">Net Contents</FieldLabel>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="net_contents"
            />
          </Label>
          <Input
            id="netContents"
            placeholder="e.g., 750 mL"
            className={cn(
              extraction.aiOriginalValues.has('net_contents') &&
                !extraction.modifiedFields.has('net_contents') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('netContents')}
            onFocus={() => onFieldFocus('net_contents')}
            onChange={(e) => {
              register('netContents').onChange(e)
              onFieldChange('net_contents')
            }}
          />
        </div>
      </div>

      <Separator />

      {/* Name, Address, and Qualifying Phrase */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nameAndAddress" className="flex items-center gap-1.5">
            <FieldLabel fieldName="name_and_address">
              Name and Address (Item 8)
            </FieldLabel>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="name_and_address"
            />
          </Label>
          <Textarea
            id="nameAndAddress"
            rows={3}
            placeholder="e.g., Beam Suntory, Clermont, KY"
            className={cn(
              extraction.aiOriginalValues.has('name_and_address') &&
                !extraction.modifiedFields.has('name_and_address') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('nameAndAddress')}
            onFocus={() => onFieldFocus('name_and_address')}
            onChange={(e) => {
              register('nameAndAddress').onChange(e)
              onFieldChange('name_and_address')
            }}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="qualifyingPhrase"
              className="flex items-center gap-1.5"
            >
              <FieldLabel fieldName="qualifying_phrase">
                Qualifying Phrase
              </FieldLabel>
              <AiFieldIndicator
                showSplitPane={showSplitPane}
                onFieldFocus={onFieldFocus}
                fieldName="qualifying_phrase"
              />
            </Label>
            <Select
              value={watch('qualifyingPhrase') || ''}
              onValueChange={(value) => {
                setValue('qualifyingPhrase', value, {
                  shouldValidate: true,
                })
                onFieldChange('qualifying_phrase')
              }}
            >
              <SelectTrigger
                id="qualifyingPhrase"
                className="w-full"
                onFocus={() => onFieldFocus('qualifying_phrase')}
              >
                <SelectValue placeholder="Select a phrase" />
              </SelectTrigger>
              <SelectContent>
                {QUALIFYING_PHRASES.map((phrase) => (
                  <SelectItem key={phrase} value={phrase}>
                    {phrase}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="countryOfOrigin"
              className="flex items-center gap-1.5"
            >
              <FieldLabel fieldName="country_of_origin">
                Country of Origin
              </FieldLabel>
              <AiFieldIndicator
                showSplitPane={showSplitPane}
                onFieldFocus={onFieldFocus}
                fieldName="country_of_origin"
              />
            </Label>
            <Input
              id="countryOfOrigin"
              placeholder="e.g., United States"
              className={cn(
                extraction.aiOriginalValues.has('country_of_origin') &&
                  !extraction.modifiedFields.has('country_of_origin') &&
                  'bg-indigo-50/50 dark:bg-indigo-950/20',
              )}
              {...register('countryOfOrigin')}
              onFocus={() => onFieldFocus('country_of_origin')}
              onChange={(e) => {
                register('countryOfOrigin').onChange(e)
                onFieldChange('country_of_origin')
              }}
            />
          </div>
        </div>
      </div>

      {/* Health Warning Statement (validate mode only — submit auto-submits default) */}
      {mode === 'validate' && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="healthWarning">
              <FieldLabel fieldName="health_warning">
                Health Warning Statement
              </FieldLabel>
            </Label>
            <Textarea
              id="healthWarning"
              rows={4}
              className="font-mono text-xs"
              {...register('healthWarning')}
              onFocus={() => onFieldFocus('health_warning')}
            />
            <p className="text-xs text-muted-foreground">
              Pre-filled with the standard GOVERNMENT WARNING per 27 CFR Part
              16.
            </p>
          </div>
        </>
      )}

      {/* Wine-specific fields */}
      {beverageType === 'wine' && (
        <>
          <Separator />
          <div>
            <h3 className="mb-4 font-heading text-sm font-semibold tracking-tight">
              Wine-Specific Fields
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="grapeVarietal"
                  className="flex items-center gap-1.5"
                >
                  <FieldLabel fieldName="grape_varietal">
                    Grape Varietal (Item 10)
                  </FieldLabel>
                  <AiFieldIndicator
                    showSplitPane={showSplitPane}
                    onFieldFocus={onFieldFocus}
                    fieldName="grape_varietal"
                  />
                </Label>
                <Input
                  id="grapeVarietal"
                  placeholder="e.g., Cabernet Sauvignon"
                  className={cn(
                    extraction.aiOriginalValues.has('grape_varietal') &&
                      !extraction.modifiedFields.has('grape_varietal') &&
                      'bg-indigo-50/50 dark:bg-indigo-950/20',
                  )}
                  {...register('grapeVarietal')}
                  onFocus={() => onFieldFocus('grape_varietal')}
                  onChange={(e) => {
                    register('grapeVarietal').onChange(e)
                    onFieldChange('grape_varietal')
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="appellationOfOrigin"
                  className="flex items-center gap-1.5"
                >
                  <FieldLabel fieldName="appellation_of_origin">
                    Appellation of Origin (Item 14)
                  </FieldLabel>
                  <AiFieldIndicator
                    showSplitPane={showSplitPane}
                    onFieldFocus={onFieldFocus}
                    fieldName="appellation_of_origin"
                  />
                </Label>
                <Input
                  id="appellationOfOrigin"
                  placeholder="e.g., Napa Valley"
                  className={cn(
                    extraction.aiOriginalValues.has('appellation_of_origin') &&
                      !extraction.modifiedFields.has('appellation_of_origin') &&
                      'bg-indigo-50/50 dark:bg-indigo-950/20',
                  )}
                  {...register('appellationOfOrigin')}
                  onFocus={() => onFieldFocus('appellation_of_origin')}
                  onChange={(e) => {
                    register('appellationOfOrigin').onChange(e)
                    onFieldChange('appellation_of_origin')
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="vintageYear"
                  className="flex items-center gap-1.5"
                >
                  <FieldLabel fieldName="vintage_year">
                    Vintage Year (Item 15)
                  </FieldLabel>
                  <AiFieldIndicator
                    showSplitPane={showSplitPane}
                    onFieldFocus={onFieldFocus}
                    fieldName="vintage_year"
                  />
                </Label>
                <Input
                  id="vintageYear"
                  placeholder="e.g., 2022"
                  className={cn(
                    extraction.aiOriginalValues.has('vintage_year') &&
                      !extraction.modifiedFields.has('vintage_year') &&
                      'bg-indigo-50/50 dark:bg-indigo-950/20',
                  )}
                  {...register('vintageYear')}
                  onFocus={() => onFieldFocus('vintage_year')}
                  onChange={(e) => {
                    register('vintageYear').onChange(e)
                    onFieldChange('vintage_year')
                  }}
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <Checkbox
                  id="sulfiteDeclaration"
                  checked={watch('sulfiteDeclaration') || false}
                  onCheckedChange={(checked) =>
                    setValue('sulfiteDeclaration', checked === true, {
                      shouldValidate: true,
                    })
                  }
                />
                <Label htmlFor="sulfiteDeclaration" className="cursor-pointer">
                  <FieldLabel fieldName="sulfite_declaration">
                    Contains Sulfites
                  </FieldLabel>
                </Label>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Spirits-specific fields */}
      {beverageType === 'distilled_spirits' && (
        <>
          <Separator />
          <div>
            <h3 className="mb-4 font-heading text-sm font-semibold tracking-tight">
              Spirits-Specific Fields
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="ageStatement"
                  className="flex items-center gap-1.5"
                >
                  <FieldLabel fieldName="age_statement">
                    Age Statement
                  </FieldLabel>
                  <AiFieldIndicator
                    showSplitPane={showSplitPane}
                    onFieldFocus={onFieldFocus}
                    fieldName="age_statement"
                  />
                </Label>
                <Input
                  id="ageStatement"
                  placeholder="e.g., Aged 12 Years"
                  className={cn(
                    extraction.aiOriginalValues.has('age_statement') &&
                      !extraction.modifiedFields.has('age_statement') &&
                      'bg-indigo-50/50 dark:bg-indigo-950/20',
                  )}
                  {...register('ageStatement')}
                  onFocus={() => onFieldFocus('age_statement')}
                  onChange={(e) => {
                    register('ageStatement').onChange(e)
                    onFieldChange('age_statement')
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="stateOfDistillation"
                  className="flex items-center gap-1.5"
                >
                  <FieldLabel fieldName="state_of_distillation">
                    State of Distillation
                  </FieldLabel>
                  <AiFieldIndicator
                    showSplitPane={showSplitPane}
                    onFieldFocus={onFieldFocus}
                    fieldName="state_of_distillation"
                  />
                </Label>
                <Input
                  id="stateOfDistillation"
                  placeholder="e.g., Kentucky"
                  className={cn(
                    extraction.aiOriginalValues.has('state_of_distillation') &&
                      !extraction.modifiedFields.has('state_of_distillation') &&
                      'bg-indigo-50/50 dark:bg-indigo-950/20',
                  )}
                  {...register('stateOfDistillation')}
                  onFocus={() => onFieldFocus('state_of_distillation')}
                  onChange={(e) => {
                    register('stateOfDistillation').onChange(e)
                    onFieldChange('state_of_distillation')
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
