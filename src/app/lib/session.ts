/**
 * Session persistence via sessionStorage.
 * Keeps vault unlock state across page refreshes within the same tab.
 */

const SESSION_KEY = 'keya-session'

export function saveSession(fileName: string, password: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ fileName, password }))
  } catch { /* private browsing may block sessionStorage */ }
}

export function loadSession(): { fileName: string; password: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data.fileName || !data.password) return null
    return data as { fileName: string; password: string }
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch { /* ignore */ }
}
