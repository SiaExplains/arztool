/**
 * Decides whether a decoded QR payload should be treated as a link (and go
 * through URL safety, M3) or shown as plain text.
 *
 * Deliberately conservative: only `scheme://…` and the script-capable schemes
 * count as links. Structured payloads like `WIFI:S:…` or `BEGIN:VCARD` are
 * technically scheme-like but are shown as text. Dangerous schemes are kept as
 * links on purpose, so the safety check can block them visibly instead of the
 * app quietly displaying `javascript:` as harmless text.
 */
export type ClassifiedPayload = { kind: 'url'; url: string } | { kind: 'text'; text: string }

const SCRIPT_CAPABLE_SCHEMES = new Set(['javascript', 'vbscript', 'data', 'blob', 'file', 'about'])

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i

export function classifyPayload(raw: string): ClassifiedPayload {
  const trimmed = raw.trim()
  const scheme = SCHEME_RE.exec(trimmed)?.[1]?.toLowerCase()

  if (scheme && (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || SCRIPT_CAPABLE_SCHEMES.has(scheme))) {
    return { kind: 'url', url: trimmed }
  }
  return { kind: 'text', text: raw }
}
