import OpenAI from 'openai';
import type { CompletionResult, LLMProvider } from '../provider';

export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(model = 'gpt-4o', baseURL?: string) {
    this.model = model;
    this.name = `openai/${model}`;
    this.client = new OpenAI({ baseURL });
  }

  async complete(systemPrompt: string, userMessage: string): Promise<CompletionResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';
    const u = response.usage;
    return {
      text,
      usage: u
        ? {
            promptTokens: u.prompt_tokens,
            completionTokens: u.completion_tokens,
            totalTokens: u.total_tokens,
          }
        : undefined,
    };
  }
}
