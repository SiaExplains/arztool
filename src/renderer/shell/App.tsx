import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppInfo } from '@shared/ipc/channels'
import { tools } from '../tools/registry'
import { AboutDialog } from './AboutDialog'
import { SettingsPage } from './SettingsPage'

type Page = 'tool' | 'settings'

const navButton =
  'w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 aria-[current=page]:bg-teal-50 aria-[current=page]:text-teal-800 dark:hover:bg-slate-800 dark:aria-[current=page]:bg-teal-950 dark:aria-[current=page]:text-teal-200'

function NavButton({
  current,
  onClick,
  children,
}: {
  current: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? 'page' : undefined}
      className={navButton}
    >
      {children}
    </button>
  )
}

export function App() {
  const { t } = useTranslation()
  // The selected tool and the visible page are separate: tools stay mounted while
  // Settings is shown, so a decoded result survives a quick visit.
  const [toolId, setToolId] = useState(tools[0]?.id ?? '')
  const [page, setPage] = useState<Page>('tool')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.arztool.app.getInfo().then(setInfo, () => {
      setInfo(null)
    })
    const offSettings = window.arztool.menu.onOpenSettings(() => {
      setPage('settings')
    })
    const offAbout = window.arztool.menu.onOpenAbout(() => {
      setAboutOpen(true)
    })

    // The QR tool listens window-wide even while Settings is shown; bring it into view
    // whenever an image arrives so nothing is decoded out of sight.
    const showQrTool = () => {
      setToolId('qr-viewer')
      setPage('tool')
    }
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target
      const editable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement)
      if (!editable) showQrTool()
    }
    const offOpenImage = window.arztool.menu.onOpenImage(showQrTool)
    window.addEventListener('drop', showQrTool)
    document.addEventListener('paste', onPaste)

    return () => {
      offSettings()
      offAbout()
      offOpenImage()
      window.removeEventListener('drop', showQrTool)
      document.removeEventListener('paste', onPaste)
    }
  }, [])

  const activeTool = tools.find((tool) => tool.id === toolId) ?? tools[0]

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
                <NavButton
                  current={page === 'tool' && activeTool?.id === tool.id}
                  onClick={() => {
                    setToolId(tool.id)
                    setPage('tool')
                  }}
                >
                  {t(tool.titleKey)}
                </NavButton>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-1 px-3 pb-2">
          <NavButton
            current={page === 'settings'}
            onClick={() => {
              setPage('settings')
            }}
          >
            {t('nav.settings')}
          </NavButton>
          <NavButton
            current={false}
            onClick={() => {
              setAboutOpen(true)
            }}
          >
            {t('nav.about')}
          </NavButton>
        </div>
        <footer className="px-5 py-4 text-xs text-slate-400" data-testid="app-version">
          {info ? t('footer.version', { version: info.version }) : null}
        </footer>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div hidden={page !== 'tool'} className="h-full">
          {activeTool ? <activeTool.Component /> : null}
        </div>
        {page === 'settings' ? <SettingsPage /> : null}
      </main>
      {aboutOpen ? (
        <AboutDialog
          info={info}
          onClose={() => {
            setAboutOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
