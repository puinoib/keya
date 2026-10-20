import { describe, expect, it } from 'vitest';
import {
  ENDPOINT_DEFAULTS,
  PRESET_PROVIDERS,
  getDefaultEndpointForProvider,
} from '../types';

describe('provider endpoint configuration', () => {
  it('resolves an endpoint for every preset provider', () => {
    for (const provider of PRESET_PROVIDERS) {
      expect(
        getDefaultEndpointForProvider(provider, undefined),
        provider
      ).toBeTruthy();
    }
  });

  it('resolves display names that differ from ENDPOINT_DEFAULTS keys', () => {
    expect(getDefaultEndpointForProvider('Alibaba Cloud', undefined)).toBe(
      ENDPOINT_DEFAULTS.alibaba
    );
    expect(getDefaultEndpointForProvider('Amazon Bedrock', undefined)).toBe(
      ENDPOINT_DEFAULTS.amazon_bedrock
    );
    expect(getDefaultEndpointForProvider('Azure OpenAI', undefined)).toBe(
      ENDPOINT_DEFAULTS.azure
    );
  });

  it('resolves case-insensitively and falls back to custom providers', () => {
    expect(getDefaultEndpointForProvider('openai', undefined)).toBe(
      ENDPOINT_DEFAULTS.openai
    );
    expect(
      getDefaultEndpointForProvider('Inhouse', {
        auto_lock_minutes: 5,
        auto_test_on_save: false,
        auto_test_daily: false,
        clipboard_detection_on_add: true,
        custom_providers: [
          { name: 'Inhouse', endpoint: 'https://ai.example.com/v1' },
        ],
        disabled_providers: [],
      })
    ).toBe('https://ai.example.com/v1');
  });

  it('keeps preset names unique and endpoints distinct', () => {
    expect(new Set(PRESET_PROVIDERS).size).toBe(PRESET_PROVIDERS.length);

    const endpoints = PRESET_PROVIDERS.map(
      (provider) => getDefaultEndpointForProvider(provider, undefined) ?? ''
    );
    expect(new Set(endpoints).size).toBe(PRESET_PROVIDERS.length);

    for (const endpoint of endpoints) {
      expect(endpoint, endpoint).toMatch(/^https:\/\//);
      expect(endpoint.endsWith('/'), endpoint).toBe(false);
    }
  });

  it('has no unused ENDPOINT_DEFAULTS entries', () => {
    const usedKeys = new Set(
      PRESET_PROVIDERS.map((provider) =>
        getDefaultEndpointForProvider(provider, undefined)
      )
    );

    for (const value of Object.values(ENDPOINT_DEFAULTS)) {
      expect(usedKeys.has(value), value).toBe(true);
    }
  });

  it('resolves the newer OpenAI-compatible presets', () => {
    const expected: Record<string, string> = {
      'NVIDIA NIM': 'https://integrate.api.nvidia.com/v1',
      Cerebras: 'https://api.cerebras.ai/v1',
      Fireworks: 'https://api.fireworks.ai/inference/v1',
      Baseten: 'https://inference.baseten.co/v1',
      'Hugging Face': 'https://router.huggingface.co/v1',
      'Xiaomi MiMo': 'https://api.xiaomimimo.com/v1',
      'Z.AI': 'https://api.z.ai/api/coding/paas/v4',
      'Z.AI Coding (China)': 'https://open.bigmodel.cn/api/coding/paas/v4',
      'Moonshot AI (Global)': 'https://api.moonshot.ai/v1',
      'Vercel AI Gateway': 'https://ai-gateway.vercel.sh/v1',
    };

    for (const [provider, endpoint] of Object.entries(expected)) {
      expect(getDefaultEndpointForProvider(provider, undefined), provider).toBe(
        endpoint
      );
    }
  });
});
