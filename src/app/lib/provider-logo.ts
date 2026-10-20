import AnthropicLogo from '@/assets/providers/anthropic.svg';
import AzureLogo from '@/assets/providers/azureai.svg';
import BasetenLogo from '@/assets/providers/baseten.svg';
import BedrockLogo from '@/assets/providers/bedrock.svg';
import BaichuanLogo from '@/assets/providers/baichuan.svg';
import CerebrasLogo from '@/assets/providers/cerebras.svg';
import ChutesLogo from '@/assets/providers/chutes.svg';
import CohereLogo from '@/assets/providers/cohere.svg';
import DeepInfraLogo from '@/assets/providers/deepinfra.svg';
import DeepSeekLogo from '@/assets/providers/deepseek.svg';
import ExaLogo from '@/assets/providers/exa.svg';
import FeatherlessLogo from '@/assets/providers/featherless.svg';
import FirecrawlLogo from '@/assets/providers/firecrawl.svg';
import FireworksLogo from '@/assets/providers/fireworks.svg';
import GitHubLogo from '@/assets/providers/github.svg';
import GiteeLogo from '@/assets/providers/gitee.svg';
import GoogleLogo from '@/assets/providers/google.svg';
import GrokLogo from '@/assets/providers/grok.svg';
import GroqLogo from '@/assets/providers/groq.svg';
import HuggingFaceLogo from '@/assets/providers/huggingface.svg';
import HunyuanLogo from '@/assets/providers/hunyuan.svg';
import HyperbolicLogo from '@/assets/providers/hyperbolic.svg';
import MiniMaxLogo from '@/assets/providers/minimax.svg';
import MistralLogo from '@/assets/providers/mistral.svg';
import MoonshotLogo from '@/assets/providers/moonshot.svg';
import NebiusLogo from '@/assets/providers/nebius.svg';
import NvidiaLogo from '@/assets/providers/nvidia.svg';
import OpenAILogo from '@/assets/providers/openai.svg';
import OpenCodeLogo from '@/assets/providers/opencode.svg';
import OpenRouterLogo from '@/assets/providers/openrouter.svg';
import PerplexityLogo from '@/assets/providers/perplexity.svg';
import QwenLogo from '@/assets/providers/qwen.svg';
import RecraftLogo from '@/assets/providers/recraft.svg';
import RekaLogo from '@/assets/providers/reka.svg';
import SiliconFlowLogo from '@/assets/providers/siliconflow.svg';
import StabilityLogo from '@/assets/providers/stability.svg';
import StepFunLogo from '@/assets/providers/stepfun.svg';
import StripeLogo from '@/assets/providers/stripe.svg';
import TogetherLogo from '@/assets/providers/together.svg';
import UpstageLogo from '@/assets/providers/upstage.svg';
import VercelLogo from '@/assets/providers/vercel.svg';
import XiaomiLogo from '@/assets/providers/xiaomi.svg';
import ZaiLogo from '@/assets/providers/zai.svg';
import ZhipuLogo from '@/assets/providers/zhipu.svg';

const LOGO_MAP: Record<string, string> = {
  OpenAI: OpenAILogo,
  Anthropic: AnthropicLogo,
  Google: GoogleLogo,
  DeepSeek: DeepSeekLogo,
  Moonshot: MoonshotLogo,
  'Moonshot AI (Global)': MoonshotLogo,
  Zhipu: ZhipuLogo,
  'Z.AI': ZaiLogo,
  'Z.AI Coding (China)': ZaiLogo,
  'Z.AI (General)': ZaiLogo,
  Mistral: MistralLogo,
  xAI: GrokLogo,
  MiniMax: MiniMaxLogo,
  'Alibaba Cloud': QwenLogo,
  'Amazon Bedrock': BedrockLogo,
  'Azure OpenAI': AzureLogo,
  Groq: GroqLogo,
  OpenRouter: OpenRouterLogo,
  Together: TogetherLogo,
  Cohere: CohereLogo,
  SiliconFlow: SiliconFlowLogo,
  'NVIDIA NIM': NvidiaLogo,
  Cerebras: CerebrasLogo,
  Fireworks: FireworksLogo,
  Baseten: BasetenLogo,
  'Hugging Face': HuggingFaceLogo,
  'Xiaomi MiMo': XiaomiLogo,
  'Vercel AI Gateway': VercelLogo,
  Vercel: VercelLogo,
  Exa: ExaLogo,
  Perplexity: PerplexityLogo,
  Featherless: FeatherlessLogo,
  Chutes: ChutesLogo,
  Hyperbolic: HyperbolicLogo,
  Nebius: NebiusLogo,
  DeepInfra: DeepInfraLogo,
  Upstage: UpstageLogo,
  Reka: RekaLogo,
  'Gitee AI': GiteeLogo,
  'Tencent Hunyuan': HunyuanLogo,
  Baichuan: BaichuanLogo,
  StepFun: StepFunLogo,
  'OpenCode Zen': OpenCodeLogo,
  'OpenCode Go': OpenCodeLogo,
  'Stability AI': StabilityLogo,
  Recraft: RecraftLogo,
  Firecrawl: FirecrawlLogo,
  GitHub: GitHubLogo,
  Stripe: StripeLogo,
};

/**
 * Marks drawn entirely with `fill="currentColor"` or a plain black path.
 * Inside an `<img>` that resolves to black, so the dark theme inverts them in
 * CSS (`src/index.css`) instead of only flashing on the light theme.
 */
const MONOCHROME_PROVIDERS = new Set([
  'OpenAI',
  'Anthropic',
  'xAI',
  'Moonshot',
  'Moonshot AI (Global)',
  'Z.AI',
  'Z.AI Coding (China)',
  'Z.AI (General)',
  'Baseten',
  'Xiaomi MiMo',
  'Vercel AI Gateway',
  'Vercel',
  'GitHub',
  'OpenCode Zen',
  'OpenCode Go',
  'StepFun',
  'Reka',
  'Upstage',
  'Nebius',
  'Chutes',
  'Recraft',
]);

export function getProviderLogo(provider: string): string | undefined {
  return LOGO_MAP[provider];
}

export function isMonochromeProviderLogo(provider: string): boolean {
  return MONOCHROME_PROVIDERS.has(provider);
}
