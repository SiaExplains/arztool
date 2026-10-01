import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ViewerCommand, ViewerNotice, ViewerState } from '@shared/ipc/channels'

const api = window.arztoolViewer

function send(command: ViewerCommand): void {
  void api.command(command)
}

function IconButton({
  label,
  command,
  disabled = false,
  children,
}: {
  label: string
  command: ViewerCommand
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        send(command)
      }}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  )
}

function useNoticeText(notice: ViewerNotice | null): string | null {
  const { t } = useTranslation()
  if (!notice) return null
  switch (notice.kind) {
    case 'popup-blocked':
      return t('viewerToolbar.notice.popupBlocked', { host: notice.host })
    case 'navigation-blocked':
      return t('viewerToolbar.notice.navigationBlocked', { scheme: notice.scheme })
    case 'load-failed':
      return t('viewerToolbar.notice.loadFailed', { description: notice.description })
    case 'download-done':
      return t('viewerToolbar.notice.downloadDone', { filename: notice.filename })
    case 'download-failed':
      return t('viewerToolbar.notice.downloadFailed', { filename: notice.filename })
    case 'crashed':
      return t('viewerToolbar.notice.crashed')
  }
}

/** The URL with its registrable domain emphasised, like the confirmation card. */
function Address({ url, domain }: { url: string; domain: string | null }) {
  if (!domain) return <span className="text-slate-900 dark:text-slate-50">{url}</span>
  let hostStart = url.indexOf('//') + 2
  const at = url.indexOf('@', hostStart)
  const slash = url.indexOf('/', hostStart)
  if (at !== -1 && (slash === -1 || at < slash)) hostStart = at + 1
  const domainAt = url.indexOf(domain, hostStart)
  if (domainAt === -1) return <span>{url}</span>
  return (
    <>
      {url.slice(0, domainAt)}
      <strong className="font-semibold text-slate-900 dark:text-slate-50">{domain}</strong>
      {url.slice(domainAt + domain.length)}
    </>
  )
}

export function ViewerToolbar() {
  const { t } = useTranslation()
  const [state, setState] = useState<ViewerState | null>(null)
  const noticeText = useNoticeText(state?.notice ?? null)

  useEffect(() => {
    const unsubscribe = api.onState(setState)
    void api.getState().then(setState)
    return unsubscribe
  }, [])

  if (!state)
    return (
      <div className="h-[52px] border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
    )

  const secure = state.scheme === 'https'

  return (
    <div
      data-testid="viewer-toolbar"
      className="flex h-[52px] items-center gap-1 border-b border-slate-200 bg-slate-100 px-2 select-none dark:border-slate-700 dark:bg-slate-800"
    >
      <IconButton label={t('viewerToolbar.back')} command="back" disabled={!state.canGoBack}>
        <path d="M15 18l-6-6 6-6" />
      </IconButton>
      <IconButton
        label={t('viewerToolbar.forward')}
        command="forward"
        disabled={!state.canGoForward}
      >
        <path d="M9 18l6-6-6-6" />
      </IconButton>
      {state.loading ? (
        <IconButton label={t('viewerToolbar.stop')} command="stop">
          <path d="M6 6l12 12M18 6L6 18" />
        </IconButton>
      ) : (
        <IconButton label={t('viewerToolbar.reload')} command="reload">
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
        </IconButton>
      )}

      <div
        role="textbox"
        aria-readonly="true"
        aria-label={t('viewerToolbar.address')}
        data-testid="viewer-address"
        data-scheme={state.scheme}
        className="mx-2 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
      >
        <span
          title={secure ? t('viewerToolbar.secure') : t('viewerToolbar.insecure')}
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${secure ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}
        >
          {secure ? 'HTTPS' : 'HTTP'}
        </span>
        <span className="min-w-0 truncate font-mono text-[13px] text-slate-500 select-text dark:text-slate-400">
          <Address url={state.url} domain={state.registrableDomain} />
        </span>
      </div>

      {noticeText ? (
        <div
          data-testid="viewer-notice"
          role="status"
          className="flex max-w-[40%] shrink items-center gap-1 rounded-md bg-amber-100 py-1 pr-1 pl-3 text-xs text-amber-950 dark:bg-amber-900 dark:text-amber-50"
        >
          <span className="truncate">{noticeText}</span>
          <IconButton label={t('viewerToolbar.dismiss')} command="dismiss-notice">
            <path d="M6 6l12 12M18 6L6 18" />
          </IconButton>
        </div>
      ) : null}

      <IconButton label={t('viewerToolbar.zoomOut')} command="zoom-out">
        <path d="M5 12h14" />
      </IconButton>
      <button
        type="button"
        title={t('viewerToolbar.zoomReset')}
        data-testid="viewer-zoom"
        onClick={() => {
          send('zoom-reset')
        }}
        className="h-8 w-12 shrink-0 rounded-md text-xs text-slate-700 tabular-nums hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        {state.zoomPercent} %
      </button>
      <IconButton label={t('viewerToolbar.zoomIn')} command="zoom-in">
        <path d="M12 5v14M5 12h14" />
      </IconButton>
      <IconButton
        label={state.fullscreen ? t('viewerToolbar.exitFullscreen') : t('viewerToolbar.fullscreen')}
        command="toggle-fullscreen"
      >
        {state.fullscreen ? (
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        )}
      </IconButton>
      <IconButton label={t('viewerToolbar.openExternal')} command="open-external">
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </IconButton>
    </div>
  )
}
