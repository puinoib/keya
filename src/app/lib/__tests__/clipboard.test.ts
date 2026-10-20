import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelClipboardClear, scheduleClipboardClear } from '../clipboard';

afterEach(() => {
  cancelClipboardClear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('scheduleClipboardClear', () => {
  it('clears only when the clipboard still contains the copied secret', async () => {
    vi.useFakeTimers();
    const readText = vi.fn(async () => 'secret');
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { readText, writeText } });

    scheduleClipboardClear('secret', 100);
    await vi.advanceTimersByTimeAsync(100);

    expect(writeText).toHaveBeenCalledWith('');
  });

  it('leaves later clipboard content untouched', async () => {
    vi.useFakeTimers();
    const readText = vi.fn(async () => 'something copied later');
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { readText, writeText } });

    scheduleClipboardClear('secret', 100);
    await vi.advanceTimersByTimeAsync(100);

    expect(writeText).not.toHaveBeenCalled();
  });

  it('does nothing when clipboard read access is denied', async () => {
    vi.useFakeTimers();
    const readText = vi.fn(async () => {
      throw new Error('denied');
    });
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { readText, writeText } });

    scheduleClipboardClear('secret', 100);
    await vi.advanceTimersByTimeAsync(100);

    expect(writeText).not.toHaveBeenCalled();
  });

  it('cancels a pending clear', async () => {
    vi.useFakeTimers();
    const readText = vi.fn(async () => 'secret');
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { readText, writeText } });

    scheduleClipboardClear('secret', 100);
    cancelClipboardClear();
    await vi.advanceTimersByTimeAsync(200);

    expect(readText).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });
});
