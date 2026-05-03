'use client';

import { useEffect, useState } from 'react';

type DetectStatus = 'idle' | 'loading' | 'ok' | 'offline';

interface ModelDetectResult {
  models: string[];
  status: DetectStatus;
}

export function useModelDetect(provider: string): ModelDetectResult {
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<DetectStatus>('idle');

  useEffect(() => {
    if (provider !== 'lmstudio') {
      setModels([]);
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    fetch(`/api/models?provider=${provider}`)
      .then((r) => r.json())
      .then((data: { models: string[] }) => {
        if (cancelled) return;
        setModels(data.models ?? []);
        setStatus('ok');
      })
      .catch(() => {
        if (cancelled) return;
        setModels([]);
        setStatus('offline');
      });

    return () => {
      cancelled = true;
    };
  }, [provider]);

  return { models, status };
}
