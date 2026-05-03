import Anthropic from '@anthropic-ai/sdk';
import type { CompletionResult, LLMProvider } from '../provider';

export class AnthropicProvider implements LLMProvider {
  readonly name: string;
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(model = 'claude-sonnet-4-5') {
    this.model = model;
    this.name = `anthropic/${model}`;
    this.client = new Anthropic();
  }

  async complete(systemPrompt: string, userMessage: string): Promise<CompletionResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8096,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          // Prompt caching: system prompts are large and repeated across steps.
          // Cache hits cut latency and cost significantly on multi-step runs.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    const usage = response.usage as Anthropic.Usage & {
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      text,
      usage: {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        // Anthropic bills cache reads at 10% and cache writes at 125% — report raw counts
        totalTokens: usage.input_tokens + usage.output_tokens,
      },
    };
  }
}
