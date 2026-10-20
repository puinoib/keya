/** Session hints only. Never persist passwords or recoverable encryption keys. */
const SESSION_KEY = 'keya-session';

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage may be unavailable.
  }
}

/** Discard legacy records containing recoverable passwords. */
export function hasSession(): boolean {
  clearSession();
  return false;
}

export async function saveSession(
  _fileName: string,
  _password: string,
  _vaultId: string
): Promise<void> {
  clearSession();
}

/** Refresh requires password or PRF authentication; no secret survives reload. */
export async function loadSession(): Promise<{
  fileName: string;
  password: string;
} | null> {
  clearSession();
  return null;
}
