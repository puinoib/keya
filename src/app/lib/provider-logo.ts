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
import MiniMaxLogo from '@/assets/providers/minimax.svg';
import AzureLogo from '@/assets/providers/azureai.svg';

const LOGO_MAP: Record<string, string> = {
  OpenAI: OpenAILogo,
  Anthropic: AnthropicLogo,
  Google: GoogleLogo,
  DeepSeek: DeepSeekLogo,
  Moonshot: MoonshotLogo,
  Zhipu: ZhipuLogo,
  Mistral: MistralLogo,
  xAI: GrokLogo,
  MiniMax: MiniMaxLogo,
  'Alibaba Cloud': QwenLogo,
  'Amazon Bedrock': BedrockLogo,
  'Azure OpenAI': AzureLogo,
};

export function getProviderLogo(provider: string): string | undefined {
  return LOGO_MAP[provider];
}
