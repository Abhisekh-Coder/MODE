import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '../api/client';

interface AgentConfig {
  name: string;
  description: string;
  model: string;
  recommendedModel: string;
  maxTokens: number;
  temperature: number;
  promptFile: string;
  enabled: boolean;
}

const defaultAgents: AgentConfig[] = [
  {
    name: 'Agent 1: Biomarker Analysis',
    description: 'Receives: Sheet 2 data + clinical history + symptoms. Produces: Sheet 3 + cluster handoff.',
    model: 'claude-opus-4-6',
    recommendedModel: 'claude-opus-4-6',
    maxTokens: 30000,
    temperature: 0,
    promptFile: 'agent1_biomarker_analysis.txt',
    enabled: true,
  },
  {
    name: 'Agent 2: System Mapping',
    description: 'Receives: cluster handoff + clinical history. Produces: Sheet 4 + system handoff.',
    model: 'claude-sonnet-4-20250514',
    recommendedModel: 'claude-sonnet-4-20250514',
    maxTokens: 25000,
    temperature: 0,
    promptFile: 'agent2_system_mapping.txt',
    enabled: true,
  },
  {
    name: 'Agent 3: Humanized Roadmap',
    description: 'Receives: system handoff + clinical history. Produces: Sheet 5 (3 phases + 6 biweekly cards).',
    model: 'claude-sonnet-4-20250514',
    recommendedModel: 'claude-sonnet-4-20250514',
    maxTokens: 30000,
    temperature: 0,
    promptFile: 'agent3_humanized_roadmap.txt',
    enabled: true,
  },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      className={clsx('relative w-8 h-[18px] rounded-full cursor-pointer transition', on ? 'bg-indigo-600' : 'bg-gray-300')}
      onClick={onToggle}
    >
      <div className={clsx('absolute top-[2px] left-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform', on && 'translate-x-3.5')} />
    </div>
  );
}

export default function SettingsAgents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState(defaultAgents);

  const updateAgent = (idx: number, field: keyof AgentConfig, value: any) => {
    setAgents((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    try {
      await api.updateSettings('agents', agents);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="text-[11px] text-white/30 mb-4">
        <span className="text-indigo-400 cursor-pointer hover:underline" onClick={() => navigate('/')}>Dashboard</span>
        <span className="mx-1.5">/</span> Settings <span className="mx-1.5">/</span> Agents
      </div>

      <h1 className="text-lg font-semibold mb-1">Agent Configuration</h1>
      <p className="text-[12px] text-white/30 mb-5">Configure the pipeline agents. Changes apply to all new runs.</p>

      {agents.map((agent, idx) => (
        <div key={idx} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-3">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[13px] font-semibold">{agent.name}</span>
            <Toggle on={agent.enabled} onToggle={() => updateAgent(idx, 'enabled', !agent.enabled)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/50 block mb-1">Model</label>
              <select className="w-full" value={agent.model} onChange={(e) => updateAgent(idx, 'model', e.target.value)}>
                <option value="claude-opus-4-6">claude-opus-4-6 {agent.recommendedModel === 'claude-opus-4-6' ? '(recommended)' : ''}</option>
                <option value="claude-sonnet-4-20250514">claude-sonnet-4-20250514 {agent.recommendedModel === 'claude-sonnet-4-20250514' ? '(recommended)' : ''}</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-white/50 block mb-1">Max tokens</label>
              <input className="w-full" type="number" value={agent.maxTokens} onChange={(e) => updateAgent(idx, 'maxTokens', Number(e.target.value))} />
            </div>
            <div>
              <label className="text-[11px] text-white/50 block mb-1">Temperature</label>
              <input className="w-full" type="number" step="0.1" min="0" max="1" value={agent.temperature} onChange={(e) => updateAgent(idx, 'temperature', Number(e.target.value))} />
            </div>
            <div>
              <label className="text-[11px] text-white/50 block mb-1">Prompt file</label>
              <input className="w-full bg-white/[0.02]" value={agent.promptFile} disabled />
            </div>
          </div>

          <p className="text-[11px] text-white/30 mt-3">{agent.description}</p>
        </div>
      ))}

      <div className="border-2 border-dashed border-white/[0.06] rounded-xl p-4 text-center text-[12px] text-indigo-400 cursor-pointer hover:border-blue-300 hover:bg-indigo-500/10 transition">
        + Add custom agent to pipeline
      </div>

      <div className="flex justify-end mt-4">
        <button className="px-4 py-2 text-[12px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-500" onClick={handleSave}>
          Save Configuration
        </button>
      </div>
    </div>
  );
}
