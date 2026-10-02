import { useEffect, useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { HistoryEntryData, Language, UpdateState } from '@shared/ipc/channels'
import { SUPPORTED_LANGUAGES } from '@shared/i18n'
import { useSettings } from './settings-context'

const input =
  'h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-900'
const smallButton =
  'h-9 rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50'

function Section({
  title,
  children,
  testId,
}: {
  title: string
  children: ReactNode
  testId: string
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked)
        }}
        className="mt-1 h-4 w-4 shrink-0 accent-teal-700"
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </div>
    </div>
  )
}

function LanguageSection() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  return (
    <Section title={t('settings.language.heading')} testId="settings-language">
      <div role="radiogroup" aria-label={t('settings.language.heading')} className="flex gap-2">
        {SUPPORTED_LANGUAGES.map((lng: Language) => (
          <button
            key={lng}
            type="button"
            role="radio"
            aria-checked={settings.language === lng}
            onClick={() => {
              void update({ language: lng })
            }}
            className={`${smallButton} border border-slate-300 aria-checked:border-teal-700 aria-checked:bg-teal-700 aria-checked:text-white dark:border-slate-700`}
          >
            {t(`settings.language.${lng}`)}
          </button>
        ))}
      </div>
    </Section>
  )
}

function TrustedDomainsSection() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const value = draft.trim()
    if (value === '') return
    const before = settings.trustedDomains.length
    void update({ trustedDomains: [...settings.trustedDomains, value] }).then((result) => {
      if (result.status === 'invalid-domains') {
        setError(t('settings.trusted.invalid', { input: value }))
      } else if (result.settings.trustedDomains.length === before) {
        setError(t('settings.trusted.duplicate', { domain: value.toLowerCase() }))
      } else {
        setError(null)
        setDraft('')
      }
    })
  }

  return (
    <Section title={t('settings.trusted.heading')} testId="settings-trusted">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('settings.trusted.intro')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          placeholder={t('settings.trusted.placeholder')}
          aria-label={t('settings.trusted.heading')}
          aria-invalid={error !== null}
          spellCheck={false}
          className={input}
        />
        <button type="submit" className={`${smallButton} bg-teal-700 text-white hover:bg-teal-800`}>
          {t('settings.trusted.add')}
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {settings.trustedDomains.length === 0 ? (
        <p className="text-sm text-slate-500">{t('settings.trusted.empty')}</p>
      ) : (
        <ul
          data-testid="trusted-list"
          className="divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800"
        >
          {settings.trustedDomains.map((domain) => (
            <li key={domain} className="flex items-center justify-between px-3 py-2">
              <span className="font-mono text-sm">{domain}</span>
              <button
                type="button"
                aria-label={t('settings.trusted.remove', { domain })}
                onClick={() => {
                  void update({
                    trustedDomains: settings.trustedDomains.filter((d) => d !== domain),
                  })
                }}
                className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-red-700 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <Toggle
        label={t('settings.trusted.skip')}
        hint={t('settings.trusted.skipHint')}
        checked={settings.skipConfirmForTrusted}
        onChange={(next) => {
          void update({ skipConfirmForTrusted: next })
        }}
      />
    </Section>
  )
}

function HistorySection() {
  const { t, i18n } = useTranslation()
  const { settings, update } = useSettings()
  const [entries, setEntries] = useState<HistoryEntryData[]>([])

  useEffect(() => {
    void window.arztool.history.list().then(setEntries)
  }, [settings.historyEnabled])

  const format = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <Section title={t('settings.history.heading')} testId="settings-history">
      <Toggle
        label={t('settings.history.toggle')}
        hint={t('settings.history.hint')}
        checked={settings.historyEnabled}
        onChange={(next) => {
          void update({ historyEnabled: next })
        }}
      />
      {!settings.historyEnabled ? (
        <p className="text-sm text-slate-500">{t('settings.history.off')}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">{t('settings.history.empty')}</p>
      ) : (
        <>
          <table data-testid="history-table" className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="pb-2 font-medium">{t('settings.history.domain')}</th>
                <th className="pb-2 font-medium">{t('settings.history.openedAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {entries.map((entry) => (
                <tr key={`${entry.openedAt}-${entry.domain}`}>
                  <td className="py-1.5 font-mono">{entry.domain}</td>
                  <td className="py-1.5 text-slate-600 dark:text-slate-400">
                    {format.format(new Date(entry.openedAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => {
              void window.arztool.history.clear().then(() => {
                setEntries([])
              })
            }}
            className={`${smallButton} border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800`}
          >
            {t('settings.history.clear')}
          </button>
        </>
      )}
    </Section>
  )
}

function UpdatesSection() {
  const { t, i18n } = useTranslation()
  const { settings, update } = useSettings()
  const [state, setState] = useState<UpdateState | null>(null)

  useEffect(() => {
    const unsubscribe = window.arztool.updates.onState(setState)
    void window.arztool.updates.getState().then(setState)
    return unsubscribe
  }, [])

  const time = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(new Date(iso))

  const statusText = (s: UpdateState): string => {
    switch (s.status) {
      case 'unsupported':
        return t('settings.updates.status.unsupported')
      case 'idle':
        return t('settings.updates.status.idle')
      case 'checking':
        return t('settings.updates.status.checking')
      case 'up-to-date':
        return t('settings.updates.status.upToDate', { time: time(s.checkedAt) })
      case 'available':
        return t('settings.updates.status.available', { version: s.version })
      case 'downloading':
        return t('settings.updates.status.downloading', { percent: s.percent })
      case 'downloaded':
        return t('settings.updates.status.downloaded', { version: s.version })
      case 'error':
        return s.kind === 'network'
          ? t('settings.updates.status.errorNetwork')
          : s.kind === 'signature'
            ? t('settings.updates.status.errorSignature')
            : t('settings.updates.status.errorOther')
    }
  }

  const button = `${smallButton} border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800`
  const primary = `${smallButton} bg-teal-700 text-white hover:bg-teal-800`

  return (
    <Section title={t('settings.updates.heading')} testId="settings-updates">
      <Toggle
        label={t('settings.updates.toggle')}
        hint={t('settings.updates.hint')}
        checked={settings.updateCheck}
        onChange={(next) => {
          void update({ updateCheck: next })
        }}
      />
      {state ? (
        <p
          data-testid="update-status"
          role="status"
          className="text-sm text-slate-600 dark:text-slate-400"
        >
          {statusText(state)}
        </p>
      ) : null}
      {state && state.status !== 'unsupported' ? (
        <div className="flex flex-wrap gap-2">
          {state.status === 'available' ? (
            <button
              type="button"
              className={primary}
              onClick={() => {
                void window.arztool.updates.download()
              }}
            >
              {t('settings.updates.download', { version: state.version })}
            </button>
          ) : state.status === 'downloaded' ? (
            <button
              type="button"
              className={primary}
              onClick={() => {
                void window.arztool.updates.install()
              }}
            >
              {t('settings.updates.install')}
            </button>
          ) : (
            <button
              type="button"
              className={button}
              disabled={state.status === 'checking' || state.status === 'downloading'}
              onClick={() => {
                void window.arztool.updates.check()
              }}
            >
              {t('settings.updates.check')}
            </button>
          )}
        </div>
      ) : null}
    </Section>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
      <LanguageSection />
      <TrustedDomainsSection />
      <HistorySection />
      <UpdatesSection />
    </div>
  )
}
