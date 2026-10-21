/**
 * Provider catalogue as the pickers need it: labels grouped by category, plus
 * custom providers from the vault.
 */

import { findPreset, PRESETS } from '../../core/presets/data';
import type { Settings } from './types';

export type ProviderCategory = 'model' | 'media' | 'platform';

export interface ProviderSection {
  id: ProviderCategory | 'custom';
  label: string;
  providers: string[];
}

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  model: 'Models & inference',
  media: 'Image generation',
  platform: 'Developer platforms',
};

export const PRESET_PROVIDERS: string[] = PRESETS.map((preset) => preset.label);

const CATEGORY_BY_LABEL = new Map<string, ProviderCategory>(
  PRESETS.map((preset) => [preset.label.toLowerCase(), preset.category])
);

export function getProviderCategory(provider: string): ProviderCategory {
  return CATEGORY_BY_LABEL.get(provider.trim().toLowerCase()) ?? 'model';
}

export function groupProvidersByCategory(
  providers: readonly string[]
): ProviderSection[] {
  return (['model', 'media', 'platform'] as const)
    .map((category) => ({
      id: category,
      label: CATEGORY_LABELS[category],
      providers: providers.filter(
        (provider) => getProviderCategory(provider) === category
      ),
    }))
    .filter((section) => section.providers.length > 0);
}

export function isPresetProvider(name: string): boolean {
  return PRESETS.some(
    (preset) => preset.label.toLowerCase() === name.trim().toLowerCase()
  );
}

export function getCustomProvider(name: string, settings: Settings | undefined) {
  const wanted = name.trim().toLowerCase();
  return settings?.custom_providers?.find(
    (provider) => provider.name.trim().toLowerCase() === wanted
  );
}

export function getDefaultEndpointForProvider(
  provider: string,
  settings: Settings | undefined
): string | undefined {
  const preset = PRESETS.find(
    (entry) => entry.label.toLowerCase() === provider.trim().toLowerCase()
  );
  if (preset) return preset.defaultEndpoint ?? undefined;
  return getCustomProvider(provider, settings)?.endpoint;
}

export function getProviderSections(
  settings: Settings | undefined
): ProviderSection[] {
  const disabled = new Set(settings?.disabled_providers ?? []);
  const enabled = PRESET_PROVIDERS.filter((name) => !disabled.has(name));
  const customs = (settings?.custom_providers ?? [])
    .filter((provider) => !disabled.has(provider.name))
    .map((provider) => provider.name);

  return [
    ...groupProvidersByCategory(enabled),
    { id: 'custom', label: 'Custom providers', providers: [...customs, 'Custom'] },
  ];
}

/** Display label for a stored provider reference. */
export function providerLabel(
  providerId: string | null,
  customProviders: readonly { id: string; name: string }[]
): string {
  if (!providerId) return 'Custom';
  if (providerId.startsWith('preset:')) {
    return findPreset(providerId.slice('preset:'.length))?.label ?? 'Custom';
  }
  return (
    customProviders.find((provider) => provider.id === providerId)?.name ??
    'Custom'
  );
}

/**
 * Resolve a typed provider label to the stored reference.
 *
 * Presets win over custom providers with the same name, which matches how the
 * single-string field behaved before providers had ids.
 */
export function providerIdForLabel(
  label: string,
  customProviders: readonly { id: string; name: string }[]
): string | null {
  const wanted = label.trim().toLowerCase();
  if (!wanted || wanted === 'custom') return null;

  const preset = PRESETS.find(
    (entry) => entry.label.toLowerCase() === wanted
  );
  if (preset) return `preset:${preset.slug}`;

  return (
    customProviders.find(
      (provider) => provider.name.trim().toLowerCase() === wanted
    )?.id ?? null
  );
}
