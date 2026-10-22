/**
 * Deployment Worker for keya.one.
 *
 * The application itself is a static bundle served from Workers static assets.
 * This entry point exists only to add security and caching headers, which the
 * assets layer cannot express on its own.
 */

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // libsodium-wrappers-sumo compiles WebAssembly at runtime; without
  // 'wasm-unsafe-eval' unlocking and encryption fail. static.cloudflareinsights.com
  // is the Web Analytics beacon that Cloudflare injects into HTML responses at the
  // edge, kept on purpose; removing it only makes browsers log a CSP violation.
  "script-src 'self' 'wasm-unsafe-eval' https://static.cloudflareinsights.com",
  // React and third-party components set inline style attributes.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  // Provider marks and icons ship in the bundle; no remote image is loaded.
  "img-src 'self' data:",
  // Provider connectivity tests issue requests to endpoints the user supplies,
  // so this origin list cannot be narrowed to known hosts. cloudflareinsights.com
  // receives the Web Analytics beacon payload (already covered by https:).
  // No WebSocket or EventSource is used, so `ws:`/`wss:` are deliberately absent.
  "connect-src 'self' https: http: https://cloudflareinsights.com",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "worker-src 'self'",
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy': CONTENT_SECURITY_POLICY,
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000',
  // WebAuthn and clipboard access stay enabled for this origin: biometric
  // unlock and key copying depend on them.
  'permissions-policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'publickey-credentials-get=(self)',
    'publickey-credentials-create=(self)',
    'clipboard-read=(self)',
    'clipboard-write=(self)',
  ].join(', '),
};

/**
 * Vite emits content-hashed filenames under /assets/, so those files never
 * change under a given URL. index.html keeps the asset layer's revalidate
 * policy so a deploy takes effect on the next request.
 */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: AssetsBinding;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }

    if (new URL(request.url).pathname.startsWith('/assets/')) {
      headers.set('cache-control', IMMUTABLE_CACHE_CONTROL);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
