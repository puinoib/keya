// Core data types for Keya

export type ConnectionStatus = 'success' | 'failed' | 'untested';
export type ExpiryStatus = 'expired' | 'expiring_soon' | 'valid' | 'none';

/**
 * What the last check established. Absent on records written before this field
 * existed; treat those as credential checks.
 */
export type ConnectionCheckKind =
  | 'credential'
  | 'reachability'
  | 'unverifiable';

export interface ConnectionCheck {
  status: ConnectionStatus;
  checked_at: string | null;
  latency_ms: number | null;
  error_message: string | null;
  kind?: ConnectionCheckKind;
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

export interface CustomProviderCheck {
  /** Optional path appended to the provider endpoint, or an absolute URL. */
  path?: string;
  auth: 'bearer' | 'x-api-key' | 'header' | 'query';
  /** Header name when auth is "header". */
  header_name?: string;
  /** Query parameter name when auth is "query". */
  query_param?: string;
}

export interface CustomProvider {
  name: string;
  endpoint: string;
  /** Optional credential check. Without it, Keya only probes reachability. */
  check?: CustomProviderCheck;
}

export interface Settings {
  auto_lock_minutes: number;
  auto_test_on_save: boolean;
  auto_test_daily: boolean;
  clipboard_detection_on_add: boolean;
  custom_providers: CustomProvider[];
  disabled_providers: string[];
}

export type InboxItemType =
  | 'key_expiry_expired'
  | 'key_expiry_upcoming'
  | 'connection_failed'
  | 'never_tested'
  | 'insecure_endpoint'
  | 'stale_test';
export type InboxItemStatus = 'open' | 'archived';
export type InboxArchiveReason = 'user' | 'resolved';

export interface InboxItemMetadata {
  key_name: string;
  provider: string;
  // Expiry-specific
  expires_at?: string;
  days_until_expiry?: number;
  // Connection-specific
  checked_at?: string | null;
  error_message?: string | null;
  // Endpoint-specific
  endpoint?: string;
  // Stale test
  days_since_test?: number;
}

export interface InboxItem {
  id: string;
  type: InboxItemType;
  entity_id: string;
  status: InboxItemStatus;
  archive_reason: InboxArchiveReason | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  metadata: InboxItemMetadata;
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
  azure: 'https://YOUR_RESOURCE.openai.azure.com',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  together: 'https://api.together.xyz/v1',
  cohere: 'https://api.cohere.com',
  siliconflow: 'https://api.siliconflow.cn/v1',
  // OpenAI-compatible bases, chosen so `/models` resolves for connection tests.
  nvidia: 'https://integrate.api.nvidia.com/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  fireworks: 'https://api.fireworks.ai/inference/v1',
  baseten: 'https://inference.baseten.co/v1',
  huggingface: 'https://router.huggingface.co/v1',
  xiaomi: 'https://api.xiaomimimo.com/v1',
  // Z.AI coding plans are keyed separately from the general Zhipu endpoint.
  zai: 'https://api.z.ai/api/coding/paas/v4',
  zai_coding_cn: 'https://open.bigmodel.cn/api/coding/paas/v4',
  moonshot_global: 'https://api.moonshot.ai/v1',
  vercel_ai_gateway: 'https://ai-gateway.vercel.sh/v1',
  perplexity: 'https://api.perplexity.ai/v1',
  featherless: 'https://api.featherless.ai/v1',
  chutes: 'https://llm.chutes.ai/v1',
  hyperbolic: 'https://api.hyperbolic.xyz/v1',
  nebius: 'https://api.studio.nebius.com/v1',
  // DeepInfra serves its OpenAI-compatible surface under /v1/openai.
  deepinfra: 'https://api.deepinfra.com/v1/openai',
  upstage: 'https://api.upstage.ai/v1',
  reka: 'https://api.reka.ai/v1',
  gitee_ai: 'https://ai.gitee.com/v1',
  hunyuan: 'https://api.hunyuan.cloud.tencent.com/v1',
  qianfan: 'https://qianfan.baidubce.com/v2',
  baichuan: 'https://api.baichuan-ai.com/v1',
  stepfun: 'https://api.stepfun.com/v1',
  opencode_zen: 'https://opencode.ai/zen/v1',
  opencode_go: 'https://opencode.ai/zen/go/v1',
  // General Z.AI endpoint, separate from the coding-plan presets above.
  zai_general: 'https://api.z.ai/api/paas/v4',
  // Bases for providers whose key is verified on a different metadata path.
  stability: 'https://api.stability.ai',
  recraft: 'https://external.api.recraft.ai',
  firecrawl: 'https://api.firecrawl.dev',
  github: 'https://api.github.com',
  vercel: 'https://api.vercel.com',
  stripe: 'https://api.stripe.com',
};

/**
 * Maps the display name used in the UI to the ENDPOINT_DEFAULTS key.
 * Keep this list in sync with PRESET_PROVIDERS.
 */
const PROVIDER_ENDPOINT_KEYS: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  deepseek: 'deepseek',
  moonshot: 'moonshot',
  zhipu: 'zhipu',
  mistral: 'mistral',
  xai: 'xai',
  minimax: 'minimax',
  'alibaba cloud': 'alibaba',
  'amazon bedrock': 'amazon_bedrock',
  'azure openai': 'azure',
  groq: 'groq',
  openrouter: 'openrouter',
  together: 'together',
  cohere: 'cohere',
  siliconflow: 'siliconflow',
  'nvidia nim': 'nvidia',
  cerebras: 'cerebras',
  fireworks: 'fireworks',
  baseten: 'baseten',
  'hugging face': 'huggingface',
  'xiaomi mimo': 'xiaomi',
  'z.ai': 'zai',
  'z.ai coding (china)': 'zai_coding_cn',
  'moonshot ai (global)': 'moonshot_global',
  'vercel ai gateway': 'vercel_ai_gateway',
  perplexity: 'perplexity',
  featherless: 'featherless',
  chutes: 'chutes',
  hyperbolic: 'hyperbolic',
  nebius: 'nebius',
  deepinfra: 'deepinfra',
  upstage: 'upstage',
  reka: 'reka',
  'gitee ai': 'gitee_ai',
  'tencent hunyuan': 'hunyuan',
  'baidu qianfan': 'qianfan',
  baichuan: 'baichuan',
  stepfun: 'stepfun',
  'opencode zen': 'opencode_zen',
  'opencode go': 'opencode_go',
  'z.ai (general)': 'zai_general',
  'stability ai': 'stability',
  recraft: 'recraft',
  firecrawl: 'firecrawl',
  github: 'github',
  vercel: 'vercel',
  stripe: 'stripe',
};

