'use strict'

const { signingConfig } = require('./build/signing.cjs')

const signing = signingConfig(process.env)
console.log(`  • arztool signing  mac=${signing.mode.mac}  win=${signing.mode.win}`)
for (const warning of signing.warnings) console.warn(`  ⚠ arztool signing  ${warning}`)

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'de.arztool.app',
  productName: 'Arztool',
  copyright: 'Copyright © 2026 Siavash Ghanbari',

  directories: { output: 'release/${version}', buildResources: 'build' },
  files: ['out/**', 'package.json'],
  asar: true,

  // Electron fuses — disable Node-as-a-backdoor entry points in the shipped binary.
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
  },

  mac: {
    target: [
      { target: 'dmg', arch: ['universal'] },
      // electron-updater on macOS installs from the zip, not the dmg.
      { target: 'zip', arch: ['universal'] },
    ],
    category: 'public.app-category.medical',
    gatekeeperAssess: false,
    artifactName: '${productName}-${version}-mac-${arch}.${ext}',
    ...signing.mac,
  },
  dmg: { writeUpdateInfo: false },

  win: {
    target: [{ target: 'nsis', arch: ['x64', 'arm64'] }],
    artifactName: '${productName}-Setup-${version}.${ext}',
    ...signing.win,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: true,
  },

  publish: { provider: 'github', owner: 'SiaExplains', repo: 'arztool', releaseType: 'draft' },
}
