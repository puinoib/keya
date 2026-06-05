/**
 * Session persistence via sessionStorage.
 * Password is encrypted with AES-GCM using a key derived from vaultId.
 */

const SESSION_KEY = 'keya-session';

// ── Helpers ──

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveEncryptKey(vaultId: string): Promise<CryptoKey> {
  const rawKey = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(vaultId)
  );
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

// ── Public API ──

/** Check if a session exists (synchronous, for route guards and store init) */
export function hasSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) !== null;
  } catch {
    return false;
  }
}

/** Save encrypted session to sessionStorage */
export async function saveSession(
  fileName: string,
  password: string,
  vaultId: string
): Promise<void> {
  try {
    const key = await deriveEncryptKey(vaultId);
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      new TextEncoder().encode(password)
    );
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        fileName,
        vid: vaultId,
        ep: toBase64(new Uint8Array(encrypted)),
        n: toBase64(nonce),
      })
    );
  } catch {
    /* private browsing may block sessionStorage */
  }
}

/** Load and decrypt session from sessionStorage */
export async function loadSession(): Promise<{
  fileName: string;
  password: string;
} | null> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.fileName || !data.ep || !data.n || !data.vid) return null;

    const key = await deriveEncryptKey(data.vid);
    const encrypted = fromBase64(data.ep);
    const nonce = fromBase64(data.n);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource },
      key,
      encrypted as BufferSource
    );
    return {
      fileName: data.fileName,
      password: new TextDecoder().decode(decrypted),
    };
  } catch {
    return null;
  }
}

/** Clear session from sessionStorage */
export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
