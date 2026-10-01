import { app, type Session, type WebContents } from 'electron'

/**
 * Decides whether a web contents may navigate to a URL. Contents without a
 * registered policy (i.e. Arztool's own windows) may not navigate at all —
 * their initial load is done by main via loadURL, which does not trigger
 * will-navigate.
 */
export type NavigationPolicy = (url: string) => boolean

const navigationPolicies = new WeakMap<WebContents, NavigationPolicy>()

export function setNavigationPolicy(contents: WebContents, policy: NavigationPolicy): void {
  navigationPolicies.set(contents, policy)
}

function isNavigationAllowed(contents: WebContents, url: string): boolean {
  const policy = navigationPolicies.get(contents)
  return policy ? policy(url) : false
}

/**
 * Deny-by-default guards applied to every web contents the app ever creates.
 * Windows that need popups (the viewer, M3) install their own
 * setWindowOpenHandler after creation, which replaces this default.
 */
export function installGlobalGuards(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))

    contents.on('will-navigate', (event, url) => {
      if (!isNavigationAllowed(contents, url)) event.preventDefault()
    })
    contents.on('will-frame-navigate', (event) => {
      if (event.isMainFrame) return // covered by will-navigate
      if (!isNavigationAllowed(contents, event.url)) event.preventDefault()
    })
    contents.on('will-redirect', (event, url) => {
      if (!isNavigationAllowed(contents, url)) event.preventDefault()
    })
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })
}

/** Deny every permission (camera, mic, geolocation, notifications, HID, USB, …). */
export function hardenSession(ses: Session): void {
  ses.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false)
  })
  ses.setPermissionCheckHandler(() => false)
  ses.setDevicePermissionHandler(() => false)
}
