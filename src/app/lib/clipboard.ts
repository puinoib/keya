/**
 * Best-effort clipboard clearing that never removes content copied later.
 * The clipboard is read back first; if the value changed or access is denied,
 * nothing is cleared.
 */
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledValue: string | null = null;

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
  scheduledValue = value;
  clearTimer = setTimeout(() => {
    clearTimer = null;
    scheduledValue = null;
    void clearIfUnchanged(value);
  }, delayMs);
}

/**
 * Clear now instead of waiting out the timer. Called when the vault locks or
 * the page goes away, so a copied credential does not outlive the session.
 */
export async function clearClipboardNow(): Promise<void> {
  const value = scheduledValue;
  cancelClipboardClear();
  scheduledValue = null;
  if (value !== null) await clearIfUnchanged(value);
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
