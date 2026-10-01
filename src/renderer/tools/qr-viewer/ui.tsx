import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { SourceInfo } from './decode/pipeline'

const button =
  'rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50'
export const buttonPrimary = `${button} bg-teal-700 text-white hover:bg-teal-800`
export const buttonWarning = `${button} bg-amber-600 text-white hover:bg-amber-700`
export const buttonSecondary = `${button} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`

export function Card({
  children,
  testId,
  className = '',
}: {
  children: ReactNode
  testId: string
  className?: string
}) {
  return (
    <div
      data-testid={testId}
      className={`w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950 ${className}`}
    >
      {children}
    </div>
  )
}

export function ResetButton({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation()
  return (
    <button type="button" className={buttonSecondary} onClick={onReset}>
      {t('tools.qrViewer.reset')}
    </button>
  )
}

export function SourceLine({ source }: { source: SourceInfo }) {
  const { t } = useTranslation()
  return (
    <div className="mt-6 space-y-1 text-xs text-slate-500">
      <p>{t('tools.qrViewer.source', { name: source.name })}</p>
      {source.pageCount !== undefined && source.pageCount > 1 ? (
        <p data-testid="pdf-page-note">
          {t('tools.qrViewer.pdfPageNote', { count: source.pageCount })}
        </p>
      ) : null}
    </div>
  )
}
