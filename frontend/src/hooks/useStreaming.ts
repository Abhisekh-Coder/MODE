// hooks/useStreaming.ts — SSE hook for real-time agent output streaming

import { useCallback, useRef } from 'react';
import { usePipelineStore } from '../store/pipelineStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function useStreaming() {
  const sourceRef = useRef<EventSource | null>(null);
  const store = usePipelineStore();

  const startStreaming = useCallback((runId: string, agentNum: number, feedback?: string) => {
    // Close existing connection
    if (sourceRef.current) {
      sourceRef.current.close();
    }

    store.setStreamingAgent(agentNum);
    store.setStreamingProgress(0);

    let url = `${API_BASE}/pipeline/${runId}/agent/${agentNum}/run`;
    if (feedback) {
      url += `?feedback=${encodeURIComponent(feedback)}`;
    }

    const source = new EventSource(url);
    sourceRef.current = source;

    let totalChars = 0;
    const estimatedTotal = agentNum === 1 ? 120000 : agentNum === 2 ? 100000 : 120000;

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'chunk') {
          store.appendStreamChunk(data.text);
          totalChars += data.text.length;
          store.setStreamingProgress(Math.min(95, (totalChars / estimatedTotal) * 100));
        }

        if (data.type === 'complete') {
          store.setOutput(agentNum, data.parsed);
          store.setStreamingProgress(100);
          store.clearStream();
          source.close();
        }

        if (data.type === 'error') {
          console.error('Agent error:', data.message);
          store.clearStream();
          source.close();
        }

        if (data.type === 'log') {
          store.addLog(data.entry);
        }
      } catch (e) {
        // Non-JSON event, ignore
      }
    };

    source.onerror = () => {
      console.error('SSE connection error');
      store.clearStream();
      source.close();
    };

    return source;
  }, [store]);

  const stopStreaming = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    store.clearStream();
  }, [store]);

  return { startStreaming, stopStreaming };
}
