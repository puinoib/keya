import { describe, expect, it } from 'vitest';
import { tryDetectClipboardKey } from '../clipboard-intake';

describe('clipboard intake', () => {
  it('detects an OpenAI project key copied directly', async () => {
    Object.assign(navigator, {
      clipboard: {
        readText: async () => 'sk-proj-abc1234567890xyz',
      },
    });

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.provider).toBe('OpenAI');
    expect(candidate?.draft.key_value).toBe('sk-proj-abc1234567890xyz');
    expect(candidate?.draft.endpoint).toBe('https://api.openai.com/v1');
  });

  it('detects an OpenAI project key from env-style clipboard text', async () => {
    Object.assign(navigator, {
      clipboard: {
        readText: async () =>
          'OPENAI_API_KEY="sk-proj-abc1234567890xyz"',
      },
    });

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.draft.key_value).toBe('sk-proj-abc1234567890xyz');
  });

  it('ignores unsupported clipboard values', async () => {
    Object.assign(navigator, {
      clipboard: {
        readText: async () => 'hello world',
      },
    });

    const candidate = await tryDetectClipboardKey();

    expect(candidate).toBeNull();
  });
});
