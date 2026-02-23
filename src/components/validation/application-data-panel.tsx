import { FIELD_DISPLAY_NAMES } from '@/config/field-display-names'
import { BEVERAGE_LABEL_FULL } from '@/config/beverage-display'

const APP_DATA_FIELDS = [
  'brandName',
  'fancifulName',
  'classType',
  'classTypeCode',
  'alcoholContent',
  'netContents',
  'nameAndAddress',
  'qualifyingPhrase',
  'countryOfOrigin',
  'grapeVarietal',
  'appellationOfOrigin',
  'vintageYear',
  'ageStatement',
  'stateOfDistillation',
] as const

const CAMEL_TO_SNAKE: Record<string, string> = {
  brandName: 'brand_name',
  fancifulName: 'fanciful_name',
  classType: 'class_type',
  classTypeCode: 'class_type_code',
  alcoholContent: 'alcohol_content',
  netContents: 'net_contents',
  nameAndAddress: 'name_and_address',
  qualifyingPhrase: 'qualifying_phrase',
  countryOfOrigin: 'country_of_origin',
  grapeVarietal: 'grape_varietal',
  appellationOfOrigin: 'appellation_of_origin',
  vintageYear: 'vintage_year',
  ageStatement: 'age_statement',
  stateOfDistillation: 'state_of_distillation',
}

interface ApplicationDataPanelProps {
  appData: Record<string, unknown>
  beverageType: string
  containerSizeMl?: number | null
}

export function ApplicationDataPanel({
  appData,
  beverageType,
  containerSizeMl,
}: ApplicationDataPanelProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Application Data
      </h3>
      <div className="rounded-lg border">
        {/* Beverage type + container size header */}
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
          <span className="text-sm font-medium">
            {BEVERAGE_LABEL_FULL[beverageType] ?? beverageType}
          </span>
          {containerSizeMl && (
            <span className="text-xs text-muted-foreground">
              {containerSizeMl} mL
            </span>
          )}
        </div>

        {/* Field list */}
        <div className="divide-y">
          {APP_DATA_FIELDS.map((key) => {
            const value = appData[key]
            if (!value) return null
            const snakeKey = CAMEL_TO_SNAKE[key] ?? key
            const displayName =
              FIELD_DISPLAY_NAMES[snakeKey] ?? snakeKey.replace(/_/g, ' ')
            return (
              <div key={key} className="flex items-start gap-4 px-4 py-2.5">
                <span className="w-36 shrink-0 text-xs font-medium text-muted-foreground">
                  {displayName}
                </span>
                <span className="text-sm">{String(value)}</span>
              </div>
            )
          })}
          {Boolean(appData.sulfiteDeclaration) && (
            <div className="flex items-start gap-4 px-4 py-2.5">
              <span className="w-36 shrink-0 text-xs font-medium text-muted-foreground">
                Sulfite Declaration
              </span>
              <span className="text-sm">Contains Sulfites</span>
            </div>
          )}
          {Boolean(appData.healthWarning) && (
            <div className="flex items-start gap-4 px-4 py-2.5">
              <span className="w-36 shrink-0 text-xs font-medium text-muted-foreground">
                Health Warning
              </span>
              <span className="text-sm leading-relaxed">
                {String(appData.healthWarning)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
