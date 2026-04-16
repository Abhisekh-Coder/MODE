// api/client.ts — API client for MODE backend

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ═══ PLAYBOOK CRUD ═══

export const api = {
  listPlaybooks: () => request<any[]>('/playbooks'),

  createPlaybook: (member: any, files: Record<string, File>) => {
    const form = new FormData();
    form.append('member', JSON.stringify(member));
    Object.entries(files).forEach(([key, file]) => {
      if (file) form.append(key, file);
    });
    return fetch(`${API_BASE}/playbook`, { method: 'POST', body: form }).then(r => r.json());
  },

  // ═══ PIPELINE ═══

  getStatus: (runId: string) => request(`/pipeline/${runId}/status`),

  runAgent: (runId: string, agentNum: number, feedback?: string) => {
    return new EventSource(
      `${API_BASE}/pipeline/${runId}/agent/${agentNum}/run` +
      (feedback ? `?feedback=${encodeURIComponent(feedback)}` : '')
    );
  },

  approveAgent: (runId: string, agentNum: number, edits?: any) =>
    request(`/pipeline/${runId}/agent/${agentNum}/approve`, {
      method: 'POST',
      body: JSON.stringify({ edits }),
    }),

  rejectAgent: (runId: string, agentNum: number, feedback: string) =>
    request(`/pipeline/${runId}/agent/${agentNum}/reject`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),

  // ═══ AGENT DATA ═══

  getOutput: (runId: string, agentNum: number) =>
    request(`/pipeline/${runId}/agent/${agentNum}/output`),

  getPrompt: (runId: string, agentNum: number) =>
    request<{ prompt: string; chars: number }>(`/pipeline/${runId}/agent/${agentNum}/prompt`),

  updatePrompt: (runId: string, agentNum: number, prompt: string) =>
    request(`/pipeline/${runId}/agent/${agentNum}/prompt`, {
      method: 'PUT',
      body: JSON.stringify({ prompt }),
    }),

  // ═══ SHEETS ═══

  getSheet: (runId: string, sheetNum: number) =>
    request<any>(`/pipeline/${runId}/sheet/${sheetNum}`),

  // ═══ PROTOCOL ═══

  generateProtocol: (runId: string, startDate?: string) =>
    request<any>(`/pipeline/${runId}/protocol/generate`, {
      method: 'POST',
      body: JSON.stringify({ start_date: startDate }),
    }),

  getProtocol: (runId: string) => request<any>(`/pipeline/${runId}/protocol`),

  updateGoal: (runId: string, table: string, goalId: string, data: any) =>
    request(`/pipeline/${runId}/protocol/${table}/${goalId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // ═══ UPLOADS ═══

  getUploads: (runId: string) => request<any[]>(`/pipeline/${runId}/uploads`),

  // ═══ LOGS ═══

  getLogs: (runId: string, level?: string, agent?: number) => {
    const params = new URLSearchParams();
    if (level) params.set('level', level);
    if (agent) params.set('agent', String(agent));
    return request(`/pipeline/${runId}/logs?${params}`);
  },

  // ═══ EXPORT ═══

  exportXlsx: (runId: string) =>
    `${API_BASE}/pipeline/${runId}/export`,

  // ═══ SETTINGS ═══

  getSettings: (section: 'agents' | 'prompts' | 'models') =>
    request(`/settings/${section}`),

  updateSettings: (section: string, data: any) =>
    request(`/settings/${section}`, { method: 'PUT', body: JSON.stringify(data) }),
};
