import { describe, expect, it } from 'vitest'
import {
  appendHistory,
  applySettingsPatch,
  DEFAULT_SETTINGS,
  MAX_HISTORY_ENTRIES,
  parseStoredHistory,
  parseStoredSettings,
  SettingsPatchSchema,
} from '@shared/settings'
import { normalizeTrustedDomain } from '@shared/url-safety'

describe('normalizeTrustedDomain', () => {
  it.each([
    ['patient-cloud.de', 'patient-cloud.de'],
    ['  PATIENT-CLOUD.DE ', 'patient-cloud.de'],
    ['www.patient-cloud.de', 'patient-cloud.de'],
    ['https://patient-cloud.de/medizinakte/login', 'patient-cloud.de'],
    ['befund.radiologie-example.de', 'radiologie-example.de'],
    ['portal.nhs.uk', 'portal.nhs.uk'],
    ['patient-cloud.de:443', 'patient-cloud.de'],
    ['klinik.github.io', 'klinik.github.io'],
    ['bеfund.example.de', 'example.de'],
  ])('%j → %s', (input, expected) => {
    expect(normalizeTrustedDomain(input)).toBe(expected)
  })

  it.each([
    '',
    '   ',
    'de',
    'co.uk',
    'github.io',
    '192.168.1.10',
    '[::1]',
    'pacs',
    'pacs.klinikum.local',
    'mailto:a@b.de',
    'patient-cloud.de@evil.com',
    'https://user:pw@patient-cloud.de',
    'not a domain!',
    'x'.repeat(3000),
  ])('rejects %j', (input) => {
    expect(normalizeTrustedDomain(input)).toBeNull()
  })
})

describe('parseStoredSettings', () => {
  it('returns privacy-first defaults for missing or garbage input', () => {
    for (const raw of [undefined, null, 'x', 42, [], {}]) {
      expect(parseStoredSettings(raw)).toEqual(DEFAULT_SETTINGS)
    }
    expect(DEFAULT_SETTINGS).toMatchObject({
      historyEnabled: false,
      skipConfirmForTrusted: false,
      language: 'de',
    })
  })

  it('keeps valid fields and replaces invalid ones individually', () => {
    expect(
      parseStoredSettings({
        language: 'fr',
        historyEnabled: true,
        trustedDomains: 'nope',
        skipConfirmForTrusted: 1,
      }),
    ).toEqual({ ...DEFAULT_SETTINGS, historyEnabled: true })
  })

  it('re-normalises and de-duplicates stored domains, dropping bad ones', () => {
    expect(
      parseStoredSettings({
        trustedDomains: [
          'WWW.Patient-Cloud.de',
          'patient-cloud.de',
          '10.0.0.1',
          'labor.example.de',
        ],
      }).trustedDomains,
    ).toEqual(['patient-cloud.de', 'example.de'])
  })
})

describe('applySettingsPatch', () => {
  it('changes only the fields in the patch', () => {
    const result = applySettingsPatch(DEFAULT_SETTINGS, { language: 'en' })
    expect(result).toEqual({ ok: true, settings: { ...DEFAULT_SETTINGS, language: 'en' } })
  })

  it('normalises trusted domains', () => {
    const result = applySettingsPatch(DEFAULT_SETTINGS, {
      trustedDomains: [
        'https://www.patient-cloud.de/x',
        'PATIENT-CLOUD.DE',
        'befund.radiologie-example.de',
      ],
    })
    expect(result.ok && result.settings.trustedDomains).toEqual([
      'patient-cloud.de',
      'radiologie-example.de',
    ])
  })

  it('rejects the whole patch and names invalid domains', () => {
    const current = { ...DEFAULT_SETTINGS, trustedDomains: ['patient-cloud.de'] }
    expect(
      applySettingsPatch(current, { trustedDomains: ['patient-cloud.de', '127.0.0.1', 'co.uk'] }),
    ).toEqual({
      ok: false,
      invalidDomains: ['127.0.0.1', 'co.uk'],
    })
  })
})

describe('SettingsPatchSchema', () => {
  it.each([
    [{ language: 'de' }, true],
    [{ historyEnabled: true, skipConfirmForTrusted: false }, true],
    [{ trustedDomains: ['a.de'] }, true],
    [{ language: 'fr' }, false],
    [{ historyEnabled: 'yes' }, false],
    [{ unknown: true }, false],
    [{ trustedDomains: Array.from({ length: 101 }, (_, i) => `d${String(i)}.de`) }, false],
  ])('%j → %s', (patch, valid) => {
    expect(SettingsPatchSchema.safeParse(patch).success).toBe(valid)
  })
})

describe('history', () => {
  const now = new Date('2026-10-01T12:00:00.000Z')

  it('stores domain and time only, newest first', () => {
    const once = appendHistory([], 'patient-cloud.de', now)
    const twice = appendHistory(once, 'radiologie-example.de', new Date('2026-10-01T13:00:00.000Z'))
    expect(twice).toEqual([
      { domain: 'radiologie-example.de', openedAt: '2026-10-01T13:00:00.000Z' },
      { domain: 'patient-cloud.de', openedAt: '2026-10-01T12:00:00.000Z' },
    ])
  })

  it('is capped', () => {
    let entries = parseStoredHistory([])
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 20; i++) entries = appendHistory(entries, 'a.de', now)
    expect(entries).toHaveLength(MAX_HISTORY_ENTRIES)
  })

  it('drops malformed or URL-carrying entries when reading', () => {
    expect(
      parseStoredHistory([
        { domain: 'a.de', openedAt: '2026-10-01T12:00:00.000Z' },
        { domain: 'b.de', openedAt: 'yesterday' },
        { domain: 'c.de', openedAt: '2026-10-01T12:00:00.000Z', url: 'https://c.de/?token=x' },
        'garbage',
      ]),
    ).toEqual([{ domain: 'a.de', openedAt: '2026-10-01T12:00:00.000Z' }])
    expect(parseStoredHistory({ not: 'an array' })).toEqual([])
  })
})
