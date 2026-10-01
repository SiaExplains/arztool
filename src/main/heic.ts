import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { ConvertHeicResult } from '@shared/ipc/channels'

const run = promisify(execFile)

/**
 * HEIC → PNG via macOS's built-in `sips`. Neither Chromium nor Electron's
 * nativeImage decodes HEIC, and bundling libheif would add an LGPL decoder.
 *
 * The image touches disk briefly: a private 0700 temp dir, removed in `finally`.
 * `sips` is invoked by absolute path with fixed arguments and no shell.
 */
export async function convertHeicToPng(bytes: Uint8Array): Promise<ConvertHeicResult> {
  if (process.platform !== 'darwin') return { status: 'error', error: 'heic-unsupported' }

  const dir = await mkdtemp(join(tmpdir(), 'arztool-heic-'))
  try {
    const input = join(dir, 'in.heic')
    const output = join(dir, 'out.png')
    await writeFile(input, bytes, { mode: 0o600 })
    await run('/usr/bin/sips', ['-s', 'format', 'png', input, '--out', output], {
      timeout: 15_000,
    })
    return { status: 'ok', bytes: new Uint8Array(await readFile(output)) }
  } catch {
    return { status: 'error', error: 'heic-failed' }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
