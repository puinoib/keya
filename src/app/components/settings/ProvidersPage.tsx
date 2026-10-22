import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  PRESET_PROVIDERS,
  getDefaultEndpointForProvider,
  groupProvidersByCategory,
  providerToDraft,
  type ProviderCheckDraft,
  type ProviderDraft,
} from '../../state/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  CaretDown,
  Check,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import {
  describeCustomCheck,
  validateCustomCheck,
} from '@/app/lib/custom-check';
import { getProviderLogo } from '@/app/lib/provider-logo';
import { ProviderLogo } from '@/app/components/ui/provider-logo';

type CheckAuthChoice = 'none' | ProviderCheckDraft['auth'];

const CHECK_AUTH_LABELS: Record<CheckAuthChoice, string> = {
  none: 'Reachability only',
  bearer: 'Bearer token',
  basic: 'Basic auth',
  'x-api-key': 'x-api-key header',
  header: 'Custom header',
  query: 'Query parameter',
};

function buildCheck(
  auth: CheckAuthChoice,
  path: string,
  name: string
): ProviderCheckDraft | undefined {
  if (auth === 'none') return undefined;
  const trimmedPath = path.trim();
  const trimmedName = name.trim();
  const check: ProviderCheckDraft = { auth };
  if (trimmedPath) check.path = trimmedPath;
  if (auth === 'header') check.header_name = trimmedName;
  if (auth === 'query') check.query_param = trimmedName;
  return check;
}

const presetEndpoints: Record<(typeof PRESET_PROVIDERS)[number], string> =
  Object.fromEntries(
    PRESET_PROVIDERS.map((name) => [
      name,
      getDefaultEndpointForProvider(name, []) ?? '',
    ])
  ) as Record<(typeof PRESET_PROVIDERS)[number], string>;

