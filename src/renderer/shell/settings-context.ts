import { createContext, useContext } from 'react'
import type { SettingsData, SettingsPatchData, SettingsUpdateResult } from '@shared/ipc/channels'

export interface SettingsContextValue {
  settings: SettingsData
  update: (patch: SettingsPatchData) => Promise<SettingsUpdateResult>
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings outside SettingsProvider')
  return value
}
