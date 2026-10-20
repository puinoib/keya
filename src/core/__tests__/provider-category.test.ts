import { describe, expect, it } from 'vitest';
import {
  PRESET_PROVIDERS,
  getProviderCategory,
  getProviderSections,
  getProvidersForDropdown,
  groupProvidersByCategory,
  type Settings,
} from '../types';

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    auto_lock_minutes: 5,
    auto_test_on_save: false,
    auto_test_daily: false,
    clipboard_detection_on_add: true,
    custom_providers: [],
    disabled_providers: [],
    ...overrides,
  };
}

describe('provider categories', () => {
  it('classifies non-model presets and defaults to models', () => {
    expect(getProviderCategory('OpenAI')).toBe('model');
    expect(getProviderCategory('deepinfra')).toBe('model');
    expect(getProviderCategory('Stability AI')).toBe('media');
    expect(getProviderCategory('recraft')).toBe('media');
    expect(getProviderCategory('Firecrawl')).toBe('platform');
    expect(getProviderCategory('exa')).toBe('platform');
    expect(getProviderCategory('GitHub')).toBe('platform');
    expect(getProviderCategory('vercel')).toBe('platform');
    expect(getProviderCategory('Stripe')).toBe('platform');
  });

  it('classifies every preset exactly once', () => {
    const sections = groupProvidersByCategory(PRESET_PROVIDERS);
    const grouped = sections.flatMap((section) => section.providers);

    expect(sections.map((section) => section.id)).toEqual([
      'model',
      'media',
      'platform',
    ]);
    expect(grouped).toHaveLength(PRESET_PROVIDERS.length);
    expect(new Set(grouped).size).toBe(PRESET_PROVIDERS.length);
    expect([...grouped].sort()).toEqual([...PRESET_PROVIDERS].sort());
  });

  it('keeps preset order inside each section', () => {
    for (const section of groupProvidersByCategory(PRESET_PROVIDERS)) {
      const expected = PRESET_PROVIDERS.filter((provider) =>
        section.providers.includes(provider)
      );
      expect(section.providers).toEqual(expected);
    }
  });

  it('drops disabled presets and lists custom providers last', () => {
    const sections = getProviderSections(
      settings({
        disabled_providers: ['OpenAI', 'Stripe'],
        custom_providers: [{ name: 'Inhouse', endpoint: 'https://x.test/v1' }],
      })
    );

    const flat = sections.flatMap((section) => section.providers);
    expect(flat).not.toContain('OpenAI');
    expect(flat).not.toContain('Stripe');
    expect(sections.at(-1)?.id).toBe('custom');
    expect(sections.at(-1)?.providers).toEqual(['Inhouse', 'Custom']);
  });

  it('keeps the Custom entry selectable when nothing is custom', () => {
    const sections = getProviderSections(undefined);

    expect(sections.at(-1)).toEqual({
      id: 'custom',
      label: 'Custom providers',
      providers: ['Custom'],
    });
    expect(getProvidersForDropdown(undefined)).toContain('Custom');
  });

  it('flattens sections for the dropdown in the same order', () => {
    const sections = getProviderSections(undefined);

    expect(getProvidersForDropdown(undefined)).toEqual(
      sections.flatMap((section) => section.providers)
    );
  });
});
