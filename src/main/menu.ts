import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import { IpcEvent } from '@shared/ipc/channels'
import { t } from './i18n'
import { getShellWindow } from './windows/shell'

function sendToShell(channel: string): void {
  const win = getShellWindow()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
  win.webContents.send(channel)
}

/**
 * Built from the current language; call again after the language changes.
 * The Edit menu is not optional: on macOS, Cmd+V/C/X/A only reach web content
 * through menu roles.
 */
export function installAppMenu(): void {
  const isMac = process.platform === 'darwin'

  const about: MenuItemConstructorOptions = {
    id: 'about',
    label: t('menu.about'),
    click: () => {
      sendToShell(IpcEvent.MenuOpenAbout)
    },
  }
  const settings: MenuItemConstructorOptions = {
    id: 'settings',
    label: t('menu.settings'),
    accelerator: 'CmdOrCtrl+,',
    click: () => {
      sendToShell(IpcEvent.MenuOpenSettings)
    },
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.getName(),
            submenu: [
              about,
              { type: 'separator' },
              settings,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ] satisfies MenuItemConstructorOptions[],
          },
        ]
      : []),
    {
      label: t(isMac ? 'menu.fileMac' : 'menu.file'),
      submenu: [
        {
          id: 'open-image',
          label: t('menu.openImage'),
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            sendToShell(IpcEvent.MenuOpenImage)
          },
        },
        ...(isMac ? [] : [{ type: 'separator' as const }, settings]),
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      role: 'viewMenu',
      submenu: [
        ...(app.isPackaged
          ? []
          : ([
              { role: 'reload' },
              { role: 'toggleDevTools' },
              { type: 'separator' },
            ] satisfies MenuItemConstructorOptions[])),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    ...(isMac ? [] : [{ label: t('menu.help'), submenu: [about] }]),
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