/** Rows shown per section before "Show all"; searching ignores this limit. */
const VISIBLE_PER_SECTION = 6;

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
  const { view, updateSettings } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newEndpoint, setNewEndpoint] = useState('');
  const [checkAuth, setCheckAuth] = useState<CheckAuthChoice>('none');
  const [checkPath, setCheckPath] = useState('');
  const [checkName, setCheckName] = useState('');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  const preferences = view?.preferences;
  const disabled = new Set(preferences?.hidden_presets ?? []);
  const customs: ProviderDraft[] = view
    ? view.file.providers.map(providerToDraft)
    : [];

  const allNames = new Set([
    ...PRESET_PROVIDERS,
    ...customs.map((cp) => cp.name),
  ]);

  const sections = useMemo(() => {
    const presetItems = PRESET_PROVIDERS.map((name) => ({
      name,
      logo: getProviderLogo(name),
      endpoint: presetEndpoints[name],
      check: undefined as ProviderCheckDraft | undefined,
      isCustom: false,
      isEnabled: !disabled.has(name),
    }));
    const customItems = customs.map((cp) => ({
      name: cp.name,
      logo: undefined as string | undefined,
      endpoint: cp.endpoint,
      check: cp.check,
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
    if (!preferences) return;
    const updated = enable
      ? preferences.hidden_presets.filter((entry) => entry !== name)
      : [...preferences.hidden_presets, name];
    updateSettings({ hidden_presets: updated });
  };

  const resetForm = () => {
    setNewName('');
    setNewEndpoint('');
    setCheckAuth('none');
    setCheckPath('');
    setCheckName('');
    setEditingName(null);
    setIsAdding(false);
  };

  const startAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const startEdit = (provider: ProviderDraft) => {
    setEditingName(provider.name);
    setNewName(provider.name);
    setNewEndpoint(provider.endpoint);
    setCheckAuth(provider.check?.auth ?? 'none');
    setCheckPath(provider.check?.path ?? '');
    setCheckName(
      provider.check?.header_name ?? provider.check?.query_param ?? ''
    );
    setIsAdding(true);
  };

  const saveCustom = () => {
    if (!preferences) return;
    const name = newName.trim();
    const endpoint = newEndpoint.trim();
    if (!name || !endpoint) return;
    if (!editingName && allNames.has(name)) return;

    const check = buildCheck(checkAuth, checkPath, checkName);
    if (check && validateCustomCheck(check)) return;

    const editing = editingName
      ? customs.find((cp) => cp.name === editingName)
      : undefined;
    const entry: ProviderDraft = {
      ...(editing?.id ? { id: editing.id } : {}),
      name,
      endpoint,
      ...(check ? { check } : {}),
    };
    const nextCustoms = editing
      ? customs.map((cp) => (cp.id === editing.id ? entry : cp))
      : [...customs, entry];

    updateSettings({
      providers: nextCustoms,
      hidden_presets: preferences.hidden_presets.filter(
        (providerName) => providerName !== name
      ),
    });
    resetForm();
  };

  const removeCustom = (name: string) => {
    if (!preferences) return;
    updateSettings({
      providers: customs.filter((cp) => cp.name !== name),
      hidden_presets: preferences.hidden_presets.filter(
        (providerName) => providerName !== name
      ),
    });
  };

  const duplicateName = !editingName && allNames.has(newName.trim());
  const pendingCheck = buildCheck(checkAuth, checkPath, checkName);
  const pendingCheckError = pendingCheck
    ? validateCustomCheck(pendingCheck)
    : null;

  if (!view || !preferences) return null;

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

      {visibleSections.map((section) => {
        // A filter must never hide matches, so searching ignores both the
        // collapsed state and the per-section preview limit.
        const isCollapsed = !needle && Boolean(collapsed[section.id]);
        const showEveryItem = Boolean(needle) || Boolean(showAll[section.id]);
        const visibleItems = showEveryItem
          ? section.items
          : section.items.slice(0, VISIBLE_PER_SECTION);
        const hiddenCount = section.items.length - visibleItems.length;

        return (
          <section key={section.id} className="mb-6">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => ({
                    ...prev,
                    [section.id]: !prev[section.id],
                  }))
                }
                aria-expanded={!isCollapsed}
                className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-quaternary transition-colors hover:text-ink-secondary"
              >
                <CaretDown
                  className={cn(
                    'size-3 transition-transform',
                    isCollapsed && '-rotate-90'
                  )}
                />
                {section.label}
                <span className="text-ink-quaternary/70">
                  {section.items.length}
                </span>
              </button>
              {!needle &&
                !isCollapsed &&
                (hiddenCount > 0 || showAll[section.id]) && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowAll((prev) => ({
                        ...prev,
                        [section.id]: !prev[section.id],
                      }))
                    }
                    className="text-[11px] text-ink-quaternary transition-colors hover:text-ink-primary"
                  >
                    {showAll[section.id]
                      ? 'Show less'
                      : `Show all ${section.items.length}`}
                  </button>
                )}
            </div>

            {!isCollapsed && visibleItems.length > 0 && (
              <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
                {visibleItems.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      {provider.logo ? (
                        <ProviderLogo
                          provider={provider.name}
                          className="size-4"
                        />
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
                          <>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-ink-quaternary">
                              {provider.endpoint}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-ink-quaternary">
                              {describeCustomCheck(provider.check)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {provider.isCustom && (
                        <>
                          <button
                            onClick={() =>
                              startEdit({
                                name: provider.name,
                                endpoint: provider.endpoint,
                                check: provider.check,
                              })
                            }
                            className="text-ink-quaternary transition-colors hover:text-ink-primary"
                            title="Edit custom provider"
                            aria-label={`Edit ${provider.name}`}
                          >
                            <PencilSimple className="size-3.5" />
                          </button>
                          <button
                            onClick={() => removeCustom(provider.name)}
                            className="text-ink-quaternary transition-colors hover:text-danger"
                            title="Remove custom provider"
                            aria-label={`Remove ${provider.name}`}
                          >
                            <Trash className="size-3.5" />
                          </button>
                        </>
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
              </div>
            )}

            {section.id === 'custom' && !needle && (
              <div className="mt-2 rounded-lg border border-line bg-surface-2">
                {isAdding ? (
                  <div className="p-3 space-y-2">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Service name"
                      className="h-7 text-xs"
                      disabled={!!editingName}
                      autoFocus
                    />
                    <Input
                      value={newEndpoint}
                      onChange={(e) => setNewEndpoint(e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="h-7 text-xs font-mono"
                      disabled={!!editingName}
                    />

                    <div className="space-y-1">
                      <p className="text-[11px] text-ink-quaternary">
                        Credential check
                      </p>
                      <Select
                        value={checkAuth}
                        onValueChange={(value) =>
                          setCheckAuth((value ?? 'none') as CheckAuthChoice)
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <span>{CHECK_AUTH_LABELS[checkAuth]}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.keys(CHECK_AUTH_LABELS) as CheckAuthChoice[]
                          ).map((value) => (
                            <SelectItem key={value} value={value}>
                              {CHECK_AUTH_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {checkAuth !== 'none' && (
                      <>
                        <Input
                          value={checkPath}
                          onChange={(e) => setCheckPath(e.target.value)}
                          placeholder="/v1/models or https://api.example.com/me"
                          className="h-7 text-xs font-mono"
                        />
                        {(checkAuth === 'header' || checkAuth === 'query') && (
                          <Input
                            value={checkName}
                            onChange={(e) => setCheckName(e.target.value)}
                            placeholder={
                              checkAuth === 'header' ? 'x-api-key' : 'api_key'
                            }
                            className="h-7 text-xs font-mono"
                          />
                        )}
                      </>
                    )}

                    <p className="text-[11px] leading-relaxed text-ink-quaternary">
                      Reachability only never sends the key. A credential check
                      sends it the way you configure, so use a cheap metadata
                      endpoint where the service offers one.
                    </p>

                    {duplicateName && newName.trim() && (
                      <p className="text-xs text-danger">
                        Provider name already exists.
                      </p>
                    )}
                    {pendingCheckError && (
                      <p className="text-xs text-danger">{pendingCheckError}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={saveCustom}
                        disabled={
                          !newName.trim() ||
                          !newEndpoint.trim() ||
                          duplicateName ||
                          !!pendingCheckError
                        }
                      >
                        <Check className="size-3.5" />
                        {editingName ? 'Save' : 'Add'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={resetForm}>
                        <X className="size-3.5" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={startAdd}
                    className="flex w-full items-center justify-center gap-1.5 p-3 text-xs text-ink-tertiary transition-colors hover:bg-surface-3 hover:text-ink-primary"
                  >
                    <Plus className="size-3.5" /> Add Custom Provider
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}

      {needle && visibleSections.length === 0 && (
        <p className="text-xs text-ink-quaternary">
          No provider matches “{query.trim()}”.
        </p>
      )}
    </>
  );
}
