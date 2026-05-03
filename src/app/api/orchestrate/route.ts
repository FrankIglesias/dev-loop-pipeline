import { randomUUID } from 'node:crypto';
import type { PipelineInput } from '@/lib/pipeline/context';
import type { OnEvent, PipelineEvent } from '@/lib/pipeline/events';
import { runPipeline } from '@/lib/pipeline/pipe';
import { createProviderFactory } from '@/lib/pipeline/provider';
import { LMStudioProvider } from '@/lib/pipeline/providers/lmstudio';

function sseMessage(event: PipelineEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, string>;
  try {
    body = (await req.json()) as Record<string, string>;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const {
    ticketId,
    ticketText,
    repoPath = process.cwd(),
    provider: providerName,
    model,
    baseUrl,
    fromStep,
    runId: existingRunId,
  } = body;

  if (!ticketId) {
    return new Response(JSON.stringify({ error: 'ticketId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const runId = existingRunId ?? randomUUID().slice(0, 8);
  const providerFactory = createProviderFactory({
    provider: providerName,
    model,
    baseUrl,
  });
  const defaultProvider = new LMStudioProvider(model ?? 'llama3.2', baseUrl);

  const input: PipelineInput = {
    ticketId,
    ticketText,
    repoPath,
    runId,
    fromStep: fromStep ? Number.parseInt(fromStep, 10) : undefined,
    provider: defaultProvider,
  };

  const queue: PipelineEvent[] = [];
  let done = false;
  let notify: (() => void) | null = null;

  const onEvent: OnEvent = (event) => {
    queue.push(event);
    notify?.();
    notify = null;
  };

  runPipeline(input, providerFactory, onEvent)
    .catch((err: Error) => onEvent({ type: 'run:error', message: err.message }))
    .finally(() => {
      done = true;
      notify?.();
      notify = null;
    });

  const stream = new ReadableStream({
    async pull(controller) {
      if (queue.length === 0 && !done) {
        await new Promise<void>((resolve) => {
          notify = resolve;
        });
      }
      while (queue.length > 0) {
        // queue.length > 0 is checked above — shift() is always defined here
        // biome-ignore lint/style/noNonNullAssertion: guarded by while condition
        controller.enqueue(new TextEncoder().encode(sseMessage(queue.shift()!)));
      }
      if (done && queue.length === 0) {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
