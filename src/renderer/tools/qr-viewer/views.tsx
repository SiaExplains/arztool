import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ParseKeys } from 'i18next'
import type { DecodeError, FoundCode, SourceInfo } from './decode/pipeline'
import {
  buttonPrimary as primary,
  buttonSecondary as secondary,
  Card,
  ResetButton,
  SourceLine,
} from './ui'

const isMac = /Mac/.test(navigator.userAgent)

export type ClipboardError =
  'clipboard-empty' | 'clipboard-reference-only' | 'clipboard-no-image-file'

const ERROR_KEYS: Record<DecodeError | ClipboardError, ParseKeys> = {
  'too-large': 'tools.qrViewer.errors.tooLarge',
  'read-failed': 'tools.qrViewer.errors.readFailed',
  'heic-unsupported': 'tools.qrViewer.errors.heicUnsupported',
  'heic-failed': 'tools.qrViewer.errors.heicFailed',
  'unsupported-format': 'tools.qrViewer.errors.unsupportedFormat',
  'decode-failed': 'tools.qrViewer.errors.decodeFailed',
  'pdf-failed': 'tools.qrViewer.errors.pdfFailed',
  'clipboard-empty': 'tools.qrViewer.errors.clipboardEmpty',
  'clipboard-reference-only': 'tools.qrViewer.errors.clipboardReferenceOnly',
  'clipboard-no-image-file': 'tools.qrViewer.errors.clipboardNoImageFile',
}

export function IdleView({ onOpen, onPaste }: { onOpen: () => void; onPaste: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      data-testid="qr-idle"
      className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-xl border-2 border-dashed border-slate-300 px-8 py-14 text-center dark:border-slate-700"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-12 w-12 text-teal-700"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
      </svg>
      <h1 className="text-xl font-semibold">{t('tools.qrViewer.input.heading')}</h1>
      <p className="max-w-md text-slate-600 dark:text-slate-400">
        {t('tools.qrViewer.input.hint', {
          shortcut: isMac ? '⌘V' : t('tools.qrViewer.input.shortcutWin'),
        })}
      </p>
      <div className="mt-2 flex gap-3">
        <button type="button" className={primary} onClick={onOpen}>
          {t('tools.qrViewer.input.open')}
        </button>
        <button type="button" className={secondary} onClick={onPaste}>
          {t('tools.qrViewer.input.paste')}
        </button>
      </div>
      <p className="text-xs text-slate-500">{t('tools.qrViewer.input.formats')}</p>
    </div>
  )
}

export function BusyView() {
  const { t } = useTranslation()
  return (
    <div
      data-testid="qr-busy"
      role="status"
      className="flex items-center gap-3 text-slate-600 dark:text-slate-300"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
      {t('tools.qrViewer.busy')}
    </div>
  )
}

export function ErrorView({
  error,
  onReset,
}: {
  error: DecodeError | ClipboardError
  onReset: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card testId="qr-error">
      <h2 className="text-lg font-semibold">{t('tools.qrViewer.errors.title')}</h2>
      <p role="alert" className="mt-2 text-slate-700 dark:text-slate-300">
        {t(ERROR_KEYS[error])}
      </p>
      <div className="mt-6">
        <ResetButton onReset={onReset} />
      </div>
    </Card>
  )
}

export function NoneView({ source, onReset }: { source: SourceInfo; onReset: () => void }) {
  const { t } = useTranslation()
  const tips: ParseKeys[] = [
    'tools.qrViewer.none.tipCrop',
    'tools.qrViewer.none.tipLight',
    'tools.qrViewer.none.tipResolution',
    'tools.qrViewer.none.tipStraight',
  ]
  return (
    <Card testId="qr-none">
      <h2 className="text-lg font-semibold">{t('tools.qrViewer.none.title')}</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{t('tools.qrViewer.none.intro')}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
        {tips.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
      <SourceLine source={source} />
      <div className="mt-6">
        <ResetButton onReset={onReset} />
      </div>
    </Card>
  )
}

export function PickView({
  codes,
  source,
  onPick,
  onReset,
}: {
  codes: FoundCode[]
  source: SourceInfo
  onPick: (code: FoundCode) => void
  onReset: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card testId="qr-multiple">
      <h2 className="text-lg font-semibold">
        {t('tools.qrViewer.multiple.title', { count: codes.length })}
      </h2>
      <p className="mt-1 text-slate-600 dark:text-slate-400">{t('tools.qrViewer.multiple.hint')}</p>
      <ul className="mt-4 space-y-2">
        {codes.map((code) => (
          <li key={code.id}>
            <button
              type="button"
              onClick={() => {
                onPick(code)
              }}
              className="flex w-full items-center gap-4 rounded-lg border border-slate-200 p-3 text-left hover:border-teal-600 hover:bg-teal-50 dark:border-slate-800 dark:hover:bg-teal-950"
            >
              {code.thumbnail ? (
                <img src={code.thumbnail} alt="" className="h-16 w-16 shrink-0 rounded bg-white" />
              ) : null}
              <span className="min-w-0 font-mono text-sm break-all">{code.raw}</span>
            </button>
          </li>
        ))}
      </ul>
      <SourceLine source={source} />
      <div className="mt-6">
        <ResetButton onReset={onReset} />
      </div>
    </Card>
  )
}

export function TextView({
  text,
  source,
  onReset,
}: {
  text: string
  source: SourceInfo
  onReset: () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => {
      setCopied(false)
    }, 2000)
    return () => {
      clearTimeout(timer)
    }
  }, [copied])

  return (
    <Card testId="qr-text">
      <h2 className="text-lg font-semibold">{t('tools.qrViewer.text.title')}</h2>
      <pre
        data-testid="decoded-text"
        className="mt-3 max-h-64 overflow-auto rounded-md bg-slate-100 p-3 font-mono text-sm whitespace-pre-wrap break-all dark:bg-slate-900"
      >
        {text}
      </pre>
      <SourceLine source={source} />
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          className={primary}
          onClick={() => {
            void window.arztool.clipboard.writeText(text).then(() => {
              setCopied(true)
            })
          }}
        >
          {copied ? t('tools.qrViewer.text.copied') : t('tools.qrViewer.text.copy')}
        </button>
        <ResetButton onReset={onReset} />
      </div>
    </Card>
  )
}

export function DropOverlay() {
  const { t } = useTranslation()
  return (
    <div
      data-testid="drop-overlay"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-teal-900/10 backdrop-blur-[1px]"
    >
      <div className="rounded-xl border-2 border-dashed border-teal-700 bg-white px-10 py-8 text-lg font-medium text-teal-800 shadow-lg dark:bg-slate-950 dark:text-teal-200">
        {t('tools.qrViewer.input.dropOverlay')}
      </div>
    </div>
  )
}
