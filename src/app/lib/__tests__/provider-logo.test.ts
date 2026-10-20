import { describe, expect, it } from 'vitest';
import { PRESET_PROVIDERS } from '../../../core/types';
import { getProviderLogo, isMonochromeProviderLogo } from '../provider-logo';

describe('provider logos', () => {
  it('has a logo for every preset provider', () => {
    const missing = PRESET_PROVIDERS.filter(
      (provider) => !getProviderLogo(provider)
    );

    expect(missing).toEqual([]);
  });

  it('maps shared marks to the same asset', () => {
    expect(getProviderLogo('Moonshot AI (Global)')).toBe(
      getProviderLogo('Moonshot')
    );
    expect(getProviderLogo('Z.AI Coding (China)')).toBe(
      getProviderLogo('Z.AI')
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

    // 27 presets; Moonshot and Z.AI each share one mark across two names.
    expect(logos.size).toBe(PRESET_PROVIDERS.length - 2);
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
        'Baseten',
        'Xiaomi MiMo',
        'Vercel AI Gateway',
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
    ]) {
      expect(isMonochromeProviderLogo(provider), provider).toBe(false);
    }
  });

  it('returns undefined for custom and unknown providers', () => {
    expect(getProviderLogo('Inhouse')).toBeUndefined();
    expect(isMonochromeProviderLogo('Inhouse')).toBe(false);
  });
});
