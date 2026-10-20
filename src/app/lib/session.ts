/** Remove legacy session records containing recoverable master passwords. */
export function clearLegacySession(): void {
  try {
    sessionStorage.removeItem('keya-session');
  } catch {
    // Storage may be unavailable.
  }
}
