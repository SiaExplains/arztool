import de from './de.json'
import en from './en.json'

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'de'

export const resources = {
  de: { translation: de },
  en: { translation: en },
} as const satisfies Record<Language, { translation: unknown }>
