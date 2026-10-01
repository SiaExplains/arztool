import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { APP_SCHEME, resolveAppAssetPath } from './app-protocol'

/** Must run before app `ready`. */
export function registerAppSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ])
}

/**
 * Serve the built renderer from app://arztool/. Registered on the default
 * session only, so viewer partitions (third-party portals) cannot reach it.
 */
export function registerAppProtocol(rendererDir: string): void {
  const root = resolve(rendererDir)
  protocol.handle(APP_SCHEME, (request) => {
    const relative = resolveAppAssetPath(request.url)
    if (relative === null) return new Response(null, { status: 404 })

    const filePath = resolve(join(root, relative))
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      return new Response(null, { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
}
