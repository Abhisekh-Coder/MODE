// store/pipelineStore.ts — Zustand store for MODE app state

import { create } from 'zustand';
import type { Playbook, PipelineState, LogEntry, Agent1Output, Agent2Output, Agent3Output } from '../types';

interface PipelineStore {
  // Current state
  playbooks: Playbook[];
  activeRunId: string | null;
  activePipeline: Playbook | null;
  
  // Agent outputs
  outputs: {
    agent1?: Agent1Output;
    agent2?: Agent2Output;
    agent3?: Agent3Output;
  };
  
  // Streaming
  streamingText: string;
  streamingAgent: number | null;
  streamingProgress: number;
  
  // Logs
  logs: LogEntry[];
  
  // UI state
  activeTab: 'agents' | 'sheets' | 'logs' | 'uploads';
  activeSheet: number;
  
  // Actions
  setPlaybooks: (playbooks: Playbook[]) => void;
  setActiveRun: (runId: string) => void;
  setOutput: (agent: number, output: any) => void;
  appendStreamChunk: (text: string) => void;
  setStreamingAgent: (agent: number | null) => void;
  setStreamingProgress: (pct: number) => void;
  clearStream: () => void;
  addLog: (entry: LogEntry) => void;
  setLogs: (logs: LogEntry[]) => void;
  setTab: (tab: 'agents' | 'sheets' | 'logs' | 'uploads') => void;
  setSheet: (sheet: number) => void;
  updatePipelineState: (state: PipelineState) => void;
}

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  playbooks: [],
  activeRunId: null,
  activePipeline: null,
  outputs: {},
  streamingText: '',
  streamingAgent: null,
  streamingProgress: 0,
  logs: [],
  activeTab: 'agents',
  activeSheet: 1,

  setPlaybooks: (playbooks) => set({ playbooks }),
  
  setActiveRun: (runId) => {
    const pipeline = get().playbooks.find(p => p.run_id === runId) || null;
    set({ activeRunId: runId, activePipeline: pipeline });
  },
  
  setOutput: (agent, output) => set(state => ({
    outputs: { ...state.outputs, [`agent${agent}`]: output }
  })),
  
  appendStreamChunk: (text) => set(state => ({
    streamingText: state.streamingText + text
  })),
  
  setStreamingAgent: (agent) => set({ streamingAgent: agent, streamingText: '' }),
  setStreamingProgress: (pct) => set({ streamingProgress: pct }),
  clearStream: () => set({ streamingText: '', streamingAgent: null, streamingProgress: 0 }),
  
  addLog: (entry) => set(state => ({ logs: [...state.logs, entry] })),
  setLogs: (logs) => set({ logs }),
  
  setTab: (tab) => set({ activeTab: tab }),
  setSheet: (sheet) => set({ activeSheet: sheet }),
  
  updatePipelineState: (state) => set(s => ({
    activePipeline: s.activePipeline 
      ? { ...s.activePipeline, state } 
      : null
  })),
}));
