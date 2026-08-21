/**
 * AIProvider Interface — The contract every provider adapter must implement.
 * This is the single source of truth for the provider abstraction layer.
 */

export interface AIProvider {
  id: string;
  name: string;
  generate: (
    apiKey: string,
    model: string,
    systemInstruction: string,
    history: ConversationTurn[],
    prompt: string,
    temperature: number,
    maxTokens: number,
    isPlanMode: boolean,
    attachments?: Attachment[],
    useWebSearch?: boolean,
    tools?: any[]
  ) => Promise<any>;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
}

export interface Attachment {
  name?: string;
  mimeType: string;
  data: string; // base64
}

export interface GenerationArgs {
  apiKey: string;
  fallbackApiKeys?: string[];
  model: string;
  systemInstruction: string;
  history: ConversationTurn[];
  prompt: string;
  temperature: number;
  maxTokens: number;
  isPlanMode: boolean;
  attachments?: Attachment[];
  useWebSearch?: boolean;
  tools?: any[];
}

export interface OverrideConfig {
  providerId: string;
  model: string;
  apiKey: string;
  fallbackApiKeys?: string[];
  isSystemScope?: boolean;
  isOsAgent?: boolean;
}
