'use client';

import { fmtTokens } from '@/hooks/usePipeline';
import type { StepState } from '@/lib/types';
import styles from './StepCard.module.css';

interface StepCardProps {
  step: number;
  label: string;
  state: StepState;
  onClick: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Waiting',
  running: 'Running…',
  done: 'Done',
  error: 'Error',
  skipped: 'Skipped',
};

export default function StepCard({ step, label, state, onClick }: StepCardProps) {
  const cls = state.status === 'idle' ? '' : styles[state.status];
  const isDone = state.status === 'done';
  const tokStr = state.tokens ? fmtTokens(state.tokens) : '';

  return (
    <div
      className={`${styles.card} ${cls ?? ''}`}
      onClick={isDone ? onClick : undefined}
      onKeyDown={
        isDone
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      role={isDone ? 'button' : undefined}
      tabIndex={isDone ? 0 : undefined}
      style={{ cursor: isDone ? 'pointer' : 'default' }}
    >
      <div className={styles.num}>Step {step}</div>
      <div className={styles.name}>{label}</div>
      <div className={styles.status}>
        <div className={styles.dot} />
        <span>{STATUS_LABEL[state.status] ?? state.status}</span>
      </div>
      {state.provider && <div className={styles.provider}>{state.provider}</div>}
      {state.duration && <div className={styles.duration}>{state.duration}</div>}
      {tokStr && <div className={styles.tokens}>{tokStr.split(' = ')[0]}</div>}
      {isDone && <div className={styles.peek}>View output →</div>}
    </div>
  );
}
