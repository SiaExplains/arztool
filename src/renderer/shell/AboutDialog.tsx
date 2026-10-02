import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppInfo } from '@shared/ipc/channels'

/** Native <dialog>: focus trap, Esc to close and backdrop come from the platform. */
export function AboutDialog({ info, onClose }: { info: AppInfo | null; onClose: () => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      data-testid="about-dialog"
      aria-labelledby="about-title"
      onClose={onClose}
      className="m-auto w-[min(28rem,90vw)] rounded-xl border border-slate-200 bg-white p-8 text-slate-900 shadow-xl backdrop:bg-slate-900/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
    >
      <h2 id="about-title" className="text-xl font-semibold">
        {t('app.name')}
      </h2>
      <p className="text-sm text-slate-500">{t('app.tagline')}</p>
      <p data-testid="about-version" className="mt-4 font-medium">
        {info ? t('about.version', { version: info.version }) : null}
      </p>
      {info ? (
        <p className="text-xs text-slate-500">
          {t('about.components', { electron: info.electronVersion, chrome: info.chromeVersion })}
        </p>
      ) : null}
      <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">{t('about.privacy')}</p>
      <p className="mt-4 text-xs text-slate-500">© 2026 Siavash Ghanbari</p>
      <form method="dialog" className="mt-6 flex justify-end">
        <button
          type="submit"
          autoFocus
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        >
          {t('about.close')}
        </button>
      </form>
    </dialog>
  )
}
