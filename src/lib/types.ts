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

export type StepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';

export interface StepState {
  status: StepStatus;
  provider?: string;
  duration?: string;
  tokens?: TokenUsage;
  data?: unknown;
}

export interface LogLine {
  id: number;
  text: string;
  cls: 'info' | 'muted' | 'accent' | 'green' | 'red';
}

export interface RunResult {
  prTitle: string;
  qaPassed: boolean;
  followUps: number;
  runDir: string;
}

export const STEPS = [
  { step: 1, name: 'spec-freeze' as StepName, label: 'Spec Freeze' },
  { step: 2, name: 'impl-scout' as StepName, label: 'Impl Scout' },
  { step: 3, name: 'code-write' as StepName, label: 'Code Write' },
  { step: 4, name: 'qa-gate' as StepName, label: 'QA Gate' },
  { step: 5, name: 'pr-package' as StepName, label: 'PR Package' },
] as const;

export interface FormState {
  ticketId: string;
  provider: string;
  model: string;
  repoPath: string;
  ticketText: string;
}
