import { describe, expect, it } from 'vitest'
import { localPathFromFileUrl } from '../../src/main/file-url'

describe('localPathFromFileUrl', () => {
  it.each([
    ['file:///Users/arzt/Desktop/qr.png', 'darwin', '/Users/arzt/Desktop/qr.png'],
    ['file://localhost/Users/arzt/qr.png', 'darwin', '/Users/arzt/qr.png'],
    ['file:///Users/arzt/Befund%20M%C3%BCller.png', 'darwin', '/Users/arzt/Befund Müller.png'],
    ['file:///C:/Users/Arzt/Desktop/qr.png', 'win32', 'C:\\Users\\Arzt\\Desktop\\qr.png'],
  ] as const)('%s on %s → %s', (url, platform, expected) => {
    expect(localPathFromFileUrl(url, platform)).toBe(expected)
  })

  it.each([
    ['remote host (SMB on Windows)', 'file://attacker.example/share/qr.png', 'win32'],
    ['remote host (macOS)', 'file://attacker.example/share/qr.png', 'darwin'],
    ['four-slash UNC', 'file:////attacker.example/share/qr.png', 'win32'],
    ['IP host', 'file://10.0.0.5/c$/qr.png', 'win32'],
    ['not a file URL', 'https://example.com/qr.png', 'darwin'],
    ['smb URL', 'smb://attacker.example/share/qr.png', 'win32'],
    ['garbage', 'not a url', 'darwin'],
  ] as const)('refuses %s', (_label, url, platform) => {
    expect(localPathFromFileUrl(url, platform)).toBeNull()
  })
})
