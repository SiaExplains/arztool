import { posix } from 'node:path'

/**
 * Arztool's own UI is served from `app://arztool/…` instead of file:// (Electron
 * security checklist #18). These helpers are pure so they can be unit-tested.
 */
export const APP_SCHEME = 'app'
export const APP_HOST = 'arztool'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

/**
 * Map an app:// request URL to a path relative to the renderer output dir.
 * Returns null for anything that is not ours or tries to escape the root.
 */
export function resolveAppAssetPath(requestUrl: string): string | null {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) return null

  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return null
  }
  if (pathname.includes('\0') || pathname.includes('\\')) return null
  // Encoded dot-segments (%2e%2e) survive URL parsing; refuse them rather than
  // relying on normalize() clamping at the root.
  if (pathname.split('/').includes('..')) return null

  const relative = posix.normalize(pathname).replace(/^\/+/, '')
  return relative === '' ? 'index.html' : relative
}

/** True when a URL belongs to Arztool's own renderer (prod scheme or the dev server). */
export function isAppUrl(candidate: string, devServerUrl?: string): boolean {
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return false
  }
  // URL.origin is "null" for non-special schemes, so compare scheme + host directly.
  if (url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST) return true
  if (devServerUrl) {
    try {
      return url.origin === new URL(devServerUrl).origin
    } catch {
      return false
    }
  }
  return false
}
