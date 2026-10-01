import { describe, expect, it } from 'vitest'
import { isAppUrl, resolveAppAssetPath } from '../../src/main/app-protocol'

describe('resolveAppAssetPath', () => {
  it.each([
    ['app://arztool/', 'index.html'],
    ['app://arztool/index.html', 'index.html'],
    ['app://arztool/assets/index-abc.js', 'assets/index-abc.js'],
    ['app://arztool/assets/a%20b.css', 'assets/a b.css'],
    // Literal dot-segments are resolved by the URL parser itself and cannot climb above the root.
    ['app://arztool/../main/index.js', 'main/index.js'],
    ['app://arztool/assets/%2e%2e/%2e%2e/main/index.js', 'main/index.js'],
  ])('maps %s → %s', (url, expected) => {
    expect(resolveAppAssetPath(url)).toBe(expected)
  })

  it.each([
    'app://arztool/%2e%2e%2fpackage.json',
    'app://arztool/assets/..%5c..%5cpackage.json',
    'app://arztool/a%00.js',
    'app://arztool/%E0%A4%A',
    'app://evil/index.html',
    'file:///etc/passwd',
    'https://arztool/index.html',
    'not a url',
  ])('rejects %s', (url) => {
    expect(resolveAppAssetPath(url)).toBeNull()
  })
})

describe('isAppUrl', () => {
  it('accepts the app origin', () => {
    expect(isAppUrl('app://arztool/index.html')).toBe(true)
  })

  it('accepts the dev server origin only when given', () => {
    expect(isAppUrl('http://localhost:5173/', 'http://localhost:5173')).toBe(true)
    expect(isAppUrl('http://localhost:5173/')).toBe(false)
    expect(isAppUrl('http://localhost:5174/', 'http://localhost:5173')).toBe(false)
  })

  it.each(['app://other/', 'https://arztool/', 'file:///index.html', 'garbage'])(
    'rejects %s',
    (url) => {
      expect(isAppUrl(url)).toBe(false)
    },
  )
})
