import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

interface SigningResult {
  mac: Record<string, unknown>
  win: Record<string, unknown>
  mode: { mac: string; win: string }
  warnings: string[]
}
const { signingConfig } = createRequire(import.meta.url)('../../build/signing.cjs') as {
  signingConfig: (env: Record<string, string | undefined>) => SigningResult
}

const macCert = { CSC_LINK: 'base64-p12', CSC_KEY_PASSWORD: 'pw' }
const notaryKey = { APPLE_API_KEY: '/k.p8', APPLE_API_KEY_ID: 'ID', APPLE_API_ISSUER: 'issuer' }
const notaryAppleId = { APPLE_ID: 'a@b.de', APPLE_APP_SPECIFIC_PASSWORD: 'x', APPLE_TEAM_ID: 'T' }
const azure = {
  AZURE_TENANT_ID: 't',
  AZURE_CLIENT_ID: 'c',
  AZURE_CLIENT_SECRET: 's',
  AZURE_SIGNING_ENDPOINT: 'https://weu.codesigning.azure.net',
  AZURE_SIGNING_ACCOUNT: 'arztool',
  AZURE_SIGNING_CERT_PROFILE: 'public',
  AZURE_SIGNING_PUBLISHER: 'Siavash Ghanbari',
}

describe('signingConfig', () => {
  it('is ad-hoc/unsigned with no environment (local builds, PR CI)', () => {
    const result = signingConfig({})
    expect(result.mode).toEqual({ mac: 'ad-hoc', win: 'unsigned' })
    expect(result.mac).toEqual({ identity: '-', hardenedRuntime: false, notarize: false })
    expect(result.win).toEqual({})
    expect(result.warnings).toEqual([])
  })

  it('never signs without the explicit ARZTOOL_SIGN=1 opt-in, even with secrets present', () => {
    expect(signingConfig({ ...macCert, ...notaryKey, ...azure }).mode).toEqual({
      mac: 'ad-hoc',
      win: 'unsigned',
    })
  })

  it.each([
    ['API key', notaryKey],
    ['Apple ID', notaryAppleId],
  ])('signs and notarizes macOS (%s)', (_label, notary) => {
    const result = signingConfig({ ARZTOOL_SIGN: '1', ...macCert, ...notary })
    expect(result.mode.mac).toBe('signed+notarized')
    expect(result.mac).toMatchObject({ hardenedRuntime: true, notarize: true })
    expect(result.mac).not.toHaveProperty('identity')
  })

  it('signs without notarizing when notary secrets are incomplete, and says so', () => {
    const result = signingConfig({ ARZTOOL_SIGN: '1', ...macCert, APPLE_ID: 'a@b.de' })
    expect(result.mode.mac).toBe('signed')
    expect(result.warnings.join()).toMatch(/NOT notarized/)
  })

  it('falls back to ad-hoc with a warning when the mac certificate is missing', () => {
    const result = signingConfig({ ARZTOOL_SIGN: '1', ...notaryKey })
    expect(result.mode.mac).toBe('ad-hoc')
    expect(result.warnings.join()).toMatch(/no CSC_LINK/)
  })

  it('uses Azure Trusted Signing on Windows when all its secrets are present', () => {
    const result = signingConfig({ ARZTOOL_SIGN: '1', ...azure })
    expect(result.mode.win).toBe('azure')
    expect(result.win).toEqual({
      azureSignOptions: {
        publisherName: 'Siavash Ghanbari',
        endpoint: 'https://weu.codesigning.azure.net',
        codeSigningAccountName: 'arztool',
        certificateProfileName: 'public',
      },
    })
  })

  it('treats an incomplete Azure set as unsigned (no half-configured signing)', () => {
    const result = signingConfig({ ARZTOOL_SIGN: '1', ...azure, AZURE_CLIENT_SECRET: undefined })
    expect(result.mode.win).toBe('unsigned')
    expect(result.warnings.join()).toMatch(/Windows/)
  })

  it('reports an OV/EV certificate, which electron-builder applies itself', () => {
    expect(signingConfig({ WIN_CSC_LINK: 'base64-pfx' }).mode.win).toBe('certificate')
  })

  it('ignores empty-string secrets (unset GitHub secrets arrive as "")', () => {
    expect(
      signingConfig({ ARZTOOL_SIGN: '1', CSC_LINK: '', ...azure, AZURE_CLIENT_ID: '' }).mode,
    ).toEqual({
      mac: 'ad-hoc',
      win: 'unsigned',
    })
  })
})
