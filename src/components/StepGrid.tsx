'use client';

import type { StepState } from '@/lib/types';
import { STEPS } from '@/lib/types';
import StepCard from './StepCard';
import styles from './StepGrid.module.css';

interface StepGridProps {
  steps: Record<number, StepState>;
  onCardClick: (step: number) => void;
}

export default function StepGrid({ steps, onCardClick }: StepGridProps) {
  return (
    <div className={styles.grid}>
      {STEPS.map(({ step, label }) => (
        <StepCard
          key={step}
          step={step}
          label={label}
          state={steps[step] ?? { status: 'idle' }}
          onClick={() => onCardClick(step)}
        />
      ))}
    </div>
  );
}
