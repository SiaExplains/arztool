import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppInfo } from '@shared/ipc/channels'
import { tools } from '../tools/registry'

export function App() {
  const { t } = useTranslation()
  const [activeId, setActiveId] = useState(tools[0]?.id)
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.arztool.app.getInfo().then(setInfo, () => {
      setInfo(null)
    })
  }, [])

  const active = tools.find((tool) => tool.id === activeId) ?? tools[0]

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <header className="px-5 pt-6 pb-4">
          <p className="text-lg font-semibold tracking-tight">{t('app.name')}</p>
          <p className="text-xs text-slate-500">{t('app.tagline')}</p>
        </header>
        <nav aria-label={t('nav.tools')} className="flex-1 px-3">
          <ul className="space-y-1">
            {tools.map((tool) => (
              <li key={tool.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(tool.id)
                  }}
                  aria-current={tool.id === active?.id ? 'page' : undefined}
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 aria-[current=page]:bg-teal-50 aria-[current=page]:text-teal-800 dark:hover:bg-slate-800 dark:aria-[current=page]:bg-teal-950 dark:aria-[current=page]:text-teal-200"
                >
                  {t(tool.titleKey)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <footer className="px-5 py-4 text-xs text-slate-400" data-testid="app-version">
          {info ? t('footer.version', { version: info.version }) : null}
        </footer>
      </aside>
      <main className="min-w-0 flex-1">{active ? <active.Component /> : null}</main>
    </div>
  )
}
