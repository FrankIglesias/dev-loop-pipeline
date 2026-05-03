// ─────────────────────────────────────────────────────────────────────────────
// Pipeline event types — emitted via OnEvent callback throughout execution.
// Consumed by the Next.js API route (app/api/run/route.ts) which serialises
// them to an SSE stream for the UI.
// ─────────────────────────────────────────────────────────────────────────────

export type StepName = 'spec-freeze' | 'impl-scout' | 'code-write' | 'qa-gate' | 'pr-package';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type PipelineEvent =
  | { type: 'run:start'; runId: string; ticketId: string; repoPath: string; provider: string }
  | { type: 'step:start'; step: number; name: StepName }
  | { type: 'step:provider'; step: number; provider: string }
  | {
      type: 'step:saved';
      step: number;
      name: StepName;
      file: string;
      data?: unknown;
      tokens?: TokenUsage;
    }
  | { type: 'step:skipped'; step: number; name: StepName }
  | {
      type: 'file:written';
      filePath: string;
      linesAdded?: number;
      linesRemoved?: number;
      isNew?: boolean;
    }
  | { type: 'run:done'; prTitle: string; qaPassed: boolean; followUps: number; runDir: string }
  | { type: 'run:error'; message: string };

export type OnEvent = (event: PipelineEvent) => void;

// Default no-op — used when no handler is provided
export const noopOnEvent: OnEvent = () => {};
