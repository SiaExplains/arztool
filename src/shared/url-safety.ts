import { parse } from 'tldts'

/**
 * Judges a URL decoded from a QR code before anything is opened. Pure and
 * shared: the renderer uses it to build the confirmation card, and main runs
 * it again before opening a viewer — main never trusts the renderer's verdict.
 *
 * Policy: https → ok, http → warn, any other scheme or unparsable → block.
 * Extra warnings for patterns phishing relies on: credentials in the URL,
 * internationalised (punycode) host names, raw IP addresses, hosts without a
 * public registrable domain.
 */
export type SafetyVerdict = 'ok' | 'warn' | 'block'

export type SafetyReason =
  | 'invalid-url'
  | 'blocked-scheme'
  | 'insecure-http'
  | 'credentials'
  | 'idn'
  | 'ip-address'
  | 'no-public-domain'

export interface UrlAssessment {
  verdict: SafetyVerdict
  reasons: SafetyReason[]
  /** Normalised URL (WHATWG `href`); null when the input is not a URL. */
  href: string | null
  /** Lower-case scheme without the colon, e.g. "https". */
  scheme: string | null
  /** ASCII (punycode) host name. */
  hostname: string | null
  /** eTLD+1, e.g. "radiologie-example.de"; falls back to the host name. */
  registrableDomain: string | null
}

const BLOCK_REASONS: ReadonlySet<SafetyReason> = new Set(['invalid-url', 'blocked-scheme'])

/** Private suffixes (github.io, …) count, so tenants on shared hosting are different sites. */
const TLD_OPTIONS = { allowPrivateDomains: true } as const

function registrableDomainOf(hostname: string): {
  domain: string
  isIp: boolean
  isPublic: boolean
} {
  const info = parse(hostname, TLD_OPTIONS)
  if (info.isIp) return { domain: hostname, isIp: true, isPublic: false }
  if (info.domain)
    return {
      domain: info.domain,
      isIp: false,
      isPublic: info.isIcann === true || info.isPrivate === true,
    }
  return { domain: hostname, isIp: false, isPublic: false }
}

export function assessUrl(input: string): UrlAssessment {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return {
      verdict: 'block',
      reasons: ['invalid-url'],
      href: null,
      scheme: null,
      hostname: null,
      registrableDomain: null,
    }
  }

  const scheme = url.protocol.replace(/:$/, '').toLowerCase()
  const base = { href: url.href, scheme }

  if (scheme !== 'https' && scheme !== 'http') {
    return {
      ...base,
      verdict: 'block',
      reasons: ['blocked-scheme'],
      hostname: url.hostname || null,
      registrableDomain: null,
    }
  }
  if (!url.hostname) {
    return {
      ...base,
      verdict: 'block',
      reasons: ['invalid-url'],
      hostname: null,
      registrableDomain: null,
    }
  }

  const reasons: SafetyReason[] = []
  if (scheme === 'http') reasons.push('insecure-http')
  if (url.username || url.password) reasons.push('credentials')
  if (url.hostname.split('.').some((label) => label.startsWith('xn--'))) reasons.push('idn')

  const site = registrableDomainOf(url.hostname)
  if (site.isIp) reasons.push('ip-address')
  else if (!site.isPublic) reasons.push('no-public-domain')

  const verdict: SafetyVerdict = reasons.some((r) => BLOCK_REASONS.has(r))
    ? 'block'
    : reasons.length > 0
      ? 'warn'
      : 'ok'

  return { ...base, verdict, reasons, hostname: url.hostname, registrableDomain: site.domain }
}

/**
 * Only a clean https URL on a domain the user explicitly trusts may skip the
 * confirmation. Any warning (http, IDN, credentials, …) always confirms.
 */
export function isTrusted(assessment: UrlAssessment, trustedDomains: readonly string[]): boolean {
  if (assessment.verdict !== 'ok' || assessment.registrableDomain === null) return false
  const domain = assessment.registrableDomain
  return trustedDomains.some((trusted) => trusted.toLowerCase() === domain)
}

/** URLs a viewer may display or navigate to. */
export function isViewerNavigable(candidate: string): boolean {
  try {
    const { protocol } = new URL(candidate)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * A portal popup is routed into a viewer only when both pages are https and
 * share a registrable domain (portal.de ↔ viewer.portal.de).
 */
export function isSameSitePopup(openerUrl: string, targetUrl: string): boolean {
  const opener = assessUrl(openerUrl)
  const target = assessUrl(targetUrl)
  return (
    opener.scheme === 'https' &&
    target.scheme === 'https' &&
    !target.reasons.includes('credentials') &&
    opener.registrableDomain !== null &&
    opener.registrableDomain === target.registrableDomain
  )
}

/** Split an href so the UI can emphasise the registrable domain. */
export interface HrefParts {
  before: string
  subdomain: string
  domain: string
  after: string
}

export function splitHrefForDisplay(assessment: UrlAssessment): HrefParts | null {
  const { href, hostname, registrableDomain } = assessment
  if (!href || !hostname || !registrableDomain || !hostname.endsWith(registrableDomain)) return null

  let start = href.indexOf('//') + 2
  const at = href.indexOf('@', start)
  const firstSlash = href.indexOf('/', start)
  if (at !== -1 && (firstSlash === -1 || at < firstSlash)) start = at + 1
  if (href.slice(start, start + hostname.length) !== hostname) return null

  const hostEnd = start + hostname.length
  const domainStart = hostEnd - registrableDomain.length
  return {
    before: href.slice(0, start),
    subdomain: href.slice(start, domainStart),
    domain: href.slice(domainStart, hostEnd),
    after: href.slice(hostEnd),
  }
}

/**
 * Turn what a user types into the trusted-domains list ("www.portal.de",
 * "https://portal.de/login", "PORTAL.DE") into its registrable domain.
 * Returns null for anything that cannot be a public site: IPs, bare public
 * suffixes ("co.uk"), single labels and internal names ("pacs.klinikum.local").
 */
export function normalizeTrustedDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase()
  if (trimmed === '' || trimmed.length > 2048) return null
  let hostname: string
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
    const url = new URL(withScheme)
    // "mailto:a@b.de" or "trusted.de@evil.com" parse as credentials — never guess what was meant.
    if (url.username || url.password) return null
    hostname = url.hostname
  } catch {
    return null
  }
  if (hostname === '') return null
  const info = parse(hostname, TLD_OPTIONS)
  if (info.isIp || !info.domain || !(info.isIcann === true || info.isPrivate === true)) return null
  return info.domain
}
