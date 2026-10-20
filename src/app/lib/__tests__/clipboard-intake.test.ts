import { describe, expect, it } from 'vitest';
import { tryDetectClipboardKey } from '../clipboard-intake';

function mockClipboard(text: string) {
  Object.assign(navigator, {
    clipboard: {
      readText: async () => text,
    },
  });
}

describe('clipboard intake', () => {
  it('detects an OpenAI project key copied directly', async () => {
    mockClipboard('sk-proj-abc1234567890xyz');

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.provider).toBe('OpenAI');
    expect(candidate?.draft.key_value).toBe('sk-proj-abc1234567890xyz');
    expect(candidate?.draft.endpoint).toBe('https://api.openai.com/v1');
  });

  it('detects an Anthropic key from env-style clipboard text', async () => {
    mockClipboard('ANTHROPIC_API_KEY="sk-ant-api03-abc1234567890xyz"');

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.provider).toBe('Anthropic');
    expect(candidate?.draft.key_value).toBe('sk-ant-api03-abc1234567890xyz');
    expect(candidate?.draft.endpoint).toBe('https://api.anthropic.com/v1');
  });

  it('detects a Groq key from direct token format', async () => {
    mockClipboard('gsk_abcdEFGH1234567890');

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.provider).toBe('Groq');
    expect(candidate?.draft.endpoint).toBe('https://api.groq.com/openai/v1');
  });

  it('detects an OpenRouter key from direct token format', async () => {
    mockClipboard('sk-or-v1-abc1234567890xyz');

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.provider).toBe('OpenRouter');
    expect(candidate?.draft.endpoint).toBe('https://openrouter.ai/api/v1');
  });

  it('detects provider by env name when token has no special prefix', async () => {
    mockClipboard('DEEPSEEK_API_KEY="deepseek-secret-1234567890"');

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.provider).toBe('DeepSeek');
    expect(candidate?.draft.key_value).toBe('deepseek-secret-1234567890');
    expect(candidate?.draft.endpoint).toBe('https://api.deepseek.com/v1');
  });

  it('detects provider by endpoint hint when clipboard contains config lines', async () => {
    mockClipboard(`
MISTRAL_API_KEY=plain-secret-1234567890
MISTRAL_BASE_URL=https://api.mistral.ai/v1
    `);

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.provider).toBe('Mistral');
    expect(candidate?.draft.key_value).toBe('plain-secret-1234567890');
  });

  it('detects Azure OpenAI by env name', async () => {
    mockClipboard('AZURE_OPENAI_API_KEY="azure-secret-1234567890"');

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.provider).toBe('Azure OpenAI');
    expect(candidate?.draft.endpoint).toBe(
      'https://YOUR_RESOURCE.openai.azure.com'
    );
  });

  it('detects Google by Gemini env name', async () => {
    mockClipboard('GEMINI_API_KEY="gemini-secret-1234567890"');

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.provider).toBe('Google');
    expect(candidate?.draft.endpoint).toBe(
      'https://generativelanguage.googleapis.com/v1beta'
    );
  });

  it('detects SiliconFlow by endpoint hint', async () => {
    mockClipboard(`
API_KEY=silicon-secret-1234567890
BASE_URL=https://api.siliconflow.cn/v1
    `);

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.provider).toBe('SiliconFlow');
    expect(candidate?.draft.key_value).toBe('silicon-secret-1234567890');
  });

  it('uses the last detected key when clipboard has multiple entries', async () => {
    mockClipboard(`
OPENAI_API_KEY="sk-proj-first12345678"
OPENAI_API_KEY_BACKUP="sk-proj-last87654321"
    `);

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.draft.key_value).toBe('sk-proj-last87654321');
  });

  it('uses the last provider-specific match across multiple providers', async () => {
    mockClipboard(`
OPENAI_API_KEY="sk-proj-openai12345678"
GROQ_API_KEY="gsk_groq1234567890"
    `);

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.provider).toBe('Groq');
    expect(candidate?.draft.key_value).toBe('gsk_groq1234567890');
  });

  it('deduplicates repeated keys before choosing the latest unique one', async () => {
    mockClipboard(`
OPENAI_API_KEY="sk-proj-repeat11111111"
OPENAI_API_KEY="sk-proj-repeat11111111"
OPENAI_API_KEY_ALT="sk-proj-final22222222"
    `);

    const candidate = await tryDetectClipboardKey();

    expect(candidate?.draft.key_value).toBe('sk-proj-final22222222');
  });

  it('ignores unsupported clipboard values', async () => {
    mockClipboard('hello world');

    const candidate = await tryDetectClipboardKey();

    expect(candidate).toBeNull();
  });
});
