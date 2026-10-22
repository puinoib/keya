/**
 * The provider catalogue as the pickers need it.
 *
 * Presets are data in `core/presets`; this module only adds the presentation
 * the screens need: category sections, default endpoints, and the label/id
 * bridge a stored `provider_id` and a typed name need.
 */

import { findPreset, PRESETS } from '../../core/presets/data';
import type { Provider } from '../../core/payload/types';
import type { Preferences } from '../storage/local/state';

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

export function getProviderCategory(label: string): ProviderCategory {
  return CATEGORY_BY_LABEL.get(label.trim().toLowerCase()) ?? 'model';
}

export function groupProvidersByCategory(
  labels: readonly string[]
): ProviderSection[] {
  return (['model', 'media', 'platform'] as const)
    .map((category) => ({
      id: category,
      label: CATEGORY_LABELS[category],
      providers: labels.filter(
        (label) => getProviderCategory(label) === category
      ),
    }))
    .filter((section) => section.providers.length > 0);
}

export function isPresetProvider(label: string): boolean {
  return PRESETS.some(
    (preset) => preset.label.toLowerCase() === label.trim().toLowerCase()
  );
}

/** The vault's own provider records whose name matches a typed label. */
export function customProviderFor(
  label: string,
  providers: readonly Provider[]
): Provider | undefined {
  const wanted = label.trim().toLowerCase();
  return providers.find(
    (provider) => provider.name.trim().toLowerCase() === wanted
  );
}

export function getDefaultEndpointForProvider(
  label: string,
  providers: readonly Provider[]
): string | undefined {
  const preset = PRESETS.find(
    (entry) => entry.label.toLowerCase() === label.trim().toLowerCase()
  );
  if (preset) return preset.defaultEndpoint ?? undefined;
  return customProviderFor(label, providers)?.default_endpoint ?? undefined;
}

export function getProviderSections(
  preferences: Preferences | undefined,
  providers: readonly Provider[]
): ProviderSection[] {
  const disabled = new Set(preferences?.hidden_presets ?? []);
  const enabled = PRESET_PROVIDERS.filter((label) => !disabled.has(label));
  const customs = providers
    .filter((provider) => !disabled.has(provider.name))
    .map((provider) => provider.name);

  return [
    ...groupProvidersByCategory(enabled),
    {
      id: 'custom',
      label: 'Custom providers',
      providers: [...customs, 'Custom'],
    },
  ];
}

/** Display label for a stored provider reference. */
export function providerLabel(
  providerId: string | null,
  providers: readonly Provider[]
): string {
  if (!providerId) return 'Custom';
  if (providerId.startsWith('preset:')) {
    return findPreset(providerId.slice('preset:'.length))?.label ?? 'Custom';
  }
  return (
    providers.find((provider) => provider.id === providerId)?.name ?? 'Custom'
  );
}

/**
 * Resolve a typed provider label to the stored reference.
 *
 * Presets win over custom providers with the same name, so a label always maps
 * back to the same record it was shown for.
 */
export function providerIdForLabel(
  label: string,
  providers: readonly Provider[]
): string | null {
  const wanted = label.trim().toLowerCase();
  if (!wanted || wanted === 'custom') return null;

  const preset = PRESETS.find((entry) => entry.label.toLowerCase() === wanted);
  if (preset) return `preset:${preset.slug}`;

  return (
    providers.find((provider) => provider.name.trim().toLowerCase() === wanted)
      ?.id ?? null
  );
}
