'use client';

import type { RunResult } from '@/lib/types';
import styles from './ResultCard.module.css';

interface ResultCardProps {
  result: RunResult | null;
}

export default function ResultCard({ result }: ResultCardProps) {
  if (!result) return null;

  return (
    <div className={`${styles.card} ${result.qaPassed ? styles.success : styles.failure}`}>
      <div className={styles.header}>
        <span className={styles.icon}>{result.qaPassed ? '✅' : '⚠️'}</span>
        <span className={styles.title}>{result.prTitle}</span>
      </div>
      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>QA</span>
          <span className={`${styles.metaValue} ${result.qaPassed ? styles.pass : styles.fail}`}>
            {result.qaPassed ? 'Passed' : 'Failed'}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Follow-ups</span>
          <span className={styles.metaValue}>{result.followUps}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Outputs</span>
          <span className={`${styles.metaValue} ${styles.runDir}`}>{result.runDir}</span>
        </div>
      </div>
    </div>
  );
}
