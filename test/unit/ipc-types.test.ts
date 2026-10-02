import { describe, expectTypeOf, it } from 'vitest'
import type { HistoryEntryData, SettingsData } from '@shared/ipc/channels'
import type { HistoryEntry, Settings } from '@shared/settings'

// The preload must stay dependency-free, so channels.ts mirrors the zod-derived
// settings types by hand. tsc fails this file if the two ever drift apart.
describe('IPC mirror types', () => {
  it('SettingsData matches the settings schema', () => {
    expectTypeOf<SettingsData>().toEqualTypeOf<Settings>()
  })
  it('HistoryEntryData matches the history schema', () => {
    expectTypeOf<HistoryEntryData>().toEqualTypeOf<HistoryEntry>()
  })
})
