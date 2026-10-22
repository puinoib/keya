/**
 * Preset providers: the application-side half of the provider model.
 *
 * Presets are data, not branches: their send recipe is what `send_fingerprint`
 * is computed from, so editing a target or a header here invalidates existing
 * grants exactly like editing a custom provider would.
 *
 * Three constraints shape the table: a target never starts with `/` (that would
 * make it root-relative), Azure keeps its `api-version` in the target query, and
 * Anthropic carries its two protocol headers as static headers.
 *
 * `verifies` records what a successful probe is allowed to claim:
 * - `credential`: the endpoint requires the credential, so 2xx means accepted;
 * - `request`: a public or CORS-visible endpoint only proves the request passed.
 * Moving a preset from `request` to `credential` needs evidence per provider.
 */

import type { ProbeAuth, StaticHeader } from '../payload/types';

export type PresetCategory = 'model' | 'media' | 'platform';

export interface PresetProbe {
  target: string;
  auth: ProbeAuth;
  headers: StaticHeader[];
}

export interface Preset {
  /** Frozen on publication; never renamed. */
  slug: string;
  label: string;
  category: PresetCategory;
  defaultEndpoint: string | null;
  /** `null` means this provider cannot be probed from the browser. */
  probe: PresetProbe | null;
  /** Why probing is impossible, when it is. */
  unverifiable: string | null;
  verifies: 'credential' | 'request';
}