export function getDefaultEndpointForProvider(
  provider: string,
  settings: Settings | undefined
): string | undefined {
  const normalizedProvider = provider.trim().toLowerCase();
  const endpointKey = PROVIDER_ENDPOINT_KEYS[normalizedProvider];
  const presetEndpoint = endpointKey
    ? ENDPOINT_DEFAULTS[endpointKey]
    : undefined;

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
  'Azure OpenAI',
  'Groq',
  'OpenRouter',
  'Together',
  'Cohere',
  'SiliconFlow',
  'NVIDIA NIM',
  'Cerebras',
  'Fireworks',
  'Baseten',
  'Hugging Face',
  'Xiaomi MiMo',
  'Z.AI',
  'Z.AI Coding (China)',
  'Moonshot AI (Global)',
  'Vercel AI Gateway',
  'Perplexity',
  'Featherless',
  'Chutes',
  'Hyperbolic',
  'Nebius',
  'DeepInfra',
  'Upstage',
  'Reka',
  'Gitee AI',
  'Tencent Hunyuan',
  'Baidu Qianfan',
  'Baichuan',
  'StepFun',
  'OpenCode Zen',
  'OpenCode Go',
  'Z.AI (General)',
  'Stability AI',
  'Recraft',
  'Firecrawl',
  'GitHub',
  'Vercel',
  'Stripe',
] as const;

export function getProvidersForDropdown(
  settings: Settings | undefined
): string[] {
  return getProviderSections(settings).flatMap((section) => section.providers);
}

/** True when the provider is one of Keya's built-in presets. */
export function isPresetProvider(provider: string): boolean {
  const normalized = provider.trim().toLowerCase();
  return PRESET_PROVIDERS.some((preset) => preset.toLowerCase() === normalized);
}

/** Look up a user-defined provider by name, ignoring case and outer spaces. */
export function getCustomProvider(
  provider: string,
  settings: Settings | undefined
): CustomProvider | undefined {
  const normalized = provider.trim().toLowerCase();
  return settings?.custom_providers?.find(
    (cp) => cp.name.trim().toLowerCase() === normalized
  );
}

/**
 * Groups presets so pickers stay navigable as the list grows. Providers that
 * are not models still live in the same preset list; only presentation differs.
 */
export type ProviderCategory = 'model' | 'media' | 'platform';
export interface ProviderSection {
  id: ProviderCategory | 'custom';
  label: string;
  providers: string[];
}

export const PROVIDER_CATEGORY_LABELS: Record<ProviderCategory, string> = {
  model: 'Models & inference',
  media: 'Image generation',
  platform: 'Developer platforms',
};

const PROVIDER_CATEGORY_ORDER: ProviderCategory[] = [
  'model',
  'media',
  'platform',
];
/** Presets that are not model providers, keyed by lowercased display name. */
const PROVIDER_CATEGORY_BY_NAME: Record<string, ProviderCategory> = {
  'stability ai': 'media',
  recraft: 'media',
  firecrawl: 'platform',
  github: 'platform',
  vercel: 'platform',
  stripe: 'platform',
};

export function getProviderCategory(provider: string): ProviderCategory {
  return PROVIDER_CATEGORY_BY_NAME[provider.trim().toLowerCase()] ?? 'model';
}

/** Group any provider names by category, keeping their existing order. */
export function groupProvidersByCategory(
  providers: readonly string[]
): ProviderSection[] {
  return PROVIDER_CATEGORY_ORDER.map((category) => ({
    id: category,
    label: PROVIDER_CATEGORY_LABELS[category],
    providers: providers.filter(
      (provider) => getProviderCategory(provider) === category
    ),
  })).filter((section) => section.providers.length > 0);
}

/** Enabled presets grouped by category, followed by custom providers. */
export function getProviderSections(
  settings: Settings | undefined
): ProviderSection[] {
  const disabled = new Set(settings?.disabled_providers ?? []);
  const enabled = PRESET_PROVIDERS.filter((p) => !disabled.has(p));
  const customs = (settings?.custom_providers ?? [])
    .filter((cp) => !disabled.has(cp.name))
    .map((cp) => cp.name);

  return [
    ...groupProvidersByCategory(enabled),
    {
      id: 'custom',
      label: 'Custom providers',
      providers: [...customs, 'Custom'],
    },
  ];
}
