import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  PRESET_PROVIDERS,
  getDefaultEndpointForProvider,
  groupProvidersByCategory,
} from '../../../core/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, MagnifyingGlass, Plus, Trash, X } from '@phosphor-icons/react';
import { getProviderLogo } from '@/app/lib/provider-logo';
import { ProviderLogo } from '@/app/components/ui/provider-logo';

const presetEndpoints: Record<(typeof PRESET_PROVIDERS)[number], string> =
  Object.fromEntries(
    PRESET_PROVIDERS.map((name) => [
      name,
      getDefaultEndpointForProvider(name, undefined) ?? '',
    ])
  ) as Record<(typeof PRESET_PROVIDERS)[number], string>;

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-200 ${
        checked ? 'bg-accent' : 'bg-surface-3'
      }`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function ProvidersPage() {
  const { db, updateSettings } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEndpoint, setNewEndpoint] = useState('');
  const [query, setQuery] = useState('');

  const settings = db?.getSettings();
  const disabled = new Set(settings?.disabled_providers ?? []);
  const customs = settings?.custom_providers ?? [];

  const allNames = new Set([
    ...PRESET_PROVIDERS,
    ...customs.map((cp) => cp.name),
  ]);

  const sections = useMemo(() => {
    const presetItems = PRESET_PROVIDERS.map((name) => ({
      name,
      logo: getProviderLogo(name),
      endpoint: presetEndpoints[name],
      isCustom: false,
      isEnabled: !disabled.has(name),
    }));
    const customItems = customs.map((cp) => ({
      name: cp.name,
      logo: undefined as string | undefined,
      endpoint: cp.endpoint,
      isCustom: true,
      isEnabled: !disabled.has(cp.name),
    }));

    // The settings page lists disabled presets too, so group the presets
    // directly instead of using the picker sections that filter by settings.
    const groups = groupProvidersByCategory(PRESET_PROVIDERS).map(
      (section) => ({
        id: section.id,
        label: section.label,
        items: presetItems.filter((item) =>
          section.providers.includes(item.name)
        ),
      })
    );

    return [
      ...groups,
      { id: 'custom' as const, label: 'Custom providers', items: customItems },
    ];
  }, [customs, disabled]);

  const needle = query.trim().toLowerCase();
  const visibleSections = needle
    ? sections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              item.name.toLowerCase().includes(needle) ||
              item.endpoint.toLowerCase().includes(needle)
          ),
        }))
        .filter((section) => section.items.length > 0)
    : sections;

  const toggleProvider = (name: string, enable: boolean) => {
    if (!settings) return;
    const updated = enable
      ? settings.disabled_providers.filter((n: string) => n !== name)
      : [...settings.disabled_providers, name];
    updateSettings({ disabled_providers: updated });
  };

  const addCustom = () => {
    if (!settings) return;
    const name = newName.trim();
    const endpoint = newEndpoint.trim();
    if (!name || !endpoint || allNames.has(name)) return;

    updateSettings({
      custom_providers: [...customs, { name, endpoint }],
      disabled_providers: settings.disabled_providers.filter(
        (providerName: string) => providerName !== name
      ),
    });
    setNewName('');
    setNewEndpoint('');
    setIsAdding(false);
  };

  const removeCustom = (name: string) => {
    if (!settings) return;
    updateSettings({
      custom_providers: customs.filter((cp) => cp.name !== name),
      disabled_providers: settings.disabled_providers.filter(
        (providerName: string) => providerName !== name
      ),
    });
  };

  const duplicateName = allNames.has(newName.trim());

  if (!db || !settings) return null;

  return (
    <>
      <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-2">
        Providers
      </h1>

      <p className="mb-4 text-xs leading-relaxed text-ink-quaternary">
        Preset providers cover common AI services. Add a custom provider for any
        other API, including search, scraping, email, payments, and internal
        endpoints.
      </p>

      <div className="mb-5 flex h-8 items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5">
        <MagnifyingGlass className="size-3.5 shrink-0 text-ink-quaternary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter providers"
          className="h-full w-full bg-transparent text-xs text-ink-primary placeholder:text-ink-quaternary focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="text-ink-quaternary transition-colors hover:text-ink-primary"
            aria-label="Clear filter"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {visibleSections.map((section) => (
        <section key={section.id} className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-quaternary">
            {section.label}
            <span className="text-ink-quaternary/70">
              {section.items.length}
            </span>
          </h2>

          <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
            {section.items.map((provider) => (
              <div
                key={provider.name}
                className="flex items-center justify-between p-3"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  {provider.logo ? (
                    <ProviderLogo provider={provider.name} className="size-4" />
                  ) : (
                    <div className="size-5 shrink-0 rounded bg-surface-3 flex items-center justify-center text-[10px] font-medium text-ink-quaternary">
                      {provider.name[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-medium text-ink-primary">
                        {provider.name}
                      </p>
                      {provider.isCustom && (
                        <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-bright">
                          Custom
                        </span>
                      )}
                    </div>
                    {provider.isCustom && (
                      <p className="mt-0.5 truncate font-mono text-[11px] text-ink-quaternary">
                        {provider.endpoint}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {provider.isCustom && (
                    <button
                      onClick={() => removeCustom(provider.name)}
                      className="text-ink-quaternary transition-colors hover:text-danger"
                    >
                      <Trash className="size-3.5" />
                    </button>
                  )}
                  <Toggle
                    checked={provider.isEnabled}
                    onChange={() =>
                      toggleProvider(provider.name, !provider.isEnabled)
                    }
                  />
                </div>
              </div>
            ))}

            {section.id === 'custom' &&
              !needle &&
              (isAdding ? (
                <div className="p-3 space-y-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Service name"
                    className="h-7 text-xs"
                    autoFocus
                  />
                  <Input
                    value={newEndpoint}
                    onChange={(e) => setNewEndpoint(e.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="h-7 text-xs font-mono"
                  />
                  {duplicateName && newName.trim() && (
                    <p className="text-xs text-danger">
                      Provider name already exists.
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={addCustom}
                      disabled={
                        !newName.trim() || !newEndpoint.trim() || duplicateName
                      }
                    >
                      <Check className="size-3.5" /> Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsAdding(false);
                        setNewName('');
                        setNewEndpoint('');
                      }}
                    >
                      <X className="size-3.5" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex w-full items-center justify-center gap-1.5 p-3 text-xs text-ink-tertiary transition-colors hover:bg-surface-3 hover:text-ink-primary"
                >
                  <Plus className="size-3.5" /> Add Custom Provider
                </button>
              ))}
          </div>
        </section>
      ))}

      {needle && visibleSections.length === 0 && (
        <p className="text-xs text-ink-quaternary">
          No provider matches “{query.trim()}”.
        </p>
      )}
    </>
  );
}
