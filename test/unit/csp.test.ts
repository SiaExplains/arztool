import { describe, expect, it } from 'vitest'
import { buildCsp } from '@shared/csp'

describe('buildCsp', () => {
  const prod = buildCsp({ dev: false })

  it('never allows inline or eval script in production', () => {
    expect(prod).not.toContain("'unsafe-inline'")
    expect(prod).not.toContain("'unsafe-eval'")
  })

  it('allows WebAssembly compilation for the QR decoder', () => {
    expect(prod).toMatch(/script-src 'self' 'wasm-unsafe-eval'/)
  })

  it('blocks all network access from the renderer', () => {
    expect(prod).toContain("connect-src 'self'")
    expect(prod).not.toMatch(/https?:/)
  })

  it.each(["object-src 'none'", "base-uri 'none'", "frame-src 'none'", "form-action 'none'"])(
    'contains %s',
    (directive) => {
      expect(prod).toContain(directive)
    },
  )

  it('only loosens for the dev server', () => {
    const dev = buildCsp({ dev: true })
    expect(dev).toContain("'unsafe-inline'")
    expect(dev).toContain('ws://localhost:*')
  })
})
