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
});
