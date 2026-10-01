import { describe, expect, it } from 'vitest'
import {
  assessUrl,
  isSameSitePopup,
  isTrusted,
  isViewerNavigable,
  splitHrefForDisplay,
} from '@shared/url-safety'

describe('assessUrl — scheme policy', () => {
  it('https on a public domain is ok', () => {
    const a = assessUrl('https://befund.radiologie-example.de/r/AbC123?token=x')
    expect(a).toMatchObject({
      verdict: 'ok',
      reasons: [],
      scheme: 'https',
      hostname: 'befund.radiologie-example.de',
      registrableDomain: 'radiologie-example.de',
    })
  })

  it('http is a warning', () => {
    expect(assessUrl('http://befund.radiologie-example.de/')).toMatchObject({
      verdict: 'warn',
      reasons: ['insecure-http'],
    })
  })

  it.each([
    'javascript:alert(document.cookie)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
    'blob:https://x.de/1',
    'about:blank',
    'ftp://files.example.de/scan.zip',
    'myportal://open?id=1',
    'ms-msdt:/id PCWDiagnostic',
    'smb://fileserver/share',
  ])('%s is blocked', (input) => {
    expect(assessUrl(input)).toMatchObject({ verdict: 'block', reasons: ['blocked-scheme'] })
  })

  it.each(['', 'not a url', 'https://'])('%j is blocked as invalid', (input) => {
    expect(assessUrl(input).verdict).toBe('block')
  })

  it('trims whitespace around the payload', () => {
    expect(assessUrl('  https://portal.labor-example.de/x  \n').href).toBe(
      'https://portal.labor-example.de/x',
    )
  })
})

describe('assessUrl — phishing patterns', () => {
  it('credentials in the URL are a warning', () => {
    const a = assessUrl('https://portal.example.de@evil.example.com/login')
    expect(a.verdict).toBe('warn')
    expect(a.reasons).toContain('credentials')
    expect(a.registrableDomain).toBe('example.com') // the real destination, not the decoy
  })

  it('an IDN homograph is a warning and the host is shown as punycode', () => {
    const a = assessUrl('https://bеfund.radiologie-example.de/r/1') // Cyrillic е
    expect(a.verdict).toBe('warn')
    expect(a.reasons).toContain('idn')
    expect(a.hostname).toMatch(/^xn--/)
  })

  it.each(['https://192.168.10.5/pacs', 'https://[2001:db8::1]/'])(
    '%s (raw IP) is a warning',
    (u) => {
      expect(assessUrl(u).reasons).toContain('ip-address')
    },
  )

  it.each(['https://pacs/', 'https://pacs.klinikum.local/'])(
    '%s (no public domain) is a warning',
    (u) => {
      expect(assessUrl(u).reasons).toContain('no-public-domain')
    },
  )

  it('normalises http:///host the way browsers do (host "host", still warned)', () => {
    expect(assessUrl('http:///nohost')).toMatchObject({
      verdict: 'warn',
      hostname: 'nohost',
      reasons: ['insecure-http', 'no-public-domain'],
    })
  })

  it('collects several reasons', () => {
    expect(assessUrl('http://user:pw@xn--bfund-6ve.example.de/').reasons).toEqual([
      'insecure-http',
      'credentials',
      'idn',
    ])
  })
})

describe('isTrusted', () => {
  const trusted = ['radiologie-example.de', 'Labor-Example.DE']

  it('trusts a clean https URL on a listed registrable domain', () => {
    expect(isTrusted(assessUrl('https://befund.radiologie-example.de/x'), trusted)).toBe(true)
    expect(isTrusted(assessUrl('https://portal.labor-example.de/x'), trusted)).toBe(true)
  })

  it.each([
    ['http on a trusted domain', 'http://befund.radiologie-example.de/'],
    ['lookalike suffix', 'https://radiologie-example.de.evil.com/'],
    ['lookalike prefix', 'https://evil-radiologie-example.de/'],
    ['credentials decoy', 'https://radiologie-example.de@evil.com/'],
    ['blocked scheme', 'javascript:alert(1)'],
  ])('never trusts %s', (_label, u) => {
    expect(isTrusted(assessUrl(u), trusted)).toBe(false)
  })
})

describe('isSameSitePopup', () => {
  it.each([
    ['https://portal.radiologie-example.de/a', 'https://viewer.radiologie-example.de/b'],
    ['https://radiologie-example.de/', 'https://www.radiologie-example.de/report.pdf'],
  ])('allows %s → %s', (opener, target) => {
    expect(isSameSitePopup(opener, target)).toBe(true)
  })

  it.each([
    ['other site', 'https://portal.radiologie-example.de/', 'https://evil.com/'],
    [
      'http target',
      'https://portal.radiologie-example.de/',
      'http://viewer.radiologie-example.de/',
    ],
    [
      'http opener',
      'http://portal.radiologie-example.de/',
      'https://viewer.radiologie-example.de/',
    ],
    ['shared hosting tenants', 'https://klinik.github.io/', 'https://attacker.github.io/'],
    ['javascript target', 'https://portal.radiologie-example.de/', 'javascript:alert(1)'],
    [
      'credentials decoy',
      'https://portal.radiologie-example.de/',
      'https://radiologie-example.de@evil.com/',
    ],
  ])('denies %s', (_label, opener, target) => {
    expect(isSameSitePopup(opener, target)).toBe(false)
  })
})

describe('isViewerNavigable', () => {
  it.each(['https://a.de/', 'http://a.de/'])('%s → true', (u) => {
    expect(isViewerNavigable(u)).toBe(true)
  })
  it.each(['javascript:void(0)', 'file:///C:/', 'app://arztool/index.html', 'mailto:a@b.de', 'x'])(
    '%s → false',
    (u) => {
      expect(isViewerNavigable(u)).toBe(false)
    },
  )
})

describe('splitHrefForDisplay', () => {
  it('isolates the registrable domain', () => {
    expect(splitHrefForDisplay(assessUrl('https://befund.radiologie-example.de/r/1?t=2'))).toEqual({
      before: 'https://',
      subdomain: 'befund.',
      domain: 'radiologie-example.de',
      after: '/r/1?t=2',
    })
  })

  it('highlights the real host after a credentials decoy', () => {
    expect(splitHrefForDisplay(assessUrl('https://radiologie-example.de@evil.com/x'))).toEqual({
      before: 'https://radiologie-example.de@',
      subdomain: '',
      domain: 'evil.com',
      after: '/x',
    })
  })

  it('keeps the port with the path', () => {
    expect(splitHrefForDisplay(assessUrl('https://a.example.de:8443/x'))?.after).toBe(':8443/x')
  })

  it('returns null for blocked input', () => {
    expect(splitHrefForDisplay(assessUrl('javascript:alert(1)'))).toBeNull()
  })
})
