'use client';

import { useModelDetect } from '@/hooks/useModelDetect';
import { usePipeline } from '@/hooks/usePipeline';
import type { FormState } from '@/lib/types';
import { STEPS } from '@/lib/types';
import { useEffect, useState } from 'react';
import JsonDrawer from './JsonDrawer';
import LiveLog from './LiveLog';
import styles from './PipelineApp.module.css';
import PipelineForm from './PipelineForm';
import ResultCard from './ResultCard';
import StepGrid from './StepGrid';

export default function PipelineApp() {
  const [form, setForm] = useState<FormState>({
    ticketId: '',
    provider: 'lmstudio',
    model: '',
    repoPath: '',
    ticketText: '',
  });

  const { steps, logLines, result, isRunning, activeDrawer, openDrawer, closeDrawer, startRun } =
    usePipeline();
  const { models, status: modelStatus } = useModelDetect(form.provider);

  // Auto-fill first model when detected
  // biome-ignore lint/correctness/useExhaustiveDependencies: form.model intentionally omitted — reading it inside avoids infinite update loop
  useEffect(() => {
    if (modelStatus === 'ok' && models.length > 0 && !form.model) {
      setForm((f) => ({ ...f, model: models[0] }));
    }
  }, [modelStatus, models]);

  const handleChange = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
  };

  const handleRun = () => {
    if (!form.ticketId.trim()) return;
    startRun(form);
  };

  const drawerStep = activeDrawer !== null ? STEPS.find((s) => s.step === activeDrawer) : null;
  const drawerData = activeDrawer !== null ? steps[activeDrawer]?.data : undefined;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.h1}>
          <span>⚙️</span> Dev Loop Pipeline
        </h1>
      </header>

      <PipelineForm
        form={form}
        onChange={handleChange}
        onRun={handleRun}
        isRunning={isRunning}
        models={models}
        modelStatus={modelStatus}
      />

      <div className={styles.stepsLabel}>Pipeline steps</div>
      <StepGrid steps={steps} onCardClick={openDrawer} />

      <JsonDrawer
        step={activeDrawer}
        stepLabel={drawerStep ? drawerStep.label : ''}
        data={drawerData}
        onClose={closeDrawer}
      />

      <ResultCard result={result} />

      <div className={styles.logLabel}>Live log</div>
      <LiveLog lines={logLines} />
    </div>
  );
}
