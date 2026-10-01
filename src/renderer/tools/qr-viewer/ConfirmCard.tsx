import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ParseKeys } from 'i18next'
import { assessUrl, splitHrefForDisplay, type SafetyReason } from '@shared/url-safety'
import type { SourceInfo } from './decode/pipeline'
import { buttonPrimary, buttonSecondary, buttonWarning, Card, SourceLine } from './ui'

const REASON_KEYS: Record<SafetyReason, ParseKeys> = {
  'insecure-http': 'tools.qrViewer.confirm.reasons.insecure-http',
  credentials: 'tools.qrViewer.confirm.reasons.credentials',
  idn: 'tools.qrViewer.confirm.reasons.idn',
  'ip-address': 'tools.qrViewer.confirm.reasons.ip-address',
  'no-public-domain': 'tools.qrViewer.confirm.reasons.no-public-domain',
  'blocked-scheme': 'tools.qrViewer.confirm.reasons.blocked-scheme',
  'invalid-url': 'tools.qrViewer.confirm.reasons.invalid-url',
}

type OpenState = 'idle' | 'opened' | 'blocked'

export function ConfirmCard({
  url,
  source,
  onCancel,
}: {
  url: string
  source: SourceInfo
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const assessment = useMemo(() => assessUrl(url), [url])
  const parts = useMemo(() => splitHrefForDisplay(assessment), [assessment])
  const [openState, setOpenState] = useState<OpenState>('idle')
  const [copied, setCopied] = useState(false)
  const { verdict } = assessment

  const title =
    verdict === 'ok'
      ? t('tools.qrViewer.confirm.titleOk')
      : verdict === 'warn'
        ? t('tools.qrViewer.confirm.titleWarn')
        : t('tools.qrViewer.confirm.titleBlock')

  const badge =
    verdict === 'block'
      ? {
          text: t('tools.qrViewer.confirm.badgeBlocked'),
          tone: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
        }
      : assessment.scheme === 'https'
        ? {
            text: t('tools.qrViewer.confirm.badgeHttps'),
            tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
          }
        : {
            text: t('tools.qrViewer.confirm.badgeHttp'),
            tone: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
          }

  const border =
    verdict === 'ok'
      ? ''
      : verdict === 'warn'
        ? 'border-amber-400 dark:border-amber-700'
        : 'border-red-400 dark:border-red-800'

  const open = () => {
    void window.arztool.viewer.open(url).then((result) => {
      setOpenState(result.status === 'opened' ? 'opened' : 'blocked')
    })
  }

  return (
    <Card testId="qr-confirm" className={border}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span
          data-testid="scheme-badge"
          data-verdict={verdict}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.tone}`}
        >
          {badge.text}
        </span>
      </div>

      {verdict !== 'block' ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t('tools.qrViewer.confirm.intro')}
        </p>
      ) : null}

      {assessment.registrableDomain && verdict !== 'block' ? (
        <div className="mt-5">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {t('tools.qrViewer.confirm.domainLabel')}
          </p>
          <p
            data-testid="registrable-domain"
            className="mt-1 font-mono text-2xl font-semibold break-all"
          >
            {assessment.registrableDomain}
          </p>
        </div>
      ) : null}

      <div className="mt-5">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {t('tools.qrViewer.confirm.urlLabel')}
        </p>
        <p
          data-testid="confirm-url"
          className="mt-1 rounded-md bg-slate-100 p-3 font-mono text-sm break-all text-slate-500 dark:bg-slate-900 dark:text-slate-400"
        >
          {parts ? (
            <>
              {parts.before}
              {parts.subdomain}
              <strong className="font-semibold text-slate-900 dark:text-slate-50">
                {parts.domain}
              </strong>
              {parts.after}
            </>
          ) : (
            <span className="text-slate-900 dark:text-slate-50">{url}</span>
          )}
        </p>
      </div>

      {assessment.reasons.length > 0 ? (
        <ul data-testid="safety-reasons" className="mt-5 space-y-2">
          {assessment.reasons.map((reason) => (
            <li
              key={reason}
              data-reason={reason}
              className={`rounded-md px-3 py-2 text-sm ${verdict === 'block' ? 'bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100' : 'bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100'}`}
            >
              {t(REASON_KEYS[reason], { scheme: assessment.scheme ?? '' })}
            </li>
          ))}
        </ul>
      ) : null}

      {openState === 'opened' ? (
        <p role="status" className="mt-5 text-sm text-emerald-700 dark:text-emerald-300">
          {t('tools.qrViewer.confirm.opened')}
        </p>
      ) : null}
      {openState === 'blocked' ? (
        <p role="alert" className="mt-5 text-sm text-red-700 dark:text-red-300">
          {t('tools.qrViewer.confirm.blockedByMain')}
        </p>
      ) : null}

      <SourceLine source={source} />

      <div className="mt-6 flex flex-wrap gap-3">
        {verdict === 'ok' ? (
          <button type="button" className={buttonPrimary} onClick={open}>
            {t('tools.qrViewer.confirm.open')}
          </button>
        ) : null}
        {verdict === 'warn' ? (
          <button type="button" className={buttonWarning} onClick={open}>
            {t('tools.qrViewer.confirm.openAnyway')}
          </button>
        ) : null}
        <button
          type="button"
          className={buttonSecondary}
          onClick={() => {
            void window.arztool.clipboard.writeText(url).then(() => {
              setCopied(true)
            })
          }}
        >
          {copied ? t('tools.qrViewer.confirm.copied') : t('tools.qrViewer.confirm.copy')}
        </button>
        <button type="button" className={buttonSecondary} onClick={onCancel}>
          {t('tools.qrViewer.confirm.cancel')}
        </button>
      </div>
    </Card>
  )
}
