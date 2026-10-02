import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)

/**
 * Electron does not mark downloads as coming from the internet (checked on
 * macOS: no com.apple.quarantine). Portals can serve ZIPs or executables, so
 * main marks every completed viewer download itself:
 *
 *  - macOS: com.apple.quarantine, so Gatekeeper checks the file when opened.
 *  - Windows: the Zone.Identifier stream ("Mark of the Web", ZoneId=3 =
 *    Internet), so SmartScreen and Office Protected View apply.
 *
 * The source URL is deliberately not recorded: portal URLs carry access tokens.
 */
export function quarantineValue(now: Date, id: string = randomUUID()): string {
  // Flags 0081 = downloaded + user-approved save; timestamp in hex seconds.
  return `0081;${Math.floor(now.getTime() / 1000).toString(16)};Arztool;${id.toUpperCase()}`
}

export const ZONE_IDENTIFIER = '[ZoneTransfer]\r\nZoneId=3\r\n'

export async function markAsDownloaded(path: string): Promise<boolean> {
  try {
    if (process.platform === 'darwin') {
      await run('/usr/bin/xattr', ['-w', 'com.apple.quarantine', quarantineValue(new Date()), path])
      return true
    }
    if (process.platform === 'win32') {
      await writeFile(`${path}:Zone.Identifier`, ZONE_IDENTIFIER)
      return true
    }
  } catch {
    // Non-NTFS volume or missing xattr support: the file is still saved; nothing to undo.
  }
  return false
}
