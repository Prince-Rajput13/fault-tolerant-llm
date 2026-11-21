export type ResolutionSource = 'LIVE_INFERENCE' | 'LLM_CACHE';

export interface ChatMetadata {
  resolution_source: ResolutionSource;
  model: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  key_id: string | null;
  fallback_attempts: number;
}

export interface ChatResponse {
  session_id: string;
  reply: string;
  metadata: ChatMetadata;
}

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  metadata?: ChatMetadata;
  statusCode?: number;
  createdAt?: string;
}

export type SimulationMode = '' | 'key_1=429' | 'key_1=429,key_2=500' | '*=429';

export interface HealthStatus {
  status: string;
  keys_configured: number;
  cache_enabled: boolean;
}
