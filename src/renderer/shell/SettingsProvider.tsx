import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SettingsData, SettingsPatchData } from '@shared/ipc/channels'
import { setLanguage } from '../i18n'
import { SettingsContext } from './settings-context'

export function SettingsProvider({
  initial,
  children,
}: {
  initial: SettingsData
  children: ReactNode
}) {
  const [settings, setSettings] = useState(initial)
  const confirmed = useRef(initial)

  const update = useCallback(async (patch: SettingsPatchData) => {
    // Toggles and language react instantly; trusted domains wait for main,
    // which normalises them. A failed save rolls back to the last saved state.
    // Generic on purpose: a hand-written field list silently missed `updateCheck`.
    if (patch.trustedDomains === undefined) {
      const defined = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      ) as Partial<SettingsData>
      const optimistic: SettingsData = { ...confirmed.current, ...defined }
      setSettings(optimistic)
      setLanguage(optimistic.language)
    }
    try {
      const result = await window.arztool.settings.update(patch)
      if (result.status === 'ok') confirmed.current = result.settings
      return result
    } finally {
      setSettings(confirmed.current)
      setLanguage(confirmed.current.language)
    }
  }, [])

  const value = useMemo(() => ({ settings, update }), [settings, update])
  return <SettingsContext value={value}>{children}</SettingsContext>
}
