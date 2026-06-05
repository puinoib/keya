import {
  getDefaultEndpointForProvider,
  type Settings,
} from '../../core/types';

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

const OPENAI_PROJECT_KEY = /^sk-proj-[A-Za-z0-9_-]{8,}$/;

function unwrapClipboardValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const envMatch = trimmed.match(
    /^(?:export\s+)?[A-Z0-9_]+\s*=\s*['"]?(.+?)['"]?$/
  );
  const unwrapped = envMatch?.[1]?.trim() ?? trimmed;

  if (
    (unwrapped.startsWith('"') && unwrapped.endsWith('"')) ||
    (unwrapped.startsWith("'") && unwrapped.endsWith("'"))
  ) {
    return unwrapped.slice(1, -1).trim();
  }

  return unwrapped;
}

function extractCandidateValues(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => unwrapClipboardValue(line))
    .filter(Boolean);

  if (lines.length === 0) return [];

  const seen = new Set<string>();
  const matches: string[] = [];

  for (const line of lines) {
    const tokens = line.match(/sk-proj-[A-Za-z0-9_-]{8,}/g) ?? [];
    for (const token of tokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      matches.push(token);
    }
  }

  return matches;
}

function maskApiKey(key: string): string {
  if (key.length <= 14) return `${key.slice(0, 6)}...`;
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

function buildSuggestedName(provider: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${provider} · ${stamp}`;
}

function detectProvider(
  value: string,
  settings?: Settings
): ClipboardKeyCandidate | null {
  if (!OPENAI_PROJECT_KEY.test(value)) return null;

  const provider = 'OpenAI';
  const endpoint = getDefaultEndpointForProvider(provider, settings) ?? '';

  return {
    raw: value,
    masked: maskApiKey(value),
    provider,
    draft: {
      name: buildSuggestedName(provider),
      key_value: value,
      provider,
      endpoint,
      description: '',
      group_id: null,
      expires_at: undefined,
    },
  };
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
    const matches = extractCandidateValues(text);
    const latest = matches.at(-1);
    if (!latest) return null;
    return detectProvider(latest, settings);
  } catch {
    return null;
  }
}
