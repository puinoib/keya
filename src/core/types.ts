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
  category_id: string | null;
  tag_ids: string[];
  notes: string;
  last_tested: string | null;
  test_status: 'success' | 'failed' | null;
  test_latency_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en-US';
  auto_lock_minutes: number;
  min_password_length: number;
}

export interface KeyaDatabase {
  version: '1.0';
  file_id: string;
  created_at: string;
  updated_at: string;
  api_keys: ApiKey[];
  categories: Category[];
  tags: Tag[];
  settings: Settings;
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'AI 模型', icon: '🤖', color: '#3B82F6', order: 1 },
  { name: '云服务', icon: '☁️', color: '#10B981', order: 2 },
  { name: '其他', icon: '📦', color: '#8B5CF6', order: 3 },
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
