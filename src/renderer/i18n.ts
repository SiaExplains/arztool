import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, resources, SUPPORTED_LANGUAGES } from '@shared/i18n'

export function initI18n(): void {
  void i18next.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  })

  i18next.on('languageChanged', (lng) => {
    document.documentElement.lang = lng
  })
}
