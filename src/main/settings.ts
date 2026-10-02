import {
  appendHistory,
  applySettingsPatch,
  parseStoredHistory,
  parseStoredSettings,
  type ApplyPatchResult,
  type HistoryEntry,
  type Settings,
  type SettingsPatch,
} from '@shared/settings'
import { deleteJson, readJson, writeJson } from './json-store'

let current: Settings | null = null
const listeners = new Set<(settings: Settings) => void>()

export function getSettings(): Settings {
  current ??= parseStoredSettings(readJson('settings'))
  return current
}

export function onSettingsChanged(listener: (settings: Settings) => void): void {
  listeners.add(listener)
}

export async function updateSettings(patch: SettingsPatch): Promise<ApplyPatchResult> {
  const before = getSettings()
  const result = applySettingsPatch(before, patch)
  if (!result.ok) return result

  current = result.settings
  await writeJson('settings', current)
  // Turning history off also forgets what was recorded — off means off.
  if (before.historyEnabled && !current.historyEnabled) await clearHistory()
  for (const listener of listeners) listener(current)
  return result
}

export function listHistory(): HistoryEntry[] {
  return getSettings().historyEnabled ? parseStoredHistory(readJson('history')) : []
}

/** Records the registrable domain only, and only when the user enabled history. */
export async function recordHistory(domain: string): Promise<void> {
  if (!getSettings().historyEnabled) return
  await writeJson('history', appendHistory(listHistory(), domain, new Date()))
}

export function clearHistory(): Promise<void> {
  return deleteJson('history')
}
