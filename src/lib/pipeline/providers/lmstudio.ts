import type { CompletionResult, LLMProvider } from '../provider';

// LM Studio exposes an OpenAI-compatible REST API.
// We use raw fetch (same as OllamaProvider) to avoid OpenAI SDK issues
// when running inside Bun's server context.
export class LMStudioProvider implements LLMProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(model = 'llama3.2', baseUrl = 'http://localhost:1234/v1') {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.name = `lmstudio/${model}`;
  }

  async complete(systemPrompt: string, userMessage: string): Promise<CompletionResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer lm-studio' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LM Studio ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const text = data.choices[0]?.message?.content ?? '';
    const u = data.usage;
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
