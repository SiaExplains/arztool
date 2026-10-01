import { DEFAULT_LANGUAGE, resources, type Language } from '@shared/i18n'

/**
 * Minimal translator for strings owned by main (menus, native dialogs). Shares
 * the renderer's catalogues; the language setting arrives in M4.
 */
let language: Language = DEFAULT_LANGUAGE

export function setMainLanguage(next: Language): void {
  language = next
}

export function t(key: string): string {
  const lookup = (lng: Language): unknown =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          typeof node === 'object' && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        resources[lng].translation,
      )
  const value = lookup(language) ?? lookup(DEFAULT_LANGUAGE)
  return typeof value === 'string' ? value : key
}
