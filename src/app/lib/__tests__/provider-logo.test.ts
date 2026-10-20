import { describe, expect, it } from 'vitest';
import { PRESET_PROVIDERS } from '../../../core/types';
import { getProviderLogo, isMonochromeProviderLogo } from '../provider-logo';

describe('provider logos', () => {
  it('reports preset providers that still lack a mark', () => {
    const missing = PRESET_PROVIDERS.filter(
      (provider) => !getProviderLogo(provider)
    );

    // The remaining provider still renders the initial-letter fallback.
    expect(missing).toEqual(['Baidu Qianfan']);
  });

  it('maps shared marks to the same asset', () => {
    expect(getProviderLogo('Moonshot AI (Global)')).toBe(
      getProviderLogo('Moonshot')
    );
    expect(getProviderLogo('Z.AI Coding (China)')).toBe(
      getProviderLogo('Z.AI')
    );
    expect(getProviderLogo('Z.AI (General)')).toBe(getProviderLogo('Z.AI'));
    expect(getProviderLogo('Vercel')).toBe(
      getProviderLogo('Vercel AI Gateway')
    );
  });

  it('points every preset at a provider asset', () => {
    const logos = new Set<string>();

    for (const provider of PRESET_PROVIDERS) {
      const logo = getProviderLogo(provider);
      if (!logo) continue;
      expect(typeof logo, provider).toBe('string');
      expect(logo.length, provider).toBeGreaterThan(0);
      logos.add(logo);
    }

    // 50 presets, 1 without a mark. Moonshot (2), Z.AI (3), Vercel (2) and
    // OpenCode (2) share one asset each, which drops five more distinct URLs.
    expect(logos.size).toBe(PRESET_PROVIDERS.length - 1 - 5);
  });

  it('marks only monochrome marks for dark theme inversion', () => {
    const monochrome = PRESET_PROVIDERS.filter(isMonochromeProviderLogo).sort();

    expect(monochrome).toEqual(
      [
        'OpenAI',
        'Anthropic',
        'xAI',
        'Moonshot',
        'Moonshot AI (Global)',
        'Z.AI',
        'Z.AI Coding (China)',
        'Z.AI (General)',
        'Baseten',
        'Xiaomi MiMo',
        'Vercel AI Gateway',
        'Vercel',
        'GitHub',
        'OpenCode Zen',
        'OpenCode Go',
        'StepFun',
        'Reka',
        'Upstage',
        'Nebius',
        'Chutes',
        'Recraft',
      ].sort()
    );

    for (const provider of monochrome) {
      expect(getProviderLogo(provider), provider).toBeTruthy();
    }

    // Brand-coloured marks keep their fills and must not be inverted.
    for (const provider of [
      'Google',
      'DeepSeek',
      'Zhipu',
      'Mistral',
      'Groq',
      'Cohere',
      'Cerebras',
      'Fireworks',
      'SiliconFlow',
      'NVIDIA NIM',
      'Hugging Face',
      'OpenRouter',
      'Together',
      'Perplexity',
      'Exa',
      'Gitee AI',
      'Tencent Hunyuan',
      'Baichuan',
      'Firecrawl',
      'Stripe',
      'Stability AI',
      'DeepInfra',
      'Hyperbolic',
    ]) {
      expect(isMonochromeProviderLogo(provider), provider).toBe(false);
    }
  });

  it('returns undefined for custom and unknown providers', () => {
    expect(getProviderLogo('Inhouse')).toBeUndefined();
    expect(isMonochromeProviderLogo('Inhouse')).toBe(false);
  });
});
