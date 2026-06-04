import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { ENDPOINT_DEFAULTS, PRESET_PROVIDERS } from '../../../core/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react';

type ProviderItem = {
  name: string;
  endpoint?: string;
  isCustom: boolean;
  isEnabled: boolean;
};

const presetEndpoints: Record<(typeof PRESET_PROVIDERS)[number], string> = {
  OpenAI: ENDPOINT_DEFAULTS.openai,
  Anthropic: ENDPOINT_DEFAULTS.anthropic,
  Google: ENDPOINT_DEFAULTS.google,
  Groq: ENDPOINT_DEFAULTS.groq,
  DeepSeek: ENDPOINT_DEFAULTS.deepseek,
  Moonshot: ENDPOINT_DEFAULTS.moonshot,
  Zhipu: ENDPOINT_DEFAULTS.zhipu,
  Baidu: ENDPOINT_DEFAULTS.baidu,
  Mistral: ENDPOINT_DEFAULTS.mistral,
  Cohere: ENDPOINT_DEFAULTS.cohere,
  Together: ENDPOINT_DEFAULTS.together,
  OpenRouter: ENDPOINT_DEFAULTS.openrouter,
  SiliconFlow: ENDPOINT_DEFAULTS.siliconflow,
  'Azure OpenAI': ENDPOINT_DEFAULTS.azure,
};

function ProviderCard({
  provider,
  actionLabel,
  actionIcon,
  onAction,
  onRemove,
}: {
  provider: ProviderItem;
  actionLabel: string;
  actionIcon: React.ReactNode;
  onAction: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-ink-primary">
              {provider.name}
            </p>
            {provider.isCustom && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent-bright">
                Custom
              </span>
            )}
          </div>
          <p className="mt-1 truncate font-mono text-xs text-ink-quaternary">
            {provider.endpoint}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAction}
            className="h-8 gap-1.5 text-xs"
          >
            {actionIcon}
            {actionLabel}
          </Button>
          {onRemove && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onRemove}
              className="size-8 text-ink-quaternary hover:text-danger"
              aria-label={`Delete ${provider.name}`}
            >
              <Trash className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ManageProvidersDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { db, updateSettings } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEndpoint, setNewEndpoint] = useState('');

  if (!db) return null;
  const settings = db.getSettings();
  const disabled = new Set(settings.disabled_providers ?? []);
  const customs = settings.custom_providers ?? [];

  const allNames = new Set([
    ...PRESET_PROVIDERS,
    ...customs.map((cp) => cp.name),
  ]);

  const providers = useMemo<ProviderItem[]>(() => {
    const presetItems: ProviderItem[] = PRESET_PROVIDERS.map((name) => ({
      name,
      endpoint: presetEndpoints[name],
      isCustom: false,
      isEnabled: !disabled.has(name),
    }));
    const customItems: ProviderItem[] = customs.map((cp) => ({
      name: cp.name,
      endpoint: cp.endpoint,
      isCustom: true,
      isEnabled: !disabled.has(cp.name),
    }));
    return [...presetItems, ...customItems];
  }, [customs, disabled]);

  const enabledProviders = providers.filter((provider) => provider.isEnabled);
  const disabledProviders = providers.filter((provider) => !provider.isEnabled);

  const toggleProvider = (name: string, enable: boolean) => {
    const updated = enable
      ? settings.disabled_providers.filter((n: string) => n !== name)
      : [...settings.disabled_providers, name];
    updateSettings({ disabled_providers: updated });
  };

  const addCustom = () => {
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
    updateSettings({
      custom_providers: customs.filter((cp) => cp.name !== name),
      disabled_providers: settings.disabled_providers.filter(
        (providerName: string) => providerName !== name
      ),
    });
  };

  const duplicateName = allNames.has(newName.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-line px-6 py-5">
          <DialogTitle>Manage Providers</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-2">
          <section className="flex min-h-0 flex-col border-b border-line md:border-b-0 md:border-r">
            <div className="flex items-center justify-between px-6 py-4">
              <h3 className="text-sm font-medium text-ink-primary">Disabled</h3>
              <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs text-ink-secondary">
                {disabledProviders.length}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <div className="space-y-3">
                {disabledProviders.length > 0 ? (
                  disabledProviders.map((provider) => (
                    <ProviderCard
                      key={provider.name}
                      provider={provider}
                      actionLabel="Enable"
                      actionIcon={<ArrowRight className="size-4" />}
                      onAction={() => toggleProvider(provider.name, true)}
                      onRemove={
                        provider.isCustom
                          ? () => removeCustom(provider.name)
                          : undefined
                      }
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-line bg-surface-2 px-4 py-8 text-center text-sm text-ink-quaternary">
                    All providers are enabled.
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-line px-6 py-4">
              {isAdding ? (
                <div className="space-y-3 rounded-lg border border-accent/30 bg-surface-2 p-4">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Provider name"
                    autoFocus
                  />
                  <Input
                    value={newEndpoint}
                    onChange={(e) => setNewEndpoint(e.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="font-mono text-xs"
                  />
                  {duplicateName && newName.trim() ? (
                    <p className="text-xs text-danger">
                      Provider name already exists.
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={addCustom}
                      disabled={
                        !newName.trim() || !newEndpoint.trim() || duplicateName
                      }
                    >
                      <Check className="size-3.5" />
                      Add Custom Provider
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsAdding(false);
                        setNewName('');
                        setNewEndpoint('');
                      }}
                    >
                      <X className="size-3.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => setIsAdding(true)}
                >
                  <Plus className="size-4" />
                  Add Custom Provider
                </Button>
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between px-6 py-4">
              <h3 className="text-sm font-medium text-ink-primary">Enabled</h3>
              <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs text-ink-secondary">
                {enabledProviders.length}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <div className="space-y-3">
                {enabledProviders.map((provider) => (
                  <ProviderCard
                    key={provider.name}
                    provider={provider}
                    actionLabel="Disable"
                    actionIcon={<ArrowLeft className="size-4" />}
                    onAction={() => toggleProvider(provider.name, false)}
                    onRemove={
                      provider.isCustom
                        ? () => removeCustom(provider.name)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
