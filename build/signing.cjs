'use strict'

/**
 * Decides how a build is signed, from the environment only — secrets are never
 * committed. Signing happens only when the release workflow opts in with
 * ARZTOOL_SIGN=1 *and* the matching secrets are present; everything else
 * (local builds, PR CI, forks) produces the ad-hoc / unsigned build that still
 * runs. Missing secrets downgrade with a warning instead of failing the build.
 *
 * macOS: Developer ID via CSC_LINK (+ CSC_KEY_PASSWORD) or CSC_NAME; notarized
 *   with an App Store Connect API key (preferred) or Apple ID + app password.
 * Windows: Azure Trusted Signing (preferred), or an OV/EV certificate via
 *   WIN_CSC_LINK (+ WIN_CSC_KEY_PASSWORD), which electron-builder picks up itself.
 *
 * @param {Record<string, string | undefined>} env
 */
function signingConfig(env) {
  const has = (/** @type {string[]} */ ...keys) =>
    keys.every((key) => typeof env[key] === 'string' && env[key] !== '')
  const wantsSigning = env.ARZTOOL_SIGN === '1'

  const macCert = has('CSC_LINK') || has('CSC_NAME')
  const notarizeWithApiKey = has('APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER')
  const notarizeWithAppleId = has('APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID')
  const macSigned = wantsSigning && macCert
  const notarize = macSigned && (notarizeWithApiKey || notarizeWithAppleId)

  const azure = has(
    'AZURE_TENANT_ID',
    'AZURE_CLIENT_ID',
    'AZURE_CLIENT_SECRET',
    'AZURE_SIGNING_ENDPOINT',
    'AZURE_SIGNING_ACCOUNT',
    'AZURE_SIGNING_CERT_PROFILE',
    'AZURE_SIGNING_PUBLISHER',
  )
  const winCert = has('WIN_CSC_LINK')
  const winMode = wantsSigning && azure ? 'azure' : winCert ? 'certificate' : 'unsigned'

  /** @type {string[]} */
  const warnings = []
  if (wantsSigning && !macCert) {
    warnings.push('macOS: ARZTOOL_SIGN=1 but no CSC_LINK/CSC_NAME — building ad-hoc signed')
  }
  if (macSigned && !notarize) {
    warnings.push(
      'macOS: signed but NOT notarized — set APPLE_API_KEY(+_ID,+ISSUER) or APPLE_ID(+APP_SPECIFIC_PASSWORD,+TEAM_ID)',
    )
  }
  if (wantsSigning && winMode === 'unsigned') {
    warnings.push(
      'Windows: ARZTOOL_SIGN=1 but no Azure Trusted Signing secrets or WIN_CSC_LINK — building unsigned',
    )
  }

  return {
    mac: macSigned
      ? {
          // identity left to electron-builder: it imports CSC_LINK into a temporary keychain.
          hardenedRuntime: true,
          entitlements: 'build/entitlements.mac.plist',
          entitlementsInherit: 'build/entitlements.mac.plist',
          notarize,
        }
      : {
          // Ad-hoc: fuses rewrite the binary and Apple Silicon kills an invalid signature
          // (DECISIONS 010). Hardened runtime would reject the ad-hoc-signed frameworks.
          identity: '-',
          hardenedRuntime: false,
          notarize: false,
        },
    win:
      winMode === 'azure'
        ? {
            azureSignOptions: {
              publisherName: /** @type {string} */ (env.AZURE_SIGNING_PUBLISHER),
              endpoint: /** @type {string} */ (env.AZURE_SIGNING_ENDPOINT),
              codeSigningAccountName: /** @type {string} */ (env.AZURE_SIGNING_ACCOUNT),
              certificateProfileName: /** @type {string} */ (env.AZURE_SIGNING_CERT_PROFILE),
            },
          }
        : {},
    mode: {
      mac: notarize ? 'signed+notarized' : macSigned ? 'signed' : 'ad-hoc',
      win: winMode,
    },
    warnings,
  }
}

module.exports = { signingConfig }
