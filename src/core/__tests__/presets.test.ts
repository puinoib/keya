/**
 * §10.3 — recipe states, and the preset data migration that P8 verifies.
 */

import { describe, expect, it } from 'vitest';
import { PRESETS, findPreset, presetId } from '../presets/data';
import { classifyRecipe, isExecutable } from '../presets/classify';
import type { Provider } from '../payload/types';

const custom = (overrides: Partial<Provider> = {}): Provider => ({
  id: 'custom:44444444-4444-4444-8444-444444444444',
  name: 'Edge',
  description: '',
  default_endpoint: null,
  probe: {
    target: 'models',
    auth: { mode: 'bearer' },
    headers: [],
  },
  ...overrides,
});

describe('preset data', () => {
  it('ships 50 presets with unique slugs', () => {
    expect(PRESETS).toHaveLength(50);
    expect(new Set(PRESETS.map((preset) => preset.slug)).size).toBe(50);
  });

  it('every slug matches the frozen grammar', () => {
    for (const preset of PRESETS) {
      expect(preset.slug).toMatch(/^[a-z0-9][a-z0-9-]{0,62}$/);
    }
  });

  it('keeps unverifiable providers out of the probe path', () => {
    for (const slug of ['amazon-bedrock', 'nvidia', 'baseten', 'exa']) {
      const preset = findPreset(slug);
      expect(preset, slug).toBeDefined();
      expect(preset!.probe).toBeNull();
      expect(preset!.unverifiable).toBeTruthy();
    }
  });

  it('carries the migrated corrections', () => {
    // Leading slashes were "append to endpoint" in the old resolver; under
    // WHATWG rules they would be root-relative and drop the /api/v1 segment.
    expect(findPreset('openrouter')!.probe!.target).toBe('key');
    expect(findPreset('github')!.probe!.target).toBe('user');

    // Azure needs a constant query parameter, which only targets allow.
    expect(findPreset('azure')!.probe!.target).toBe(
      'openai/models?api-version=2024-10-21'
    );

    // Anthropic needs three headers, two of them protocol constants.
    const anthropic = findPreset('anthropic')!;
    expect(anthropic.probe!.auth).toEqual({
      mode: 'header',
      name: 'x-api-key',
    });
    expect(anthropic.probe!.headers.map((header) => header.name)).toEqual([
      'anthropic-version',
      'anthropic-dangerous-direct-browser-access',
    ]);

    // Google sends the credential as a query parameter.
    expect(findPreset('google')!.probe!.auth).toEqual({
      mode: 'query',
      param: 'key',
    });
  });

  it('never claims credential validity from a public endpoint', () => {
    expect(findPreset('openai')!.verifies).toBe('credential');
    expect(findPreset('openrouter')!.verifies).toBe('credential');
    // Generic OpenAI-compatible /models responses only prove the request passed.
    expect(findPreset('groq')!.verifies).toBe('request');
  });
});

describe('§10.3 recipe states', () => {
  it('reports capability missing for unverifiable presets', () => {
    const state = classifyRecipe(
      { provider_id: presetId('exa'), endpoint: 'https://api.exa.ai' },
      []
    );
    expect(state).toMatchObject({
      kind: 'not_executable',
      reason: 'capability_missing',
    });
    if (state.kind === 'not_executable') {
      expect(state.unverifiable).toBeTruthy();
    }
  });

  it('reports unknown presets separately', () => {
    const state = classifyRecipe(
      { provider_id: 'preset:not-shipped-yet', endpoint: null },
      []
    );
    expect(state).toMatchObject({
      kind: 'not_executable',
      reason: 'unknown_preset',
    });
  });

  it('reports a missing endpoint for a relative target', () => {
    const providers = [custom()];
    const state = classifyRecipe(
      { provider_id: providers[0].id, endpoint: null },
      providers
    );
    expect(state).toMatchObject({
      kind: 'not_executable',
      reason: 'missing_endpoint',
    });
  });

  it('reports an invalid target separately from a missing one', () => {
    const providers = [
      custom({
        probe: {
          target: 'mailto:someone@example.com',
          auth: { mode: 'bearer' },
          headers: [],
        },
      }),
    ];
    const state = classifyRecipe(
      { provider_id: providers[0].id, endpoint: 'https://edge.example.com' },
      providers
    );
    expect(state).toMatchObject({
      kind: 'not_executable',
      reason: 'invalid_target',
    });
  });

  it('classifies https as automatic and http as manual only', () => {
    const providers = [
      custom({
        probe: {
          target: 'http://192.168.1.5:8080/health',
          auth: { mode: 'bearer' },
          headers: [],
        },
      }),
    ];
    const manual = classifyRecipe(
      { provider_id: providers[0].id, endpoint: null },
      providers
    );
    expect(manual.kind).toBe('manual_only');

    const secured = classifyRecipe(
      { provider_id: presetId('openai'), endpoint: 'https://api.openai.com/v1' },
      []
    );
    expect(secured.kind).toBe('auto');
    if (secured.kind === 'auto') {
      expect(secured.plan.resolvedHref).toBe('https://api.openai.com/v1/models');
      expect(secured.plan.interpreterId).toBe('preset:openai/1');
    }
  });

  it('resolves the migrated openrouter target to the full path', () => {
    const state = classifyRecipe(
      {
        provider_id: presetId('openrouter'),
        endpoint: 'https://openrouter.ai/api/v1',
      },
      []
    );
    expect(state.kind).toBe('auto');
    if (state.kind === 'auto') {
      expect(state.plan.resolvedHref).toBe('https://openrouter.ai/api/v1/key');
    }
  });

  it('keeps the azure api-version in the resolved url', () => {
    const state = classifyRecipe(
      {
        provider_id: presetId('azure'),
        endpoint: 'https://example.openai.azure.com',
      },
      []
    );
    expect(state.kind).toBe('auto');
    if (state.kind === 'auto') {
      expect(state.plan.resolvedHref).toContain('api-version=2024-10-21');
    }
  });

  it('treats a key with no provider as not executable', () => {
    const state = classifyRecipe({ provider_id: null, endpoint: null }, []);
    expect(state.kind).toBe('not_executable');
    expect(isExecutable(state)).toBe(false);
  });

  it('absolute targets work without an endpoint', () => {
    const providers = [
      custom({
        probe: {
          target: 'https://other.example/x',
          auth: { mode: 'bearer' },
          headers: [],
        },
      }),
    ];
    const state = classifyRecipe(
      { provider_id: providers[0].id, endpoint: null },
      providers
    );
    expect(state.kind).toBe('auto');
    if (state.kind === 'auto') {
      expect(state.plan.resolvedHref).toBe('https://other.example/x');
    }
  });

  it('counts the state distribution the plan recorded', () => {
    const counts = { auto: 0, manual: 0, missing: 0 };
    for (const preset of PRESETS) {
      const state = classifyRecipe(
        { provider_id: presetId(preset.slug), endpoint: preset.defaultEndpoint },
        []
      );
      if (state.kind === 'auto') counts.auto += 1;
      else if (state.kind === 'manual_only') counts.manual += 1;
      else counts.missing += 1;
    }
    expect(counts).toEqual({ auto: 46, manual: 0, missing: 4 });
  });
});
