// Core data types for Keya v1.0

export interface ApiKey {
  id: string;
  name: string;
  description: string;
  provider: string;
  service: string;
  endpoint: string;
  key: string;
  status: 'active' | 'inactive' | 'expired';
  group_id: string | null;
  notes: string;
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
  color: string;
  order: number;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en-US';
  auto_lock_minutes: number;
  min_password_length: number;
}

export interface KeyaDatabase {
  version: '1.0';
  vault_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  api_keys: ApiKey[];
  groups: Group[];
  settings: Settings;
}

export const DEFAULT_GROUPS: Omit<Group, 'id'>[] = [
  { name: '生产环境', icon: '🚀', color: '#3B82F6', order: 1 },
  { name: '个人项目', icon: '👤', color: '#10B981', order: 2 },
  { name: '公司项目', icon: '🏢', color: '#8B5CF6', order: 3 },
];

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'zh-CN',
  auto_lock_minutes: 5,
  min_password_length: 8,
};

export const ENDPOINT_DEFAULTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  cohere: 'https://api.cohere.ai',
  groq: 'https://api.groq.com',
  together: 'https://api.together.xyz',
  deepseek: 'https://api.deepseek.com',
};
