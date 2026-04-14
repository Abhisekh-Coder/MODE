import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { usePipelineStore } from '../store/pipelineStore';

export default function SettingsModels() {
  const navigate = useNavigate();
  const { playbooks } = usePipelineStore();
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4-20250514');

  // Aggregate cost data from all playbooks
  const [playbookCosts, setPlaybookCosts] = useState<any[]>([]);

  useEffect(() => {
    // Fetch cost data for each playbook
    const fetchCosts = async () => {
      const costs: any[] = [];
      for (const pb of playbooks) {
        try {
          const status: any = await api.getStatus(pb.run_id);
          if (status.cost_tracking) {
            costs.push({
              name: status.member?.name || pb.run_id,
              run_id: pb.run_id,
              ...status.cost_tracking,
            });
          }
        } catch {}
      }
      setPlaybookCosts(costs);
    };
    if (playbooks.length > 0) fetchCosts();
  }, [playbooks]);

  const totalUsd = playbookCosts.reduce((s, c) => s + (c.total_cost_usd || 0), 0);
  const totalInr = totalUsd * 83.5;
  const totalInputTokens = playbookCosts.reduce((s, c) => s + (c.total_input_tokens || 0), 0);
  const totalOutputTokens = playbookCosts.reduce((s, c) => s + (c.total_output_tokens || 0), 0);
  const avgPerRun = playbookCosts.length > 0 ? totalUsd / playbookCosts.length : 3.05;

  const handleSave = async () => {
    try {
      await api.updateSettings('models', { api_key: apiKey, default_model: defaultModel });
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="text-[11px] text-white/30 mb-4">
        <span className="text-purple-400 cursor-pointer hover:underline" onClick={() => navigate('/')}>Dashboard</span>
        <span className="mx-1.5">/</span> Settings <span className="mx-1.5">/</span> Models
      </div>

      <h1 className="text-lg font-semibold mb-1">Model Configuration</h1>
      <p className="text-[12px] text-white/30 mb-5">API settings, model assignments, and cost tracking.</p>

      {/* API Settings */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-4">
        <h3 className="text-[13px] font-semibold mb-3">Anthropic API</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-white/50 block mb-1">API Key</label>
            <div className="text-[11px] text-white/50 bg-white/[0.02] border border-white/[0.06] rounded-md px-3 py-2">
              Configured via <code className="bg-white/5 px-1 rounded text-[10px]">.env</code> file (ANTHROPIC_API_KEY)
              <span className="text-emerald-400 ml-2 font-medium">Active</span>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-white/50 block mb-1">Default Model</label>
            <select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} className="w-full">
              <option value="claude-sonnet-4-20250514">claude-sonnet-4-20250514</option>
              <option value="claude-opus-4-6">claude-opus-4-6</option>
            </select>
          </div>
        </div>
      </div>

      {/* Model Assignments */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-4">
        <h3 className="text-[13px] font-semibold mb-3">Model Assignments</h3>
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                <th className="text-left p-2.5 font-semibold text-white/50">Agent</th>
                <th className="text-left p-2.5 font-semibold text-white/50">Model</th>
                <th className="text-left p-2.5 font-semibold text-white/50">Why</th>
                <th className="text-right p-2.5 font-semibold text-white/50">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {[
                { agent: 'Agent 1', model: 'claude-opus-4-6', why: 'Complex cross-correlation, nuanced reasoning', cost: '~$2.50' },
                { agent: 'Agent 2', model: 'claude-sonnet-4', why: 'Structured generation from pre-computed analysis', cost: '~$0.25' },
                { agent: 'Agent 3', model: 'claude-sonnet-4', why: 'Structured generation + language transformation', cost: '~$0.30' },
                { agent: 'OCR', model: 'claude-sonnet-4', why: 'Vision extraction from scanned PDFs', cost: '~$0.03/pg' },
              ].map((row, i) => (
                <tr key={i} className="border-b border-white/[0.04] last:border-0">
                  <td className="p-2.5 font-medium">{row.agent}</td>
                  <td className="p-2.5 text-white/50 font-mono text-[10px]">{row.model}</td>
                  <td className="p-2.5 text-white/50">{row.why}</td>
                  <td className="p-2.5 text-right text-emerald-400 font-medium">{row.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost Overview */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-4">
        <h3 className="text-[13px] font-semibold mb-3">Cost Tracking</h3>
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-white/[0.02] rounded-lg p-3">
            <div className="text-[11px] text-white/30">Total (USD)</div>
            <div className="text-xl font-semibold text-white/90">${totalUsd.toFixed(2)}</div>
            <div className="text-[10px] text-white/30">{playbookCosts.length} run{playbookCosts.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3">
            <div className="text-[11px] text-white/30">Total (INR)</div>
            <div className="text-xl font-semibold text-white/90">₹{totalInr.toFixed(0)}</div>
            <div className="text-[10px] text-white/30">@ ₹83.50/USD</div>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3">
            <div className="text-[11px] text-white/30">Avg per Run</div>
            <div className="text-xl font-semibold text-white/90">${avgPerRun.toFixed(2)}</div>
            <div className="text-[10px] text-white/30">₹{(avgPerRun * 83.5).toFixed(0)}</div>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3">
            <div className="text-[11px] text-white/30">Total Tokens</div>
            <div className="text-xl font-semibold text-white/90">{((totalInputTokens + totalOutputTokens) / 1000).toFixed(0)}K</div>
            <div className="text-[10px] text-white/30">{(totalInputTokens/1000).toFixed(0)}K in + {(totalOutputTokens/1000).toFixed(0)}K out</div>
          </div>
        </div>

        {/* Per-playbook breakdown */}
        {playbookCosts.length > 0 && (
          <div>
            <h4 className="text-[11px] font-semibold text-white/50 mb-2 uppercase tracking-wider">Per Playbook</h4>
            <div className="overflow-hidden rounded-lg border border-white/[0.06]">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                    <th className="text-left p-2 font-semibold text-white/50">Playbook</th>
                    <th className="text-right p-2 font-semibold text-white/50">Input Tokens</th>
                    <th className="text-right p-2 font-semibold text-white/50">Output Tokens</th>
                    <th className="text-right p-2 font-semibold text-white/50">Cost (USD)</th>
                    <th className="text-right p-2 font-semibold text-white/50">Cost (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {playbookCosts.map((c, i) => (
                    <tr key={i} className="border-b border-white/[0.04] last:border-0">
                      <td className="p-2 font-medium">{c.name}</td>
                      <td className="p-2 text-right text-white/50">{(c.total_input_tokens || 0).toLocaleString()}</td>
                      <td className="p-2 text-right text-white/50">{(c.total_output_tokens || 0).toLocaleString()}</td>
                      <td className="p-2 text-right text-emerald-400 font-medium">${(c.total_cost_usd || 0).toFixed(2)}</td>
                      <td className="p-2 text-right text-amber-400 font-medium">₹{(c.total_cost_inr || 0).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Per-agent breakdown for each playbook */}
            {playbookCosts.map((c, i) => (
              c.agents && Object.keys(c.agents).length > 0 && (
                <div key={i} className="mt-3">
                  <h4 className="text-[10px] font-semibold text-white/30 mb-1">{c.name} — Agent breakdown</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(c.agents).map(([agentNum, agentCost]: [string, any]) => (
                      <div key={agentNum} className="bg-white/[0.02] rounded-lg p-2 text-[10px]">
                        <div className="font-medium text-white/60">Agent {agentNum}</div>
                        <div className="text-white/30">{agentCost.model}</div>
                        <div className="mt-1">
                          <span className="text-emerald-400 font-medium">${agentCost.total_cost_usd?.toFixed(2)}</span>
                          <span className="text-white/20 mx-1">|</span>
                          <span className="text-amber-400">₹{agentCost.total_cost_inr?.toFixed(0)}</span>
                        </div>
                        <div className="text-white/30 mt-0.5">
                          {agentCost.input_tokens?.toLocaleString()} in / {agentCost.output_tokens?.toLocaleString()} out
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      <div className="text-[10px] text-white/30 mt-4 text-center">
        Cost data is tracked automatically per pipeline run. API key and model assignments are configured in .env and Settings → Agents.
      </div>
    </div>
  );
}
