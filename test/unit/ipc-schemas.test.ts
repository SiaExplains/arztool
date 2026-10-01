import { describe, expect, it } from 'vitest'
import { IpcChannel } from '@shared/ipc/channels'
import { IpcRequestSchemas, MAX_CLIPBOARD_TEXT } from '@shared/ipc/schemas'
import { MAX_INPUT_BYTES } from '@shared/qr/input-format'

const ok = (channel: keyof typeof IpcRequestSchemas, value: unknown) =>
  IpcRequestSchemas[channel].safeParse(value).success

describe('IPC request schemas', () => {
  it('has a schema for every channel', () => {
    expect(Object.keys(IpcRequestSchemas).sort()).toEqual(Object.values(IpcChannel).sort())
  })

  it.each([IpcChannel.AppGetInfo, IpcChannel.FileOpenImage, IpcChannel.ClipboardReadImage])(
    '%s accepts no payload and rejects anything else',
    (channel) => {
      expect(ok(channel, undefined)).toBe(true)
      expect(ok(channel, {})).toBe(false)
      expect(ok(channel, 'x')).toBe(false)
    },
  )

  describe(IpcChannel.ImageConvertHeic, () => {
    const channel = IpcChannel.ImageConvertHeic
    it('accepts a non-empty Uint8Array', () => {
      expect(ok(channel, { bytes: new Uint8Array([1, 2, 3]) })).toBe(true)
    })
    it.each([
      ['empty bytes', { bytes: new Uint8Array() }],
      ['oversized bytes', { bytes: new Uint8Array(MAX_INPUT_BYTES + 1) }],
      ['plain array', { bytes: [1, 2, 3] }],
      ['string', { bytes: 'AAAA' }],
      ['extra keys', { bytes: new Uint8Array([1]), path: '/etc/passwd' }],
      ['missing bytes', {}],
    ])('rejects %s', (_label, payload) => {
      expect(ok(channel, payload)).toBe(false)
    })
  })

  describe(IpcChannel.ClipboardWriteText, () => {
    const channel = IpcChannel.ClipboardWriteText
    it('accepts text up to the limit', () => {
      expect(ok(channel, { text: 'x'.repeat(MAX_CLIPBOARD_TEXT) })).toBe(true)
    })
    it.each([
      ['too long', { text: 'x'.repeat(MAX_CLIPBOARD_TEXT + 1) }],
      ['not a string', { text: 42 }],
      ['extra keys', { text: 'a', html: '<b>' }],
    ])('rejects %s', (_label, payload) => {
      expect(ok(channel, payload)).toBe(false)
    })
  })
})
