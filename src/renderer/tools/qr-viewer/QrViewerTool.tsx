import { useTranslation } from 'react-i18next'

export function QrViewerTool() {
  const { t } = useTranslation()
  return (
    <section className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">{t('tools.qrViewer.title')}</h1>
      <p className="max-w-md text-slate-600 dark:text-slate-400">
        {t('tools.qrViewer.description')}
      </p>
      <p className="text-sm text-slate-500" data-testid="qr-viewer-placeholder">
        {t('tools.qrViewer.comingSoon')}
      </p>
    </section>
  )
}
