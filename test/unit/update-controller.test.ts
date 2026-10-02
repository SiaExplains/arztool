import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  classifyUpdateError,
  UpdateController,
  type UpdaterLike,
} from '../../src/main/updater/controller'

class FakeUpdater extends EventEmitter implements UpdaterLike {
  autoDownload = true
  autoInstallOnAppQuit = true
  allowPrerelease = true
  checkForUpdates = vi.fn(() => Promise.resolve(null))
  downloadUpdate = vi.fn(() => Promise.resolve([]))
  quitAndInstall = vi.fn()
}

const fixedNow = () => new Date('2026-10-02T12:00:00.000Z')

describe('UpdateController', () => {
  it('is "unsupported" without an updater (dev / unpackaged) and never throws', async () => {
    const controller = new UpdateController(null)
    expect(await controller.check()).toEqual({ status: 'unsupported' })
    expect(await controller.download()).toEqual({ status: 'unsupported' })
    expect(controller.install()).toEqual({ status: 'unsupported' })
  })

  it('never downloads or installs on its own', () => {
    const updater = new FakeUpdater()
    new UpdateController(updater)
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(updater.allowPrerelease).toBe(false)
  })

  it('walks check → available → download → downloaded → install, step by step', async () => {
    const updater = new FakeUpdater()
    const controller = new UpdateController(updater, fixedNow)
    const seen: string[] = []
    controller.onChange((s) => seen.push(s.status))

    updater.checkForUpdates.mockImplementation(() => {
      updater.emit('update-available', { version: '0.7.0' })
      return Promise.resolve(null)
    })
    expect(await controller.check()).toEqual({ status: 'available', version: '0.7.0' })
    expect(updater.downloadUpdate).not.toHaveBeenCalled()

    updater.downloadUpdate.mockImplementation(() => {
      updater.emit('download-progress', { percent: 41.6 })
      updater.emit('update-downloaded', { version: '0.7.0' })
      return Promise.resolve([])
    })
    expect(await controller.download()).toEqual({ status: 'downloaded', version: '0.7.0' })
    expect(updater.quitAndInstall).not.toHaveBeenCalled()

    controller.install()
    expect(updater.quitAndInstall).toHaveBeenCalledOnce()
    expect(seen).toEqual(['checking', 'available', 'downloading', 'downloading', 'downloaded'])
  })

  it('reports up-to-date with the check time', async () => {
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockImplementation(() => {
      updater.emit('update-not-available', {})
      return Promise.resolve(null)
    })
    const controller = new UpdateController(updater, fixedNow)
    expect(await controller.check()).toEqual({
      status: 'up-to-date',
      checkedAt: '2026-10-02T12:00:00.000Z',
    })
  })

  it('refuses out-of-order steps', async () => {
    const updater = new FakeUpdater()
    const controller = new UpdateController(updater)
    await controller.download()
    controller.install()
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('turns failures into a classified error state', async () => {
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockRejectedValue(new Error('net::ERR_INTERNET_DISCONNECTED'))
    const controller = new UpdateController(updater)
    expect(await controller.check()).toEqual({ status: 'error', kind: 'network' })
  })
})

describe('classifyUpdateError', () => {
  it.each([
    ['net::ERR_NAME_NOT_RESOLVED', 'network'],
    ['getaddrinfo ENOTFOUND github.com', 'network'],
    ['HttpError: 503 status code 503', 'network'],
    ['Could not get code signature for running application', 'signature'],
    ['New version is not signed by the application owner: publisherName: X', 'signature'],
    ['Cannot find latest-mac.yml', 'other'],
  ])('%s → %s', (message, kind) => {
    expect(classifyUpdateError(new Error(message))).toBe(kind)
  })
})
