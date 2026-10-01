/**
 * Content-Security-Policy for Arztool's own renderer (never applied to the
 * third-party portals shown in the viewer — those bring their own).
 *
 * - 'wasm-unsafe-eval' is required to instantiate zxing-wasm; it does not allow eval().
 * - blob:/data: images are the decoded/pasted QR images, which never leave the renderer.
 * - connect-src 'self' means the renderer cannot reach the network at all.
 */
export function buildCsp({ dev }: { dev: boolean }): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'wasm-unsafe-eval'"],
    'style-src': ["'self'"],
    'img-src': ["'self'", 'blob:', 'data:'],
    'font-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'connect-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
    'frame-src': ["'none'"],
  }

  if (dev) {
    // React Refresh injects an inline module preamble and Vite injects inline
    // <style> tags; HMR talks over a websocket to the dev server.
    directives['script-src']?.push("'unsafe-inline'")
    directives['style-src']?.push("'unsafe-inline'")
    directives['connect-src']?.push('ws://localhost:*', 'http://localhost:*')
  }

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}
