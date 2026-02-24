/**
 * Shared props passed from the LabelFormFields orchestrator to each field group.
 * Field groups also use `useFormContext()` and `useExtractionStore()` directly.
 */
export interface FieldGroupProps {
  showSplitPane: boolean
  onFieldFocus: (snakeCase: string) => void
  onFieldChange: (snakeCase: string) => void
}
