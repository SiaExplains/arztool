import { z } from 'zod'
import { SUPPORTED_LANGUAGES } from './i18n'
import { normalizeTrustedDomain } from './url-safety'

/**
 * User settings. Pure module: the schema, defaults and update rules live here
 * so they are unit-testable; main only persists the result.
 *
 * Privacy defaults: history off, no confirmation skipping, no trusted domains.
 */
export const MAX_TRUSTED_DOMAINS = 100
export const MAX_HISTORY_ENTRIES = 500

export const SettingsSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  trustedDomains: z.array(z.string().max(253)).max(MAX_TRUSTED_DOMAINS),
  /** Opt-in: clean https links on a trusted domain open without the confirmation card. */
  skipConfirmForTrusted: z.boolean(),
  /** Opt-in: remember which domains were opened (domain + time only, never the URL). */
  historyEnabled: z.boolean(),
  /** Opt-in: ask GitHub Releases for a newer version at start-up. Off until builds are signed. */
  updateCheck: z.boolean(),
})
export type Settings = z.infer<typeof SettingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  language: 'de',
  trustedDomains: [],
  skipConfirmForTrusted: false,
  historyEnabled: false,
  updateCheck: false,
}

export type SettingsPatch = { [K in keyof Settings]?: Settings[K] | undefined }

export const SettingsPatchSchema = z.strictObject({
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
  trustedDomains: z.array(z.string().max(2048)).max(MAX_TRUSTED_DOMAINS).optional(),
  skipConfirmForTrusted: z.boolean().optional(),
  historyEnabled: z.boolean().optional(),
  updateCheck: z.boolean().optional(),
}) satisfies z.ZodType<SettingsPatch>

/** Read whatever is on disk; anything unusable falls back field by field to defaults. */
export function parseStoredSettings(raw: unknown): Settings {
  const object = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const pick = <K extends keyof Settings>(key: K): Settings[K] => {
    const field = SettingsSchema.shape[key].safeParse(object[key])
    return field.success ? (field.data as Settings[K]) : DEFAULT_SETTINGS[key]
  }
  const trustedDomains = pick('trustedDomains')
    .map((d) => normalizeTrustedDomain(d))
    .filter((d): d is string => d !== null)
  return {
    language: pick('language'),
    trustedDomains: [...new Set(trustedDomains)],
    skipConfirmForTrusted: pick('skipConfirmForTrusted'),
    historyEnabled: pick('historyEnabled'),
    updateCheck: pick('updateCheck'),
  }
}

export type ApplyPatchResult =
  { ok: true; settings: Settings } | { ok: false; invalidDomains: string[] }

/** Apply a validated patch. Trusted domains are normalised to registrable domains. */
export function applySettingsPatch(current: Settings, patch: SettingsPatch): ApplyPatchResult {
  let trustedDomains = current.trustedDomains
  if (patch.trustedDomains !== undefined) {
    const normalized = patch.trustedDomains.map((input) => ({
      input,
      domain: normalizeTrustedDomain(input),
    }))
    const invalid = normalized.filter((n) => n.domain === null).map((n) => n.input)
    if (invalid.length > 0) return { ok: false, invalidDomains: invalid }
    trustedDomains = [...new Set(normalized.map((n) => n.domain as string))]
  }
  return {
    ok: true,
    settings: {
      language: patch.language ?? current.language,
      trustedDomains,
      skipConfirmForTrusted: patch.skipConfirmForTrusted ?? current.skipConfirmForTrusted,
      historyEnabled: patch.historyEnabled ?? current.historyEnabled,
      updateCheck: patch.updateCheck ?? current.updateCheck,
    },
  }
}

/** One opened link: the registrable domain and when — never the URL (it may carry access tokens). */
export const HistoryEntrySchema = z.strictObject({
  domain: z.string().min(1).max(253),
  openedAt: z.iso.datetime(),
})
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>

export function parseStoredHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => HistoryEntrySchema.safeParse(entry))
    .filter((r) => r.success)
    .map((r) => r.data)
    .slice(0, MAX_HISTORY_ENTRIES)
}

/** Newest first, capped. */
export function appendHistory(entries: HistoryEntry[], domain: string, now: Date): HistoryEntry[] {
  return [{ domain, openedAt: now.toISOString() }, ...entries].slice(0, MAX_HISTORY_ENTRIES)
}
