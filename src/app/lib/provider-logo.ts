import AnthropicLogo from '@/assets/providers/anthropic.svg';
import AzureLogo from '@/assets/providers/azureai.svg';
import BasetenLogo from '@/assets/providers/baseten.svg';
import BedrockLogo from '@/assets/providers/bedrock.svg';
import CerebrasLogo from '@/assets/providers/cerebras.svg';
import CohereLogo from '@/assets/providers/cohere.svg';
import DeepSeekLogo from '@/assets/providers/deepseek.svg';
import FireworksLogo from '@/assets/providers/fireworks.svg';
import GoogleLogo from '@/assets/providers/google.svg';
import GrokLogo from '@/assets/providers/grok.svg';
import GroqLogo from '@/assets/providers/groq.svg';
import HuggingFaceLogo from '@/assets/providers/huggingface.svg';
import MiniMaxLogo from '@/assets/providers/minimax.svg';
import MistralLogo from '@/assets/providers/mistral.svg';
import MoonshotLogo from '@/assets/providers/moonshot.svg';
import NvidiaLogo from '@/assets/providers/nvidia.svg';
import OpenAILogo from '@/assets/providers/openai.svg';
import OpenRouterLogo from '@/assets/providers/openrouter.svg';
import QwenLogo from '@/assets/providers/qwen.svg';
import SiliconFlowLogo from '@/assets/providers/siliconflow.svg';
import TogetherLogo from '@/assets/providers/together.svg';
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
  'Baseten',
  'Xiaomi MiMo',
  'Vercel AI Gateway',
]);

export function getProviderLogo(provider: string): string | undefined {
  return LOGO_MAP[provider];
}

export function isMonochromeProviderLogo(provider: string): boolean {
  return MONOCHROME_PROVIDERS.has(provider);
}
