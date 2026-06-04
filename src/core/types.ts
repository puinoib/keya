// Core data types for Keya v1.0

export interface ApiKey {
  id: string;
  name: string;
  description: string;
  provider: string;
  endpoint: string;
  key: string;
  group_id: string | null;
  expires_at: string | null;
  last_tested: string | null;
  test_status: 'success' | 'failed' | null;
  test_latency_ms: number | null;
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
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en-US';
  auto_lock_minutes: number;
  auto_test_on_save: boolean;
  custom_providers: CustomProvider[];
  disabled_providers: string[];
}

export interface KeyaDatabase {
  version: '1.0';
  vault_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  icon: string;
  api_keys: ApiKey[];
  groups: Group[];
  settings: Settings;
}

export const DEFAULT_GROUPS: Omit<Group, 'id'>[] = [
  { name: 'Production', icon: '🚀', order: 1 },
  { name: 'Development', icon: '🔧', order: 2 },
];

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'zh-CN',
  auto_lock_minutes: 5,
  auto_test_on_save: false,
  custom_providers: [],
  disabled_providers: [],
};

export const ENDPOINT_DEFAULTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  groq: 'https://api.groq.com/openai/v1',
  deepseek: 'https://api.deepseek.com/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  baidu: 'https://aip.baidubce.com',
  mistral: 'https://api.mistral.ai/v1',
  cohere: 'https://api.cohere.ai',
  together: 'https://api.together.xyz/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  siliconflow: 'https://api.siliconflow.cn/v1',
  azure: 'https://YOUR_RESOURCE.openai.azure.com',
};

export const PRESET_PROVIDERS = [
  "OpenAI", "Anthropic", "Google", "Groq", "DeepSeek", "Moonshot",
  "Zhipu", "Baidu", "Mistral", "Cohere", "Together", "OpenRouter",
  "SiliconFlow", "Azure OpenAI",
] as const;

export function getProvidersForDropdown(settings: Settings | undefined): string[] {
  const disabled = new Set(settings?.disabled_providers ?? []);
  const enabled = PRESET_PROVIDERS.filter((p) => !disabled.has(p));
  const customs = (settings?.custom_providers ?? []).map((cp) => cp.name);
  return [...enabled, ...customs, "Custom"];
}
