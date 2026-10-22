/**
 * Best-effort clipboard clearing that never removes content copied later.
 * The clipboard is read back first; if the value changed or access is denied,
 * nothing is cleared.
 */
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function cancelClipboardClear(): void {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
}

export function scheduleClipboardClear(value: string, delayMs = 15_000): void {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.readText !== 'function'
  ) {
    return;
  }

  cancelClipboardClear();
  clearTimer = setTimeout(() => {
    clearTimer = null;
    void clearIfUnchanged(value);
  }, delayMs);
}

async function clearIfUnchanged(value: string): Promise<void> {
  try {
    const current = await navigator.clipboard.readText();
    if (current === value) {
      await navigator.clipboard.writeText('');
    }
  } catch {
    // Clipboard access can be denied or require focus; leave it untouched.
  }
}
