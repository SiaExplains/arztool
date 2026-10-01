import 'i18next'
import type de from '@shared/i18n/de.json'

// German is the source catalogue; keys are type-checked against it.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof de }
  }
}
