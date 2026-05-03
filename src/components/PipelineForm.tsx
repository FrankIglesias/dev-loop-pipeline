'use client';

import type { FormState } from '@/lib/types';
import styles from './PipelineForm.module.css';

interface PipelineFormProps {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onRun: () => void;
  isRunning: boolean;
  models: string[];
  modelStatus: 'idle' | 'loading' | 'ok' | 'offline';
}

function modelStatusLabel(status: PipelineFormProps['modelStatus'], count: number): string {
  switch (status) {
    case 'loading':
      return '— detecting…';
    case 'ok':
      return count > 0 ? `— ${count} available` : '— none found';
    case 'offline':
      return '— offline';
    default:
      return '';
  }
}

export default function PipelineForm({
  form,
  onChange,
  onRun,
  isRunning,
  models,
  modelStatus,
}: PipelineFormProps) {
  return (
    <div className={styles.card}>
      {/* Row 1: Ticket ID / Provider / Model */}
      <div className={styles.grid3}>
        <div className={styles.group}>
          <label className={styles.label} htmlFor="ticketId">
            Ticket ID
          </label>
          <input
            id="ticketId"
            className={styles.input}
            type="text"
            placeholder="BCNP-42"
            value={form.ticketId}
            onChange={(e) => onChange({ ticketId: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRun();
            }}
          />
        </div>
        <div className={styles.group}>
          <label className={styles.label} htmlFor="provider">
            Provider
          </label>
          <select
            id="provider"
            className={styles.input}
            value={form.provider}
            onChange={(e) => onChange({ provider: e.target.value, model: '' })}
          >
            <option value="lmstudio">LM Studio (local)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div className={styles.group}>
          <label className={styles.label} htmlFor="model">
            Model{' '}
            <span className={styles.labelMeta}>{modelStatusLabel(modelStatus, models.length)}</span>
          </label>
          <input
            id="model"
            className={styles.input}
            type="text"
            placeholder="auto-detected"
            value={form.model}
            list="modelList"
            onChange={(e) => onChange({ model: e.target.value })}
          />
          <datalist id="modelList">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Row 2: Repo path / Run button */}
      <div className={styles.row}>
        <div className={`${styles.group} ${styles.flex1}`}>
          <label className={styles.label} htmlFor="repoPath">
            Repo path
          </label>
          <input
            id="repoPath"
            className={styles.input}
            type="text"
            value={form.repoPath}
            onChange={(e) => onChange({ repoPath: e.target.value })}
          />
        </div>
        <button type="button" className={styles.runBtn} onClick={onRun} disabled={isRunning}>
          ▶ Run pipeline
        </button>
      </div>

      {/* Row 3: Ticket description */}
      <div className={styles.group}>
        <label className={styles.label} htmlFor="ticketText">
          Ticket description{' '}
          <span className={styles.labelMeta}>(optional — more detail = better output)</span>
        </label>
        <textarea
          id="ticketText"
          className={styles.textarea}
          rows={3}
          placeholder="Describe what this ticket should do… e.g. Add emoji reactions below each standup post. Users can pick 👍 ❤️ 😄. One reaction per user per post."
          value={form.ticketText}
          onChange={(e) => onChange({ ticketText: e.target.value })}
        />
      </div>
    </div>
  );
}
