// LLMProvider interface — decouples the runner from any specific SDK.
// Adapters: AnthropicProvider, OpenAIProvider, LMStudioProvider.

import { AnthropicProvider } from './providers/anthropic';
import { LMStudioProvider } from './providers/lmstudio';
import { OpenAIProvider } from './providers/openai';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompletionResult {
  text: string;
  usage?: TokenUsage;
}

export interface LLMProvider {
  name: string;
  complete(systemPrompt: string, userMessage: string): Promise<CompletionResult>;
}

// Factory: resolves request options > skill frontmatter > defaults.
// Pass the returned function to the runner instead of a provider instance
// so each skill can optionally use its own model.
export function createProviderFactory(options: {
  provider?: string;
  model?: string;
  baseUrl?: string;
}): (frontmatterProvider?: string, frontmatterModel?: string) => LLMProvider {
  return (frontmatterProvider, frontmatterModel) => {
    const providerName = options.provider ?? frontmatterProvider ?? 'lmstudio';
    const model = options.model ?? frontmatterModel ?? undefined;

    switch (providerName) {
      case 'anthropic':
        return new AnthropicProvider(model);
      case 'openai':
        return new OpenAIProvider(model, options.baseUrl);
      default:
        return new LMStudioProvider(model, options.baseUrl);
    }
  };
}

export type ProviderFactory = ReturnType<typeof createProviderFactory>;
