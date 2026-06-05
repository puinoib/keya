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

  it('uses the last detected key when clipboard has multiple entries', async () => {
    Object.assign(navigator, {
      clipboard: {
        readText: async () => `
OPENAI_API_KEY="sk-proj-first12345678"
OPENAI_API_KEY_BACKUP="sk-proj-last87654321"
        `,
      },
    });

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.draft.key_value).toBe('sk-proj-last87654321');
  });

  it('deduplicates repeated keys before choosing the latest unique one', async () => {
    Object.assign(navigator, {
      clipboard: {
        readText: async () => `
OPENAI_API_KEY="sk-proj-repeat11111111"
OPENAI_API_KEY="sk-proj-repeat11111111"
OPENAI_API_KEY_ALT="sk-proj-final22222222"
        `,
      },
    });

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.draft.key_value).toBe('sk-proj-final22222222');
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
