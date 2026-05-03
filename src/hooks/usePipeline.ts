'use client';

import { getStepSummary } from '@/lib/stepSummary';
import type { FormState, LogLine, RunResult, StepState } from '@/lib/types';
import { STEPS } from '@/lib/types';
import { useCallback, useReducer, useRef } from 'react';

// ── State ────────────────────────────────────────────────────────────────────

interface PipelineState {
  steps: Record<number, StepState>;
  logLines: LogLine[];
  result: RunResult | null;
  isRunning: boolean;
  activeDrawer: number | null;
  logCounter: number;
}

function initSteps(): Record<number, StepState> {
  const s: Record<number, StepState> = {};
  for (const { step } of STEPS) {
    s[step] = { status: 'idle' };
  }
  return s;
}

function initialState(): PipelineState {
  return {
    steps: initSteps(),
    logLines: [],
    result: null,
    isRunning: false,
    activeDrawer: null,
    logCounter: 0,
  };
}

// ── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'RESET' }
  | { type: 'PATCH_STEP'; step: number; patch: Partial<StepState> }
  | { type: 'ADD_LOG'; text: string; cls: LogLine['cls'] }
  | { type: 'ADD_LOGS'; lines: Array<{ text: string; cls: LogLine['cls'] }> }
  | { type: 'SET_RESULT'; result: RunResult }
  | { type: 'SET_RUNNING'; value: boolean }
  | { type: 'SET_DRAWER'; step: number | null }
  | { type: 'MARK_RUNNING_ERROR' };

function reducer(state: PipelineState, action: Action): PipelineState {
  switch (action.type) {
    case 'RESET':
      return { ...initialState(), logCounter: state.logCounter };

    case 'PATCH_STEP':
      return {
        ...state,
        steps: {
          ...state.steps,
          [action.step]: { ...state.steps[action.step], ...action.patch },
        },
      };

    case 'ADD_LOG': {
      const id = state.logCounter + 1;
      return {
        ...state,
        logCounter: id,
        logLines: [...state.logLines, { id, text: action.text, cls: action.cls }],
      };
    }

    case 'ADD_LOGS': {
      let counter = state.logCounter;
      const newLines = action.lines.map((l) => ({ id: ++counter, text: l.text, cls: l.cls }));
      return {
        ...state,
        logCounter: counter,
        logLines: [...state.logLines, ...newLines],
      };
    }

    case 'SET_RESULT':
      return { ...state, result: action.result };

    case 'SET_RUNNING':
      return { ...state, isRunning: action.value };

    case 'SET_DRAWER':
      return { ...state, activeDrawer: action.step };

    case 'MARK_RUNNING_ERROR': {
      const updated = { ...state.steps };
      for (const key of Object.keys(updated)) {
        if (updated[Number(key)].status === 'running') {
          updated[Number(key)] = { ...updated[Number(key)], status: 'error' };
        }
      }
      return { ...state, steps: updated };
    }

    default:
      return state;
  }
}

