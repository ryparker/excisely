'use client'

import { useFormContext } from 'react-hook-form'

import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldLabel } from '@/components/shared/FieldLabel'
import { AiFieldIndicator } from '@/components/validation/AiFieldIndicator'
import { useExtractionStore } from '@/stores/useExtractionStore'
import { cn } from '@/lib/utils'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'
import type { FieldGroupProps } from './FieldGroupTypes'

export function WineSpecificFields({
  showSplitPane,
  onFieldFocus,
  onFieldChange,
}: FieldGroupProps) {
  const { register, watch, setValue } = useFormContext<ValidateLabelInput>()
  const extraction = useExtractionStore()

  return (
    <div>
      <h3 className="mb-4 font-heading text-sm font-semibold tracking-tight">
        Wine-Specific Fields
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="grapeVarietal" className="flex items-center gap-1.5">
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
          <Label htmlFor="vintageYear" className="flex items-center gap-1.5">
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
  )
}
