import { describe, expect, it } from 'vitest'
import { resources, SUPPORTED_LANGUAGES } from '@shared/i18n'

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  )
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1] ?? '').sort()
}

function lookup(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], obj)
}

describe('i18n catalogues', () => {
  const reference = flattenKeys(resources.de.translation).sort()

  it.each(SUPPORTED_LANGUAGES)('%s has exactly the same keys as de', (lng) => {
    expect(flattenKeys(resources[lng].translation).sort()).toEqual(reference)
  })

  it.each(SUPPORTED_LANGUAGES)('%s has no empty strings', (lng) => {
    for (const key of reference) {
      expect(lookup(resources[lng].translation, key), key).not.toBe('')
    }
  })

  it.each(SUPPORTED_LANGUAGES)('%s keeps the same interpolation placeholders as de', (lng) => {
    for (const key of reference) {
      const de = lookup(resources.de.translation, key)
      const other = lookup(resources[lng].translation, key)
      if (typeof de === 'string' && typeof other === 'string') {
        expect(placeholders(other), key).toEqual(placeholders(de))
      }
    }
  })
})
