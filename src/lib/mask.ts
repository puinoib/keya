/** Mask a key value for display: "sk-...abc123" */
export function maskKey(key: string): string {
  if (!key || key.length <= 8) return '•••';
  return key.slice(0, 3) + '…' + key.slice(-4);
}