// ── Token formatter ───────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function fmtTokens(t: {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}): string {
  return `↑${fmt(t.promptTokens)} ↓${fmt(t.completionTokens)} = ${fmt(t.totalTokens)}`;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePipeline() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepStartRef = useRef<Record<number, number>>({});

  const startTicker = useCallback((step: number) => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    stepStartRef.current[step] = Date.now();
    tickerRef.current = setInterval(() => {
      const elapsed = ((Date.now() - (stepStartRef.current[step] ?? Date.now())) / 1000).toFixed(1);
      dispatch({ type: 'PATCH_STEP', step, patch: { duration: `${elapsed}s` } });
    }, 100);
  }, []);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const openDrawer = useCallback((step: number) => {
    dispatch({ type: 'SET_DRAWER', step });
  }, []);

  const closeDrawer = useCallback(() => {
    dispatch({ type: 'SET_DRAWER', step: null });
  }, []);

  const startRun = useCallback(
    async (form: FormState) => {
      dispatch({ type: 'RESET' });
      dispatch({ type: 'SET_RUNNING', value: true });
      dispatch({ type: 'ADD_LOG', text: `▶ Starting run for ${form.ticketId}…`, cls: 'accent' });

      try {
        const res = await fetch('/api/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: form.ticketId,
            ticketText: form.ticketText || undefined,
            provider: form.provider,
            model: form.model || undefined,
            repoPath: form.repoPath || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          dispatch({
            type: 'ADD_LOG',
            text: `✗ ${(err as { error?: string }).error ?? 'Server error'}`,
            cls: 'red',
          });
          dispatch({ type: 'SET_RUNNING', value: false });
          return;
        }

        if (!res.body) {
          dispatch({ type: 'ADD_LOG', text: '✗ Empty response body', cls: 'red' });
          dispatch({ type: 'SET_RUNNING', value: false });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';
          for (const chunk of chunks) {
            const line = chunk.replace(/^data: /, '').trim();
            if (!line) continue;
            try {
              handleEvent(JSON.parse(line));
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        dispatch({ type: 'ADD_LOG', text: `✗ ${(err as Error).message}`, cls: 'red' });
      }

      stopTicker();
      dispatch({ type: 'SET_RUNNING', value: false });

      function handleEvent(event: Record<string, unknown>) {
        switch (event.type) {
          case 'run:start':
            dispatch({
              type: 'ADD_LOG',
              text: `  run-id: ${event.runId}  (resume from step N by passing runId + fromStep)`,
              cls: 'muted',
            });
            dispatch({ type: 'ADD_LOG', text: `  repo:   ${event.repoPath}`, cls: 'muted' });
            break;

          case 'step:start': {
            const step = event.step as number;
            dispatch({ type: 'ADD_LOG', text: `\nStep ${step}/5  ${event.name}`, cls: 'accent' });
            dispatch({ type: 'PATCH_STEP', step, patch: { status: 'running' } });
            startTicker(step);
            break;
          }

          case 'step:provider': {
            const step = event.step as number;
            dispatch({ type: 'ADD_LOG', text: `  provider: ${event.provider}`, cls: 'muted' });
            dispatch({ type: 'PATCH_STEP', step, patch: { provider: event.provider as string } });
            break;
          }

          case 'step:saved': {
            const step = event.step as number;
            stopTicker();
            const elapsed = (
              (Date.now() - (stepStartRef.current[step] ?? Date.now())) /
              1000
            ).toFixed(1);
            dispatch({
              type: 'ADD_LOG',
              text: `  saved → ${event.file}  (${elapsed}s)`,
              cls: 'muted',
            });
            dispatch({
              type: 'PATCH_STEP',
              step,
              patch: {
                status: 'done',
                duration: `${elapsed}s`,
                data: event.data,
                tokens: event.tokens as StepState['tokens'],
              },
            });
            // batch log summary lines
            const summaryLines = getStepSummary(
              event.name as import('@/lib/types').StepName,
              event.data
            );
            if (summaryLines.length > 0) {
              dispatch({ type: 'ADD_LOGS', lines: summaryLines });
            }
            break;
          }

          case 'step:skipped': {
            const step = event.step as number;
            stopTicker();
            dispatch({
              type: 'ADD_LOG',
              text: `Step ${step}/5  ${event.name}  (from disk)`,
              cls: 'muted',
            });
            dispatch({ type: 'PATCH_STEP', step, patch: { status: 'skipped' } });
            break;
          }

          case 'file:written': {
            const added = event.linesAdded as number | undefined;
            const removed = event.linesRemoved as number | undefined;
            const isNew = event.isNew as boolean | undefined;
            let diffStr = '';
            if (isNew) diffStr = '  (new file)';
            else if (added || removed) diffStr = `  +${added ?? 0} -${removed ?? 0}`;
            dispatch({
              type: 'ADD_LOG',
              text: `  wrote → ${event.filePath}${diffStr}`,
              cls: 'muted',
            });
            break;
          }

          case 'run:done': {
            const e = event as {
              prTitle: string;
              qaPassed: boolean;
              followUps: number;
              runDir: string;
            };
            dispatch({
              type: 'ADD_LOG',
              text: `\n✅ Done! QA: ${e.qaPassed ? 'passed' : 'failed'} · Follow-ups: ${e.followUps}`,
              cls: 'green',
            });
            dispatch({
              type: 'SET_RESULT',
              result: {
                prTitle: e.prTitle,
                qaPassed: e.qaPassed,
                followUps: e.followUps,
                runDir: e.runDir,
              },
            });
            break;
          }

          case 'run:error':
            dispatch({ type: 'ADD_LOG', text: `\n✗ ${event.message}`, cls: 'red' });
            // Only mark the currently running step as error — others keep their state
            dispatch({ type: 'MARK_RUNNING_ERROR' });
            break;
        }
      }
    },
    [startTicker, stopTicker]
  );

  return {
    steps: state.steps,
    logLines: state.logLines,
    result: state.result,
    isRunning: state.isRunning,
    activeDrawer: state.activeDrawer,
    openDrawer,
    closeDrawer,
    startRun,
  };
}
