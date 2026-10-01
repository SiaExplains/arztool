import { describe, expect, it } from 'vitest'
import { classifyPayload } from '@shared/qr/payload'

describe('classifyPayload', () => {
  it.each([
    'https://befund.example.de/r/1',
    'http://befund.example.de/r/1',
    'HTTPS://BEFUND.EXAMPLE.DE/',
    '  https://padded.example.de/  ',
    'ftp://files.example.de/scan.zip',
    'myportal://open?id=1',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'blob:https://x/1',
    'about:blank',
  ])('%s is a link (so URL safety can judge it)', (raw) => {
    expect(classifyPayload(raw)).toEqual({ kind: 'url', url: raw.trim() })
  })

  it.each([
    'Befund-ID 4711 · Zugangs-PIN 0815',
    'WIFI:S:Klinik;T:WPA;P:secret;;',
    'BEGIN:VCARD\nVERSION:3.0\nEND:VCARD',
    'mailto:arzt@example.de',
    'tel:+49301234567',
    'www.example.de',
    'example.de/befund',
    '',
  ])('%j is text', (raw) => {
    expect(classifyPayload(raw)).toEqual({ kind: 'text', text: raw })
  })
})
