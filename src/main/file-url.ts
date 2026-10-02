import { fileURLToPath } from 'node:url'

/**
 * Turn a `file:` URL from the clipboard into a *local* path, or null.
 *
 * Anything pointing at another machine is refused: on Windows,
 * `file://host/share/x.png` becomes `\\host\share\x.png`, and merely calling
 * stat() on it can open an SMB connection that leaks the user's NTLM hash.
 * The file picker is unaffected — there the user chooses the path themselves.
 */
export function localPathFromFileUrl(
  candidate: string,
  platform: NodeJS.Platform = process.platform,
): string | null {
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol !== 'file:') return null
  if (url.hostname !== '' && url.hostname !== 'localhost') return null

  let path: string
  try {
    path = fileURLToPath(url, { windows: platform === 'win32' })
  } catch {
    return null
  }
  // file:////host/share and \\?\UNC\… arrive with an empty URL host but still name a remote share.
  if (path.startsWith('\\\\') || path.startsWith('//')) return null
  return path
}
