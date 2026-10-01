import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, resources, SUPPORTED_LANGUAGES, type Language } from '@shared/i18n'

export function initI18n(language: Language = DEFAULT_LANGUAGE): void {
  i18next.on('languageChanged', (lng) => {
    document.documentElement.lang = lng
  })
  void i18next.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
    initAsync: false, // resources are bundled; render in the right language from the first frame
  })
}

export function setLanguage(language: Language): void {
  if (i18next.language !== language) void i18next.changeLanguage(language)
}
