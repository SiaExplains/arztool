import { readFileSync } from 'node:fs'
import { rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'

/**
 * Tiny JSON persistence in userData: synchronous read at startup, atomic
 * (write temp + rename) and serialised writes, owner-only file mode.
 */
function pathFor(name: string): string {
  return join(app.getPath('userData'), `${name}.json`)
}

export function readJson(name: string): unknown {
  try {
    return JSON.parse(readFileSync(pathFor(name), 'utf8')) as unknown
  } catch {
    return undefined
  }
}

const queues = new Map<string, Promise<void>>()

function enqueue(name: string, task: () => Promise<void>): Promise<void> {
  const next = (queues.get(name) ?? Promise.resolve()).then(task, task)
  queues.set(name, next)
  return next
}

export function writeJson(name: string, value: unknown): Promise<void> {
  return enqueue(name, async () => {
    const target = pathFor(name)
    const tmp = `${target}.tmp`
    await writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 })
    await rename(tmp, target)
  })
}

export function deleteJson(name: string): Promise<void> {
  return enqueue(name, () => rm(pathFor(name), { force: true }))
}
