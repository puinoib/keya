import { getDefaultEndpointForProvider, type Settings } from '../../core/types';

export interface AddKeyDraft {
  name: string;
  key_value: string;
  provider: string;
  endpoint: string;
  description: string;
  group_id: string | null;
  expires_at: Date | undefined;
}

export interface ClipboardKeyCandidate {
  raw: string;
  masked: string;
  provider: string;
  draft: AddKeyDraft;
}

interface DetectionRule {
  provider: string;
  explicitEnvNames: string[];
  fallbackEnvNames: string[];
  tokenPatterns: RegExp[];
  endpointHints: RegExp[];
  tokenExtractor?: RegExp;
}

interface ParsedClipboardLine {
  index: number;
  raw: string;
  normalized: string;
  envName: string | null;
  envValue: string | null;
}

interface MatchCandidate {
  provider: string;
  raw: string;
  score: number;
  lineIndex: number;
  tokenIndex: number;
}

const GENERIC_TOKEN = /[A-Za-z0-9._-]{16,}/g;

const DETECTION_RULES: DetectionRule[] = [
  {
    provider: 'OpenAI',
    explicitEnvNames: ['OPENAI_API_KEY'],
    fallbackEnvNames: ['OPENAI_KEY'],
    tokenPatterns: [/^sk-proj-[A-Za-z0-9_-]{8,}$/],
    endpointHints: [/api\.openai\.com/i],
    tokenExtractor: /sk-proj-[A-Za-z0-9_-]{8,}/g,
  },
  {
    provider: 'Anthropic',
    explicitEnvNames: ['ANTHROPIC_API_KEY'],
    fallbackEnvNames: ['CLAUDE_API_KEY'],
    tokenPatterns: [/^sk-ant-[A-Za-z0-9_-]{8,}$/],
    endpointHints: [/api\.anthropic\.com/i],
    tokenExtractor: /sk-ant-[A-Za-z0-9_-]{8,}/g,
  },
  {
    provider: 'Groq',
    explicitEnvNames: ['GROQ_API_KEY'],
    fallbackEnvNames: [],
    tokenPatterns: [/^gsk_[A-Za-z0-9_-]{8,}$/],
    endpointHints: [/api\.groq\.com/i],
    tokenExtractor: /gsk_[A-Za-z0-9_-]{8,}/g,
  },
  {
    provider: 'OpenRouter',
    explicitEnvNames: ['OPENROUTER_API_KEY'],
    fallbackEnvNames: [],
    tokenPatterns: [/^sk-or-v1-[A-Za-z0-9_-]{8,}$/],
    endpointHints: [/openrouter\.ai/i],
    tokenExtractor: /sk-or-v1-[A-Za-z0-9_-]{8,}/g,
  },
  {
    provider: 'DeepSeek',
    explicitEnvNames: ['DEEPSEEK_API_KEY'],
    fallbackEnvNames: [],
    tokenPatterns: [],
    endpointHints: [/api\.deepseek\.com/i],
  },
  {
    provider: 'Together',
    explicitEnvNames: ['TOGETHER_API_KEY'],
    fallbackEnvNames: [],
    tokenPatterns: [],
    endpointHints: [/api\.together\.xyz/i, /together\.ai/i],
  },
  {
    provider: 'Mistral',
    explicitEnvNames: ['MISTRAL_API_KEY'],
    fallbackEnvNames: [],
    tokenPatterns: [],
    endpointHints: [/api\.mistral\.ai/i],
  },
  {
    provider: 'Cohere',
    explicitEnvNames: ['COHERE_API_KEY', 'CO_API_KEY'],
    fallbackEnvNames: [],
    tokenPatterns: [],
    endpointHints: [/api\.cohere\.ai/i],
  },
  {
    provider: 'Moonshot',
    explicitEnvNames: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
    fallbackEnvNames: [],
    tokenPatterns: [],
    endpointHints: [/api\.moonshot\.cn/i, /platform\.kimi\.ai/i],
  },
  {
    provider: 'Zhipu',
    explicitEnvNames: ['ZHIPUAI_API_KEY', 'ZHIPU_API_KEY', 'GLM_API_KEY'],
    fallbackEnvNames: [],
    tokenPatterns: [],
    endpointHints: [/bigmodel\.cn/i, /z\.ai/i],
  },
  {
    provider: 'Google',
    explicitEnvNames: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    fallbackEnvNames: [],
    tokenPatterns: [],
    endpointHints: [/generativelanguage\.googleapis\.com/i, /ai\.google\.dev/i],
  },
  {
    provider: 'Azure OpenAI',
    explicitEnvNames: ['AZURE_OPENAI_API_KEY'],
    fallbackEnvNames: ['AZURE_AI_API_KEY'],
    tokenPatterns: [],
    endpointHints: [/openai\.azure\.com/i, /services\.ai\.azure\.com\/openai/i],
  },
  {
    provider: 'SiliconFlow',
    explicitEnvNames: ['SILICONFLOW_API_KEY', 'SILICONCLOUD_API_KEY'],
    fallbackEnvNames: [],
    tokenPatterns: [],
    endpointHints: [/api\.siliconflow\.cn/i, /siliconflow\.cn/i],
  },
];

function unwrapClipboardValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function parseClipboardLine(raw: string, index: number): ParsedClipboardLine {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      index,
      raw,
      normalized: '',
      envName: null,
      envValue: null,
    };
  }

  const envMatch = trimmed.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.+)$/);
  if (!envMatch) {
    return {
      index,
      raw,
      normalized: unwrapClipboardValue(trimmed),
      envName: null,
      envValue: null,
    };
  }

  const envName = envMatch[1];
  const envValue = unwrapClipboardValue(envMatch[2]);

  return {
    index,
    raw,
    normalized: envValue,
    envName,
    envValue,
  };
}

function maskApiKey(key: string): string {
  if (key.length <= 14) return `${key.slice(0, 6)}...`;
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

function buildSuggestedName(provider: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${provider} · ${stamp}`;
}

function isEndpointLikeEnvName(envName: string | null): boolean {
  if (!envName) return false;
  return /(?:BASE_)?URL|ENDPOINT|HOST/i.test(envName);
}

function getTokensForLine(
  line: ParsedClipboardLine,
  rule: DetectionRule
): string[] {
  if (isEndpointLikeEnvName(line.envName)) return [];

  const source = line.envValue ?? line.normalized;
  if (!source || /^https?:\/\//i.test(source)) return [];

  const extractor = rule.tokenExtractor ?? GENERIC_TOKEN;
  return source.match(extractor) ?? [];
}

function scoreCandidate(
  line: ParsedClipboardLine,
  rule: DetectionRule,
  token: string,
  hasGlobalEndpointHint: boolean
): number {
  let score = 0;

  if (rule.tokenPatterns.some((pattern) => pattern.test(token))) score += 100;
  if (line.envName && rule.explicitEnvNames.includes(line.envName)) score += 60;
  if (line.envName && rule.fallbackEnvNames.includes(line.envName)) score += 45;
  if (rule.endpointHints.some((hint) => hint.test(line.raw))) score += 35;
  if (rule.endpointHints.some((hint) => hint.test(line.normalized)))
    score += 25;
  if (
    hasGlobalEndpointHint &&
    line.envName &&
    /(?:^|_)(API_KEY|TOKEN|ACCESS_TOKEN)$/.test(line.envName)
  ) {
    score += 30;
  }
  if (!line.envName && rule.tokenPatterns.length === 0) score += 0;

  return score;
}

function buildCandidate(
  match: MatchCandidate,
  settings?: Settings
): ClipboardKeyCandidate {
  const endpoint =
    getDefaultEndpointForProvider(match.provider, settings) ?? '';

  return {
    raw: match.raw,
    masked: maskApiKey(match.raw),
    provider: match.provider,
    draft: {
      name: buildSuggestedName(match.provider),
      key_value: match.raw,
      provider: match.provider,
      endpoint,
      description: '',
      group_id: null,
      expires_at: undefined,
    },
  };
}

function detectFromClipboardText(
  text: string,
  settings?: Settings
): ClipboardKeyCandidate | null {
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => parseClipboardLine(line, index))
    .filter((line) => line.normalized);

  if (lines.length === 0) return null;

  const seen = new Set<string>();
  const matches: MatchCandidate[] = [];

  DETECTION_RULES.forEach((rule) => {
    const hasGlobalEndpointHint = lines.some(
      (line) =>
        rule.endpointHints.some((hint) => hint.test(line.raw)) ||
        rule.endpointHints.some((hint) => hint.test(line.normalized))
    );

    for (const line of lines) {
      const tokens = getTokensForLine(line, rule);
      tokens.forEach((token, tokenIndex) => {
        const signature = `${rule.provider}:${token}`;
        if (seen.has(signature)) return;

        const score = scoreCandidate(line, rule, token, hasGlobalEndpointHint);
        if (score <= 0) return;

        seen.add(signature);
        matches.push({
          provider: rule.provider,
          raw: token,
          score,
          lineIndex: line.index,
          tokenIndex,
        });
      });
    }
  });

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
    if (a.tokenIndex !== b.tokenIndex) return a.tokenIndex - b.tokenIndex;
    return a.score - b.score;
  });

  const bestPerPosition = new Map<string, MatchCandidate>();
  for (const match of matches) {
    const key = `${match.lineIndex}:${match.tokenIndex}`;
    const current = bestPerPosition.get(key);
    if (!current || match.score >= current.score) {
      bestPerPosition.set(key, match);
    }
  }

  const resolved = [...bestPerPosition.values()].sort((a, b) => {
    if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
    if (a.tokenIndex !== b.tokenIndex) return a.tokenIndex - b.tokenIndex;
    return a.score - b.score;
  });

  const latest = resolved.at(-1);
  return latest ? buildCandidate(latest, settings) : null;
}

export async function tryDetectClipboardKey(
  settings?: Settings
): Promise<ClipboardKeyCandidate | null> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.readText !== 'function'
  ) {
    return null;
  }

  try {
    const text = await navigator.clipboard.readText();
    return detectFromClipboardText(text, settings);
  } catch {
    return null;
  }
}