export const PRESETS: readonly Preset[] = [
  {
    slug: 'openai',
    label: 'OpenAI',
    category: 'model',
    defaultEndpoint: 'https://api.openai.com/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'anthropic',
    label: 'Anthropic',
    category: 'model',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    probe: {
      target: 'models',
      auth: { mode: 'header', name: 'x-api-key' },
      headers: [
        { name: 'anthropic-version', value: '2023-06-01' },
        { name: 'anthropic-dangerous-direct-browser-access', value: 'true' },
      ],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'google',
    label: 'Google',
    category: 'model',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    probe: {
      target: 'models',
      auth: { mode: 'query', param: 'key' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'deepseek',
    label: 'DeepSeek',
    category: 'model',
    defaultEndpoint: 'https://api.deepseek.com/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'moonshot',
    label: 'Moonshot',
    category: 'model',
    defaultEndpoint: 'https://api.moonshot.cn/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'zhipu',
    label: 'Zhipu',
    category: 'model',
    defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'mistral',
    label: 'Mistral',
    category: 'model',
    defaultEndpoint: 'https://api.mistral.ai/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'xai',
    label: 'xAI',
    category: 'model',
    defaultEndpoint: 'https://api.x.ai/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'minimax',
    label: 'MiniMax',
    category: 'model',
    defaultEndpoint: 'https://api.minimax.chat/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'alibaba',
    label: 'Alibaba Cloud',
    category: 'model',
    defaultEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'amazon-bedrock',
    label: 'Amazon Bedrock',
    category: 'model',
    defaultEndpoint: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    probe: null,
    unverifiable:
      'Amazon Bedrock uses AWS request signing and cannot be tested from the browser.',
    verifies: 'request',
  },
  {
    slug: 'azure',
    label: 'Azure OpenAI',
    category: 'model',
    defaultEndpoint: 'https://YOUR_RESOURCE.openai.azure.com',
    probe: {
      target: 'openai/models?api-version=2024-10-21',
      auth: { mode: 'header', name: 'api-key' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'groq',
    label: 'Groq',
    category: 'model',
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'openrouter',
    label: 'OpenRouter',
    category: 'model',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    probe: {
      target: 'key',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'together',
    label: 'Together',
    category: 'model',
    defaultEndpoint: 'https://api.together.xyz/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'cohere',
    label: 'Cohere',
    category: 'model',
    defaultEndpoint: 'https://api.cohere.com',
    probe: {
      target: 'v1/models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'siliconflow',
    label: 'SiliconFlow',
    category: 'model',
    defaultEndpoint: 'https://api.siliconflow.cn/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'nvidia',
    label: 'NVIDIA NIM',
    category: 'model',
    defaultEndpoint: 'https://integrate.api.nvidia.com/v1',
    probe: null,
    unverifiable:
      'NVIDIA NIM lists models without authentication and sends no CORS headers, so a key cannot be verified from the browser.',
    verifies: 'request',
  },
  {
    slug: 'cerebras',
    label: 'Cerebras',
    category: 'model',
    defaultEndpoint: 'https://api.cerebras.ai/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'fireworks',
    label: 'Fireworks',
    category: 'model',
    defaultEndpoint: 'https://api.fireworks.ai/inference/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'baseten',
    label: 'Baseten',
    category: 'model',
    defaultEndpoint: 'https://inference.baseten.co/v1',
    probe: null,
    unverifiable:
      'Baseten sends no CORS headers, so the browser blocks the request before the key is checked.',
    verifies: 'request',
  },
  {
    slug: 'huggingface',
    label: 'Hugging Face',
    category: 'model',
    defaultEndpoint: 'https://router.huggingface.co/v1',
    probe: {
      target: 'https://huggingface.co/api/whoami-v2',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'xiaomi',
    label: 'Xiaomi MiMo',
    category: 'model',
    defaultEndpoint: 'https://api.xiaomimimo.com/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'zai',
    label: 'Z.AI',
    category: 'model',
    defaultEndpoint: 'https://api.z.ai/api/coding/paas/v4',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'zai-coding-cn',
    label: 'Z.AI Coding (China)',
    category: 'model',
    defaultEndpoint: 'https://open.bigmodel.cn/api/coding/paas/v4',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'moonshot-global',
    label: 'Moonshot AI (Global)',
    category: 'model',
    defaultEndpoint: 'https://api.moonshot.ai/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'vercel-ai-gateway',
    label: 'Vercel AI Gateway',
    category: 'model',
    defaultEndpoint: 'https://ai-gateway.vercel.sh/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'perplexity',
    label: 'Perplexity',
    category: 'model',
    defaultEndpoint: 'https://api.perplexity.ai/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'featherless',
    label: 'Featherless',
    category: 'model',
    defaultEndpoint: 'https://api.featherless.ai/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'chutes',
    label: 'Chutes',
    category: 'model',
    defaultEndpoint: 'https://llm.chutes.ai/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'hyperbolic',
    label: 'Hyperbolic',
    category: 'model',
    defaultEndpoint: 'https://api.hyperbolic.xyz/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'nebius',
    label: 'Nebius',
    category: 'model',
    defaultEndpoint: 'https://api.studio.nebius.com/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'deepinfra',
    label: 'DeepInfra',
    category: 'model',
    defaultEndpoint: 'https://api.deepinfra.com/v1/openai',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'upstage',
    label: 'Upstage',
    category: 'model',
    defaultEndpoint: 'https://api.upstage.ai/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'reka',
    label: 'Reka',
    category: 'model',
    defaultEndpoint: 'https://api.reka.ai/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'gitee-ai',
    label: 'Gitee AI',
    category: 'model',
    defaultEndpoint: 'https://ai.gitee.com/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'hunyuan',
    label: 'Tencent Hunyuan',
    category: 'model',
    defaultEndpoint: 'https://api.hunyuan.cloud.tencent.com/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'qianfan',
    label: 'Baidu Qianfan',
    category: 'model',
    defaultEndpoint: 'https://qianfan.baidubce.com/v2',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'baichuan',
    label: 'Baichuan',
    category: 'model',
    defaultEndpoint: 'https://api.baichuan-ai.com/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'stepfun',
    label: 'StepFun',
    category: 'model',
    defaultEndpoint: 'https://api.stepfun.com/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'opencode-zen',
    label: 'OpenCode Zen',
    category: 'model',
    defaultEndpoint: 'https://opencode.ai/zen/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'opencode-go',
    label: 'OpenCode Go',
    category: 'model',
    defaultEndpoint: 'https://opencode.ai/zen/go/v1',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'zai-general',
    label: 'Z.AI (General)',
    category: 'model',
    defaultEndpoint: 'https://api.z.ai/api/paas/v4',
    probe: {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'request',
  },
  {
    slug: 'stability',
    label: 'Stability AI',
    category: 'media',
    defaultEndpoint: 'https://api.stability.ai',
    probe: {
      target: 'v1/user/account',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'recraft',
    label: 'Recraft',
    category: 'media',
    defaultEndpoint: 'https://external.api.recraft.ai',
    probe: {
      target: 'v1/users/me',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'exa',
    label: 'Exa',
    category: 'platform',
    defaultEndpoint: 'https://api.exa.ai',
    probe: null,
    unverifiable:
      'Exa sends no CORS headers, so the browser cannot read the response. The key is not verified, and this is not proof that it is invalid.',
    verifies: 'request',
  },
  {
    slug: 'firecrawl',
    label: 'Firecrawl',
    category: 'platform',
    defaultEndpoint: 'https://api.firecrawl.dev',
    probe: {
      target: 'v1/team/credit-usage',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'github',
    label: 'GitHub',
    category: 'platform',
    defaultEndpoint: 'https://api.github.com',
    probe: {
      target: 'user',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'vercel',
    label: 'Vercel',
    category: 'platform',
    defaultEndpoint: 'https://api.vercel.com',
    probe: {
      target: 'v2/user',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
  {
    slug: 'stripe',
    label: 'Stripe',
    category: 'platform',
    defaultEndpoint: 'https://api.stripe.com',
    probe: {
      target: 'v1/balance',
      auth: { mode: 'bearer' },
      headers: [],
    },
    unverifiable: null,
    verifies: 'credential',
  },
];

const BY_SLUG = new Map(PRESETS.map((preset) => [preset.slug, preset]));

export function findPreset(slug: string): Preset | undefined {
  return BY_SLUG.get(slug);
}

export function presetId(slug: string): string {
  return `preset:${slug}`;
}

/** Interpreter version scoped to one preset (§9.4). */
export function presetInterpreterId(slug: string): string {
  return `preset:${slug}/1`;
}

export const CUSTOM_INTERPRETER_ID = 'custom/1';
