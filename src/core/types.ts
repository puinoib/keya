// Core data types for Keya

export type ConnectionStatus = 'success' | 'failed' | 'untested';
export type ExpiryStatus = 'expired' | 'expiring_soon' | 'valid' | 'none';

export interface ConnectionCheck {
  status: ConnectionStatus;
  checked_at: string | null;
  latency_ms: number | null;
  error_message: string | null;
}

export interface ApiKey {
  id: string;
  name: string;
  description: string;
  provider: string;
  endpoint: string;
  key: string;
  group_id: string | null;
  expires_at: string | null;
  connection_check: ConnectionCheck;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  icon: string;
  order: number;
}

export interface CustomProvider {
  name: string;
  endpoint: string;
}

export interface Settings {
  auto_lock_minutes: number;
  auto_test_on_save: boolean;
  auto_test_daily: boolean;
  clipboard_detection_on_add: boolean;
  custom_providers: CustomProvider[];
  disabled_providers: string[];
}

export type InboxItemType = 'key_expiry_upcoming' | 'key_expiry_expired';
export type InboxItemStatus = 'open' | 'archived';
export type InboxArchiveReason = 'user' | 'resolved';

export interface InboxItem {
  id: string;
  type: InboxItemType;
  entity_id: string;
  status: InboxItemStatus;
  archive_reason: InboxArchiveReason | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  metadata: {
    key_name: string;
    provider: string;
    expires_at: string;
    days_until_expiry: number;
  };
}

export interface KeyaDatabase {
  vault_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  icon: string;
  api_keys: ApiKey[];
  groups: Group[];
  settings: Settings;
  inbox: InboxItem[];
}

export const DEFAULT_GROUPS: Omit<Group, 'id'>[] = [
  { name: 'Production', icon: '🚀', order: 1 },
  { name: 'Development', icon: '🔧', order: 2 },
];

export const DEFAULT_SETTINGS: Settings = {
  auto_lock_minutes: 5,
  auto_test_on_save: false,
  auto_test_daily: false,
  clipboard_detection_on_add: true,
  custom_providers: [],
  disabled_providers: [],
};

export const EXPIRY_REMINDER_DAYS = 7;

export const ENDPOINT_DEFAULTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  mistral: 'https://api.mistral.ai/v1',
  xai: 'https://api.x.ai/v1',
  minimax: 'https://api.minimax.chat/v1',
  alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  amazon_bedrock: 'https://bedrock-runtime.us-east-1.amazonaws.com',
  siliconflow: 'https://api.siliconflow.cn/v1',
  azure: 'https://YOUR_RESOURCE.openai.azure.com',
};

export function getDefaultEndpointForProvider(
  provider: string,
  settings: Settings | undefined
): string | undefined {
  const normalizedProvider = provider.toLowerCase();
  const presetEndpoint =
    ENDPOINT_DEFAULTS[normalizedProvider] ??
    (normalizedProvider === 'azure openai'
      ? ENDPOINT_DEFAULTS.azure
      : undefined);

  return (
    presetEndpoint ??
    settings?.custom_providers?.find((cp) => cp.name === provider)?.endpoint
  );
}

export const PRESET_PROVIDERS = [
  'OpenAI',
  'Anthropic',
  'Google',
  'DeepSeek',
  'Moonshot',
  'Zhipu',
  'Mistral',
  'xAI',
  'MiniMax',
  'Alibaba Cloud',
  'Amazon Bedrock',
  'SiliconFlow',
  'Azure OpenAI',
] as const;

export function getProvidersForDropdown(
  settings: Settings | undefined
): string[] {
  const disabled = new Set(settings?.disabled_providers ?? []);
  const enabled = PRESET_PROVIDERS.filter((p) => !disabled.has(p));
  const customs = (settings?.custom_providers ?? [])
    .filter((cp) => !disabled.has(cp.name))
    .map((cp) => cp.name);
  return [...enabled, ...customs, 'Custom'];
}
