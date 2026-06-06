import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { ENDPOINT_DEFAULTS, PRESET_PROVIDERS } from '../../../core/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Plus, Trash, X } from '@phosphor-icons/react';

import OpenAILogo from '@/assets/providers/openai.svg';
import AnthropicLogo from '@/assets/providers/anthropic.svg';
import GoogleLogo from '@/assets/providers/google.svg';
import DeepSeekLogo from '@/assets/providers/deepseek.svg';
import MoonshotLogo from '@/assets/providers/moonshot.svg';
import ZhipuLogo from '@/assets/providers/zhipu.svg';
import MistralLogo from '@/assets/providers/mistral.svg';
import GrokLogo from '@/assets/providers/grok.svg';
import QwenLogo from '@/assets/providers/qwen.svg';
import BedrockLogo from '@/assets/providers/bedrock.svg';
import AzureLogo from '@/assets/providers/azureai.svg';

const presetEndpoints: Record<(typeof PRESET_PROVIDERS)[number], string> = {
  OpenAI: ENDPOINT_DEFAULTS.openai,
  Anthropic: ENDPOINT_DEFAULTS.anthropic,
  Google: ENDPOINT_DEFAULTS.google,
  DeepSeek: ENDPOINT_DEFAULTS.deepseek,
  Moonshot: ENDPOINT_DEFAULTS.moonshot,
  Zhipu: ENDPOINT_DEFAULTS.zhipu,
  Mistral: ENDPOINT_DEFAULTS.mistral,
  xAI: ENDPOINT_DEFAULTS.xai,
  MiniMax: ENDPOINT_DEFAULTS.minimax,
  'Alibaba Cloud': ENDPOINT_DEFAULTS.alibaba,
  'Amazon Bedrock': ENDPOINT_DEFAULTS.amazon_bedrock,
  'Azure OpenAI': ENDPOINT_DEFAULTS.azure,
};

const LOGO_MAP: Partial<Record<(typeof PRESET_PROVIDERS)[number], string>> = {
  OpenAI: OpenAILogo,
  Anthropic: AnthropicLogo,
  Google: GoogleLogo,
  DeepSeek: DeepSeekLogo,
  Moonshot: MoonshotLogo,
  Zhipu: ZhipuLogo,
  Mistral: MistralLogo,
  xAI: GrokLogo,
  'Alibaba Cloud': QwenLogo,
  'Amazon Bedrock': BedrockLogo,
  'Azure OpenAI': AzureLogo,
};

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

  const settings = db?.getSettings();
  const disabled = new Set(settings?.disabled_providers ?? []);
  const customs = settings?.custom_providers ?? [];

  const allNames = new Set([
    ...PRESET_PROVIDERS,
    ...customs.map((cp) => cp.name),
  ]);

  const providers = useMemo(() => {
    const presetItems = PRESET_PROVIDERS.map((name) => ({
      name,
      logo: LOGO_MAP[name],
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
    return [...presetItems, ...customItems];
  }, [customs, disabled]);

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
        (providerName: string) => providerName !== name,
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
        (providerName: string) => providerName !== name,
      ),
    });
  };

  const duplicateName = allNames.has(newName.trim());

  if (!db || !settings) return null;

  return (
    <>
      <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-6">
        Providers
      </h1>

      <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
        {providers.map((provider) => (
          <div key={provider.name} className="flex items-center justify-between p-3">
            <div className="min-w-0 flex items-center gap-2.5">
              {provider.logo ? (
                <img src={provider.logo} alt="" className="size-5 shrink-0" />
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
                onChange={() => toggleProvider(provider.name, !provider.isEnabled)}
              />
            </div>
          </div>
        ))}

        {isAdding ? (
          <div className="p-3 space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Provider name"
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
                disabled={!newName.trim() || !newEndpoint.trim() || duplicateName}
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
        )}
      </div>
    </>
  );
}
