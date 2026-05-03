'use client';

import type { LogLine } from '@/lib/types';
import { useEffect, useRef } from 'react';
import styles from './LiveLog.module.css';

interface LiveLogProps {
  lines: LogLine[];
}

export default function LiveLog({ lines }: LiveLogProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: boxRef is a stable ref; lines drives the scroll
  useEffect(() => {
    const box = boxRef.current;
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  }, [lines]);

  return (
    <div className={styles.box} ref={boxRef}>
      {lines.length === 0 ? (
        <span className={styles.empty}>Run a pipeline to see logs here…</span>
      ) : (
        lines.map((line) => (
          <span key={line.id} className={`${styles.line} ${styles[line.cls]}`}>
            {line.text}
          </span>
        ))
      )}
    </div>
  );
}
