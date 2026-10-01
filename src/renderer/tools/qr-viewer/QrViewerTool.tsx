import { useCallback, useRef, useState } from 'react'
import type { InputFile } from '@shared/ipc/channels'
import {
  decodeInput,
  type DecodeError,
  type DecodeOutcome,
  type FoundCode,
} from './decode/pipeline'
import { useInputSources } from './useInputSources'
import { BusyView, DropOverlay, ErrorView, IdleView, NoneView, PickView, TextView } from './views'
import { ConfirmCard } from './ConfirmCard'

type State =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'error'; error: DecodeError | 'clipboard-empty' }
  | { status: 'done'; outcome: Exclude<DecodeOutcome, { kind: 'error' }>; picked: FoundCode | null }

export function QrViewerTool() {
  const [state, setState] = useState<State>({ status: 'idle' })
  // Inputs can arrive faster than decoding finishes; only the newest may win.
  const requestId = useRef(0)

  const decode = useCallback((file: InputFile) => {
    const id = ++requestId.current
    setState({ status: 'busy' })
    void decodeInput(file).then((outcome) => {
      if (id !== requestId.current) return
      if (outcome.kind === 'error') {
        setState({ status: 'error', error: outcome.error })
      } else {
        const only =
          outcome.kind === 'found' && outcome.codes.length === 1 ? outcome.codes[0] : null
        setState({ status: 'done', outcome, picked: only ?? null })
      }
    })
  }, [])

  const openPicker = useCallback(() => {
    void window.arztool.files.openImage().then((result) => {
      if (result.status === 'ok') decode(result.file)
      else if (result.status === 'error') setState({ status: 'error', error: result.error })
    })
  }, [decode])

  const pasteFromSystem = useCallback(() => {
    void window.arztool.clipboard.readImage().then((result) => {
      if (result.status === 'ok') decode(result.file)
      else setState({ status: 'error', error: 'clipboard-empty' })
    })
  }, [decode])

  const reset = useCallback(() => {
    requestId.current++
    setState({ status: 'idle' })
  }, [])

  const { dragging } = useInputSources({
    onFile: decode,
    onPasteWithoutImage: pasteFromSystem,
    onMenuOpen: openPicker,
  })

  return (
    <section className="flex h-full flex-col items-center justify-center overflow-y-auto p-8">
      {state.status === 'idle' ? <IdleView onOpen={openPicker} onPaste={pasteFromSystem} /> : null}
      {state.status === 'busy' ? <BusyView /> : null}
      {state.status === 'error' ? <ErrorView error={state.error} onReset={reset} /> : null}
      {state.status === 'done' ? (
        <Result
          state={state}
          onReset={reset}
          onPick={(code) => {
            setState({ ...state, picked: code })
          }}
        />
      ) : null}
      {dragging ? <DropOverlay /> : null}
    </section>
  )
}

function Result({
  state,
  onReset,
  onPick,
}: {
  state: Extract<State, { status: 'done' }>
  onReset: () => void
  onPick: (code: FoundCode) => void
}) {
  const { outcome, picked } = state
  if (outcome.kind === 'none') return <NoneView source={outcome.source} onReset={onReset} />
  if (!picked) {
    return (
      <PickView codes={outcome.codes} source={outcome.source} onPick={onPick} onReset={onReset} />
    )
  }
  return picked.payload.kind === 'url' ? (
    <ConfirmCard
      key={picked.payload.url}
      url={picked.payload.url}
      source={outcome.source}
      onCancel={onReset}
    />
  ) : (
    <TextView text={picked.payload.text} source={outcome.source} onReset={onReset} />
  )
}
