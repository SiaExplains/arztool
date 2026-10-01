import { BrowserWindow, dialog } from 'electron'
import { IpcChannel } from '@shared/ipc/channels'
import { PICKER_EXTENSIONS } from '@shared/qr/input-format'
import { convertHeicToPng } from '../heic'
import { t } from '../i18n'
import { readInputFile } from '../input-file'
import { handle } from './handle'

export function registerFileIpc(): void {
  handle(IpcChannel.FileOpenImage, async (_payload, event) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: t('dialog.openImage.title'),
      properties: ['openFile'],
      filters: [{ name: t('dialog.openImage.filter'), extensions: [...PICKER_EXTENSIONS] }],
    }
    const { canceled, filePaths } = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)

    const path = filePaths[0]
    if (canceled || !path) return { status: 'cancelled' }
    return readInputFile(path)
  })

  handle(IpcChannel.ImageConvertHeic, ({ bytes }) => convertHeicToPng(bytes))
}
