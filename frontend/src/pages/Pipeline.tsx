import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Play, Check, RotateCcw, X, Edit3, Download, Eye, AlertTriangle, FileText } from 'lucide-react';
import clsx from 'clsx';
import { usePipelineStore } from '../store/pipelineStore';
import { useStreaming } from '../hooks/useStreaming';
import { api } from '../api/client';
import type { Playbook, AgentStatus, LogEntry } from '../types';

// ─── Dark theme helpers ───
const card = 'bg-white/[0.03] border border-white/[0.06] rounded-xl';
const cardHover = 'hover:bg-white/[0.05] hover:border-white/10 transition-all';
const btn = 'px-3 py-1.5 text-[11px] rounded-lg transition-all';
const btnGhost = `${btn} border border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70`;
const btnPrimary = `${btn} bg-purple-600 text-white hover:bg-purple-500`;
const btnDanger = `${btn} border border-red-500/30 text-red-400 hover:bg-red-500/10`;
const btnSuccess = `${btn} bg-emerald-600 text-white hover:bg-emerald-500`;
const muted = 'text-white/30';
const subtle = 'text-white/50';

function StatusBadge({ status }: { status: AgentStatus }) {
  const c: Record<AgentStatus, { label: string; bg: string; text: string; dot: string }> = {
    complete: { label: 'Complete', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    running: { label: 'Running', bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400 animate-pulse-dot' },
    waiting: { label: 'Waiting', bg: 'bg-white/5', text: 'text-white/25', dot: 'bg-white/20' },
    error: { label: 'Failed', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
    review: { label: 'Review', bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  };
  const s = c[status];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium', s.bg, s.text)}>
      <span className={clsx('w-[6px] h-[6px] rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

// ─── Error Box (matches wireframe) ───
function ErrorBox({ playbook, agentNum, onRerun, onViewPartial }: {
  playbook: Playbook; agentNum: number; onRerun: () => void; onViewPartial: () => void;
}) {
  const info = playbook.agents[agentNum as 1|2|3];
  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 my-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={14} className="text-red-400" />
        <span className="text-[12px] font-semibold text-red-400">Agent {agentNum} failed</span>
      </div>
      <p className="text-[11px] text-red-600 leading-relaxed mb-3">
        The LLM output may have been truncated or the API returned an error.
        {info?.tokens_out ? ` Received ${info.tokens_out.toLocaleString()} tokens before failure.` : ''}
        {' '}The partial response has been preserved for inspection.
      </p>
      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 font-mono text-[10px] text-red-300 leading-relaxed max-h-[80px] overflow-y-auto whitespace-pre-wrap mb-3">
{`Recovery options:
  1. Re-run Agent ${agentNum} (same prompt, retry)
  2. Edit prompt and re-run (adjust if prompt caused issue)
  3. View partial output (inspect what was generated before error)`}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className="px-3 py-1.5 text-[11px] border border-white/[0.06] rounded-lg text-white/50 hover:bg-white/[0.02] flex items-center gap-1" onClick={onViewPartial}>
          <Eye size={11} /> View partial output
        </button>
        <button className="px-3 py-1.5 text-[11px] bg-purple-600 text-white rounded-lg hover:bg-purple-500 flex items-center gap-1" onClick={onRerun}>
          <RotateCcw size={11} /> Re-run Agent {agentNum}
        </button>
        <button className="px-3 py-1.5 text-[11px] border border-red-500/20 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1">
          <FileText size={11} /> View full error log
        </button>
      </div>
    </div>
  );
}

// ─── Process Steps ───
function ProcessSteps({ playbook, agentNum }: { playbook: Playbook; agentNum: number }) {
  const status = playbook.agents[agentNum as 1|2|3]?.status ?? 'waiting';
  const isRunning = status === 'running';
  const isDone = status === 'complete' || status === 'review';
  const steps = [
    { label: 'Foundation prompt injected', done: isRunning || isDone },
    { label: agentNum === 1 ? 'Biomarker data + clinical history loaded' : `Agent ${agentNum - 1} handoff loaded`, done: isRunning || isDone },
    { label: 'Streaming output', active: isRunning, done: isDone },
    { label: `Parse Agent ${agentNum} response`, done: isDone },
    { label: 'Run quality gate checks', done: isDone },
    { label: 'Ready for review', done: isDone },
  ];
  return (
    <div className="border border-white/[0.06] rounded-lg p-3 mt-3 bg-white/[0.02]/50">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 py-1 text-[11px]">
          <span className="w-4 text-center">
            {s.done ? <span className="text-emerald-500">✓</span> : s.active ? <span className="text-blue-500">⚙</span> : <span className="text-white/20">○</span>}
          </span>
          <span className={clsx(s.done ? 'text-white/60' : s.active ? 'text-purple-400 font-medium' : 'text-white/30')}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Agent Card ───
function AgentCard({ playbook, agentNum, onRun, onApprove, onNext, isLastCompleted, onViewOutput }: {
  playbook: Playbook; agentNum: 1 | 2 | 3;
  onRun: (feedback?: string) => void; onApprove: (edits?: string) => void;
  onNext: () => void; isLastCompleted: boolean; onViewOutput?: () => void;
}) {
  const { streamingAgent, streamingText, streamingProgress } = usePipelineStore();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [handoffText, setHandoffText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [editingOutput, setEditingOutput] = useState(false);
  const [editedOutput, setEditedOutput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showRerunInput, setShowRerunInput] = useState(false);

  const info = playbook.agents[agentNum];
  const status = info?.status ?? 'waiting';
  const isStreaming = streamingAgent === agentNum;

  const names: Record<number, string> = { 1: 'Biomarker Analysis', 2: 'System Mapping', 3: 'Humanized Roadmap' };
  const models: Record<number, string> = { 1: 'Opus 4.6', 2: 'Sonnet 4', 3: 'Sonnet 4' };

  const loadPrompt = async () => {
    if (!showPrompt) {
      try { const d = await api.getPrompt(playbook.run_id, agentNum); setPromptText(d.prompt); }
      catch { setPromptText('Prompt not yet available.'); }
    }
    setShowPrompt(!showPrompt);
  };
  const loadHandoff = async () => {
    if (!showHandoff) {
      try { const r: any = await api.getOutput(playbook.run_id, agentNum); setHandoffText(r.raw_preview || 'No handoff data.'); }
      catch { setHandoffText('Not available.'); }
    }
    setShowHandoff(!showHandoff);
  };
  const loadOutput = async () => {
    if (!showOutput) {
      try { const r: any = await api.getOutput(playbook.run_id, agentNum); const t = r.raw_preview || JSON.stringify(r.parsed, null, 2) || 'No output.'; setOutputText(t); setEditedOutput(t); }
      catch { setOutputText('Not available.'); }
    }
    setShowOutput(!showOutput);
  };

  return (
    <div className={clsx(
      'glass p-4 mb-3 transition-all duration-300',
      isStreaming ? 'border-purple-500/30 glow-purple' :
      status === 'review' ? 'border-amber-500/25 glow-amber' :
      status === 'complete' ? 'border-emerald-500/20' :
      status === 'error' ? 'border-red-500/25' :
      '',
      status === 'waiting' && agentNum > 1 && 'opacity-40'
    )}>
      {/* Header */}
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-white/90">Agent {agentNum}: {names[agentNum]}</span>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Token/cost info */}
      <div className="text-[11px] text-white/30 flex gap-3 mt-1">
        <span>{models[agentNum]}</span>
        {info?.tokens_in ? <span>{info.tokens_in.toLocaleString()} in</span> : null}
        {info?.tokens_out ? <span>{info.tokens_out.toLocaleString()} out</span> : null}
        {info?.cost ? <span className="text-emerald-600 font-medium">${info.cost.toFixed(2)}</span> : null}
        {(info as any)?.cost_inr ? <span className="text-amber-400">₹{(info as any).cost_inr.toFixed(0)}</span> : null}
      </div>

      {/* Error state */}
      {status === 'error' && (
        <ErrorBox playbook={playbook} agentNum={agentNum} onRerun={() => onRun()} onViewPartial={loadOutput} />
      )}

      {/* Streaming */}
      {isStreaming && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-purple-400 font-medium">Streaming output...</span>
            <span className="text-[10px] text-white/30">{Math.round(streamingProgress)}%</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${streamingProgress}%` }} />
          </div>
          <div className="bg-black/40 text-white/80 rounded-lg p-3 font-mono text-[10px] leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-wrap mt-2">
            {streamingText}<span className="streaming-cursor" />
          </div>
          <ProcessSteps playbook={playbook} agentNum={agentNum} />
        </div>
      )}

      {/* Collapsible sections */}
      {showPrompt && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-white/60">Prompt ({promptText.length.toLocaleString()} chars, ~{Math.round(promptText.length/4).toLocaleString()} tokens)</span>
            <button className="text-[10px] text-white/30 hover:text-white/60" onClick={() => setShowPrompt(false)}>Close</button>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 font-mono text-[10px] leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-wrap text-white/60">{promptText}</div>
        </div>
      )}
      {showHandoff && (
        <div className="mt-3">
          <div className="flex justify-between mb-1"><span className="text-[11px] font-medium text-white/60">Handoff Block</span><button className="text-[10px] text-white/30" onClick={() => setShowHandoff(false)}>Close</button></div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 font-mono text-[10px] leading-relaxed max-h-[150px] overflow-y-auto whitespace-pre-wrap text-white/60">{handoffText}</div>
        </div>
      )}
      {showOutput && (
        <div className="mt-3">
          <div className="flex justify-between mb-1">
            <span className="text-[11px] font-medium text-white/60">Agent Output</span>
            <div className="flex gap-2">
              {!editingOutput && <button className="text-[10px] text-purple-400 flex items-center gap-1" onClick={() => setEditingOutput(true)}><Edit3 size={10} /> Edit</button>}
              <button className="text-[10px] text-white/30" onClick={() => { setShowOutput(false); setEditingOutput(false); }}>Close</button>
            </div>
          </div>
          {editingOutput ? (
            <div>
              <textarea className="w-full min-h-[200px] font-mono text-[10px] p-3 border border-blue-200 rounded-lg" value={editedOutput} onChange={(e) => setEditedOutput(e.target.value)} />
              <div className="flex gap-2 mt-2 justify-end">
                <button className="px-3 py-1.5 text-[11px] border border-white/[0.06] rounded-lg text-white/50" onClick={() => { setEditingOutput(false); setEditedOutput(outputText); }}>Cancel</button>
                <button className="px-3 py-1.5 text-[11px] bg-purple-600 text-white rounded-lg" onClick={() => { onApprove(editedOutput); setEditingOutput(false); setShowOutput(false); }}>Save & Approve</button>
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 font-mono text-[10px] leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-wrap text-white/60">{outputText}</div>
          )}
        </div>
      )}
      {showRerunInput && (
        <div className="mt-3 p-3 bg-red-50 border border-red-500/20 rounded-lg">
          <label className="text-[11px] font-medium text-red-400 block mb-1">Feedback for re-run:</label>
          <textarea className="w-full min-h-[60px] font-mono text-[10px] p-2 border border-red-500/20 rounded bg-white/5" placeholder="Describe what to fix..." value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          <div className="flex gap-2 mt-2 justify-end">
            <button className="px-3 py-1.5 text-[11px] border border-white/[0.06] rounded-lg text-white/50" onClick={() => setShowRerunInput(false)}>Cancel</button>
            <button className="px-3 py-1.5 text-[11px] bg-red-600 text-white rounded-lg" onClick={() => { onRun(feedback); setShowRerunInput(false); setFeedback(''); }}>Re-run with feedback</button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap mt-3">
        <button className="px-3 py-1.5 text-[11px] border border-white/[0.06] rounded-lg text-white/50 hover:bg-white/[0.02] flex items-center gap-1" onClick={loadPrompt}><Eye size={11} /> Prompt</button>
        {(status === 'complete' || status === 'review') && (
          <>
            <button className="px-3 py-1.5 text-[11px] bg-blue-50 border border-blue-200 rounded-lg text-purple-400 hover:bg-blue-100 flex items-center gap-1" onClick={onViewOutput}><Eye size={11} /> View in Sheets</button>
            <button className="px-3 py-1.5 text-[11px] border border-white/[0.06] rounded-lg text-white/50 hover:bg-white/[0.02] flex items-center gap-1" onClick={loadHandoff}><Eye size={11} /> Handoff</button>
            <button className="px-3 py-1.5 text-[11px] border border-white/[0.06] rounded-lg text-white/50 hover:bg-white/[0.02]" onClick={() => setShowSteps(!showSteps)}>Steps</button>
          </>
        )}

        {/* First run: show Run Agent N only if waiting and previous agent is done */}
        {status === 'waiting' && (
          <button className="px-3 py-1.5 text-[11px] bg-purple-600 text-white rounded-lg hover:bg-purple-500 flex items-center gap-1" onClick={() => onRun()}><Play size={11} /> Run Agent {agentNum}</button>
        )}

        {/* Error: allow retry */}
        {status === 'error' && (
          <button className="px-3 py-1.5 text-[11px] bg-purple-600 text-white rounded-lg hover:bg-purple-500 flex items-center gap-1" onClick={() => onRun()}><RotateCcw size={11} /> Retry Agent {agentNum}</button>
        )}

        {/* Review: approve or re-run */}
        {status === 'review' && (
          <>
            <button className="px-3 py-1.5 text-[11px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1" onClick={() => onApprove()}><Check size={11} /> Approve</button>
            <button className="px-3 py-1.5 text-[11px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1" onClick={() => setShowRerunInput(true)}><RotateCcw size={11} /> Re-run</button>
          </>
        )}

        {/* Complete: only re-run (fetches fresh handoff from previous agent) */}
        {status === 'complete' && (
          <button className="px-3 py-1.5 text-[11px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1" onClick={() => setShowRerunInput(true)}><RotateCcw size={11} /> Re-run</button>
        )}

        {isStreaming && <button className="px-3 py-1.5 text-[11px] border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-50 flex items-center gap-1"><X size={11} /> Cancel</button>}
      </div>
      {showSteps && !isStreaming && <ProcessSteps playbook={playbook} agentNum={agentNum} />}
    </div>
  );
}

// ─── Export Complete View ───
function ExportComplete({ playbook }: { playbook: Playbook }) {
  const cost = (playbook as any).cost_tracking || {};
  const agents = cost.agents || {};
  const totalUsd = cost.total_cost_usd || 0;
  const totalInr = cost.total_cost_inr || 0;
  const totalTokens = (cost.total_input_tokens || 0) + (cost.total_output_tokens || 0);

  const sheets = [
    { n: 1, agent: 'Parser', content: `Input summary (member + ${playbook.markers_total || '—'} markers)`, status: 'Ready' },
    { n: 2, agent: 'Upload', content: `Raw biomarkers (${playbook.markers_total || '—'} markers)`, status: 'Ready' },
    { n: 3, agent: 'Agent 1', content: '25-section analysis + cluster analysis', status: 'Approved' },
    { n: 4, agent: 'Agent 2', content: '9 FOXO systems mapping', status: 'Approved' },
    { n: 5, agent: 'Agent 3', content: '3 phases + biweekly cards + supplements', status: 'Approved' },
  ];

  return (
    <div>
      {/* Success card */}
      <div className="glass border-emerald-500/20 p-5 mb-4 glow-green">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 text-lg font-semibold">✓</div>
          <div>
            <div className="text-base font-semibold">{playbook.member.name} — playbook complete</div>
            <div className="text-[11px] text-white/30">All 3 agents approved. 5 sheets generated.</div>
          </div>
        </div>

        {/* Cost summary */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-white/[0.02] rounded-lg p-3 text-center">
            <div className="text-lg font-semibold">${totalUsd.toFixed(2)}</div>
            <div className="text-[10px] text-white/30">Total cost (₹{totalInr.toFixed(0)})</div>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3 text-center">
            <div className="text-lg font-semibold">{totalTokens > 0 ? `${(totalTokens/1000).toFixed(0)}K` : '—'}</div>
            <div className="text-[10px] text-white/30">Total tokens</div>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3 text-center">
            <div className="text-lg font-semibold">{playbook.markers_total || '—'}</div>
            <div className="text-[10px] text-white/30">Markers analyzed</div>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3 text-center">
            <div className="text-lg font-semibold">30</div>
            <div className="text-[10px] text-white/30">Biweekly cards</div>
          </div>
        </div>

        {/* Sheet table */}
        <div className="overflow-hidden rounded-lg border border-white/[0.06] mb-4">
          <table className="w-full text-[11px]">
            <thead><tr className="bg-white/[0.02] border-b border-white/[0.06]">
              <th className="text-left p-2.5 font-semibold text-white/50">Sheet</th>
              <th className="text-left p-2.5 font-semibold text-white/50">Agent</th>
              <th className="text-left p-2.5 font-semibold text-white/50">Content</th>
              <th className="text-left p-2.5 font-semibold text-white/50">Status</th>
            </tr></thead>
            <tbody>
              {sheets.map((s) => (
                <tr key={s.n} className="border-b border-white/[0.04] last:border-0">
                  <td className="p-2.5 font-medium">Sheet {s.n}</td>
                  <td className="p-2.5 text-white/50">{s.agent}</td>
                  <td className="p-2.5 text-white/50">{s.content}</td>
                  <td className="p-2.5"><span className="bg-emerald-50 text-emerald-400 text-[9px] font-medium px-2 py-0.5 rounded-full">{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Download buttons */}
        <div className="flex gap-3 flex-wrap">
          <a href={api.exportXlsx(playbook.run_id)} className="flex items-center gap-2 px-4 py-2.5 border border-white/[0.06] rounded-lg text-[12px] hover:border-purple-500/30 hover:bg-blue-50/30 transition">
            <Download size={14} /> Download full playbook (.xlsx)
          </a>
          <button className="flex items-center gap-2 px-4 py-2.5 border border-white/[0.06] rounded-lg text-[12px] hover:border-purple-500/30 hover:bg-blue-50/30 transition">
            <Download size={14} /> Download logs (.json)
          </button>
        </div>
      </div>

      {/* Agent cost breakdown */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <h3 className="text-[13px] font-semibold mb-3">Pipeline Summary</h3>
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          <table className="w-full text-[11px]">
            <thead><tr className="bg-white/[0.02] border-b border-white/[0.06]">
              <th className="text-left p-2.5 font-semibold text-white/50">Agent</th>
              <th className="text-left p-2.5 font-semibold text-white/50">Model</th>
              <th className="text-right p-2.5 font-semibold text-white/50">Tokens</th>
              <th className="text-right p-2.5 font-semibold text-white/50">Cost (USD)</th>
              <th className="text-right p-2.5 font-semibold text-white/50">Cost (INR)</th>
            </tr></thead>
            <tbody>
              {[1, 2, 3].map((n) => {
                const ac = agents[n] || {};
                return (
                  <tr key={n} className="border-b border-white/[0.04]">
                    <td className="p-2.5 font-medium">Agent {n}</td>
                    <td className="p-2.5 text-white/50 font-mono text-[10px]">{ac.model || '—'}</td>
                    <td className="p-2.5 text-right text-white/50">{ac.input_tokens ? `${ac.input_tokens.toLocaleString()} in / ${ac.output_tokens?.toLocaleString()} out` : '—'}</td>
                    <td className="p-2.5 text-right text-emerald-600 font-medium">{ac.total_cost_usd ? `$${ac.total_cost_usd.toFixed(2)}` : '—'}</td>
                    <td className="p-2.5 text-right text-amber-400">{ac.total_cost_inr ? `₹${ac.total_cost_inr.toFixed(0)}` : '—'}</td>
                  </tr>
                );
              })}
              <tr className="bg-white/[0.02] font-semibold">
                <td className="p-2.5" colSpan={2}>Total</td>
                <td className="p-2.5 text-right">{totalTokens > 0 ? `${totalTokens.toLocaleString()}` : '—'}</td>
                <td className="p-2.5 text-right text-emerald-600">${totalUsd.toFixed(2)}</td>
                <td className="p-2.5 text-right text-amber-400">₹{totalInr.toFixed(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Sheets Tab ───
// ─── Sheet 4: System Mapping (full wireframe view) ───
// ─── Sheet 5: Roadmap (FOXO Playbook view) ───
function Sheet5Roadmap({ data }: { data: any }) {
  const [view, setView] = useState<'phases'|'biweekly'>('phases');
  const [activeComp, setActiveComp] = useState(0);
  const [activePeriod, setActivePeriod] = useState(0);
  const [expandedPhase, setExpandedPhase] = useState<Set<number>>(new Set([0]));
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  if (!data.available) {
    return <div className="text-center py-16 text-white/30 text-[12px] glass">Run Agent 3 to generate Sheet 5 roadmap.</div>;
  }

  const phases = data.phases || [];
  const biweekly = data.biweekly || {};
  const periods = ['Week 1-2', 'Week 3-4', 'Week 5-6', 'Week 7-8', 'Week 9-10', 'Week 11-12'];
  const components = [
    { key: 'nutrition', label: 'Nutrition' },
    { key: 'physical_activity', label: 'Physical Activity' },
    { key: 'stress', label: 'Stress Management' },
    { key: 'sleep', label: 'Sleep' },
    { key: 'supplements', label: 'Supplements' },
  ];

  const togglePhase = (i: number) => {
    const next = new Set(expandedPhase);
    if (next.has(i)) next.delete(i); else next.add(i);
    setExpandedPhase(next);
  };

  const currentCard = (biweekly[components[activeComp]?.key] || [])[activePeriod] || {};

  return (
    <div className="animate-fade-in">
      {/* FOXO Header */}
      <div className="glass p-4 mb-3" style={{ borderColor: 'rgba(74,222,128,0.15)' }}>
        <div className="text-[16px] font-bold tracking-wider" style={{ color: '#4ade80' }}>FOXO PLAYBOOK</div>
        <div className="text-[10px] text-white/25 mt-0.5">Sheet 5 — Humanized Roadmap + Protocol · 30/30 cards</div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] mb-4">
        <button className={clsx('px-4 py-2.5 text-[12px] border-b-2 transition', view==='phases' ? 'text-emerald-400 border-emerald-400 font-medium' : 'text-white/30 border-transparent hover:text-white/50')} onClick={() => setView('phases')}>Part A: Phase Roadmap</button>
        <button className={clsx('px-4 py-2.5 text-[12px] border-b-2 transition', view==='biweekly' ? 'text-emerald-400 border-emerald-400 font-medium' : 'text-white/30 border-transparent hover:text-white/50')} onClick={() => setView('biweekly')}>Part B: Biweekly Cards</button>
      </div>

      {/* Part A: Expandable phase cards */}
      {view === 'phases' && (
        <div>
          {phases.map((p: any, i: number) => {
            const isOpen = expandedPhase.has(i);
            const badges = ['Active','Upcoming','Future'];
            const badgeColors = ['bg-purple-500/15 text-purple-400','bg-white/5 text-white/25','bg-white/5 text-white/20'];
            return (
              <div key={i} className="glass mb-2 overflow-hidden">
                <div className="flex justify-between items-center px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition" onClick={() => togglePhase(i)}>
                  <div>
                    <div className="text-[14px] font-medium text-white/85">Phase {i+1}: {p.name} ({p.months})</div>
                    <div className="text-[10px] text-white/25 mt-0.5">{['Restoration and stabilisation','Repair and rebuild','Optimise and sustain'][i]}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx('text-[9px] font-medium px-2.5 py-0.5 rounded-full', badgeColors[i])}>{badges[i]}</span>
                    <span className={clsx('text-white/20 text-[11px] transition-transform duration-200', isOpen && 'rotate-180')}>▾</span>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-white/[0.04] px-4 py-4 animate-fade-in">
                    {p.objective && <div className="text-[11px] text-white/50 leading-[1.7] mb-4">{p.objective}</div>}
                    {!p.objective && p.content && <div className="text-[11px] text-white/50 leading-[1.7] mb-4">{p.content}</div>}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'nutrition', label: 'Nutrition' },
                        { key: 'physical_activity', label: 'Physical Activity' },
                        { key: 'stress', label: 'Stress' },
                        { key: 'sleep', label: 'Sleep' },
                      ].map((col) => (
                        <div key={col.key} className="glass p-3">
                          <div className="text-[9px] font-semibold text-white/30 uppercase tracking-wider mb-2 pb-1.5 border-b border-white/[0.04]">{col.label}</div>
                          <div className="text-[10px] text-white/40 leading-relaxed">{p[col.key] || `Protocol details for ${col.label.toLowerCase()} in Phase ${i+1}.`}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Part B: Component tabs + period selector + full card */}
      {view === 'biweekly' && (
        <div>
          {/* Component tabs */}
          <div className="flex border-b border-white/[0.06] mb-3">
            {components.map((c, i) => (
              <button key={c.key} className={clsx('px-3.5 py-2 text-[11px] border-b-2 transition',
                activeComp === i ? 'text-purple-400 border-purple-400 font-medium' : 'text-white/30 border-transparent hover:text-white/50'
              )} onClick={() => { setActiveComp(i); setActivePeriod(0); }}>{c.label}</button>
            ))}
          </div>

          {/* Period selector */}
          <div className="flex gap-1.5 mb-4">
            {periods.map((p, i) => (
              <button key={i} className={clsx('px-3.5 py-1.5 rounded-xl text-[11px] transition-all',
                activePeriod === i ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 font-medium' : 'glass text-white/30 hover:text-white/50'
              )} onClick={() => setActivePeriod(i)}>{p}</button>
            ))}
          </div>

          {/* Full card render */}
          <div className="glass p-5 animate-fade-in">
            {currentCard.title ? (
              <>
                <div className="text-[15px] font-semibold text-white/85 mb-1">{currentCard.title}</div>
                {currentCard.intro && <div className="text-[12px] text-purple-400 font-medium mb-3">{currentCard.intro}</div>}

                {currentCard.foxo_impact && (
                  <div className="mb-4">
                    <div className="text-[9px] font-semibold text-white/25 uppercase tracking-wider pb-2 mb-2 border-b border-white/[0.04]">Potential FOXO System Impact</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {currentCard.foxo_impact.split(/[,;]/).filter(Boolean).map((s: string, j: number) => (
                        <span key={j} className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-red-500/10 text-red-400">{s.trim()} ↓</span>
                      ))}
                    </div>
                  </div>
                )}

                {currentCard.why_it_works?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[9px] font-semibold text-white/25 uppercase tracking-wider pb-2 mb-2 border-b border-white/[0.04]">Why It Works</div>
                    {currentCard.why_it_works.map((w: string, j: number) => (
                      <div key={j} className="text-[11px] text-white/50 leading-[1.7] mb-1.5 pl-4 relative">
                        <span className="absolute left-0 top-[8px] w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}

                {currentCard.how_to_practice?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[9px] font-semibold text-white/25 uppercase tracking-wider pb-2 mb-2 border-b border-white/[0.04]">How To Put It Into Practice</div>
                    {currentCard.how_to_practice.map((h: string, j: number) => (
                      <div key={j} className="text-[11px] text-white/50 leading-[1.7] mb-1 pl-4 relative">
                        <span className="absolute left-1 top-[8px] w-1.5 h-[1.5px] bg-white/20" />
                        {h}
                      </div>
                    ))}
                  </div>
                )}

                {currentCard.what_to_expect && (
                  <div>
                    <div className="text-[9px] font-semibold text-white/25 uppercase tracking-wider pb-2 mb-2 border-b border-white/[0.04]">What To Expect</div>
                    <div className="text-[11px] text-white/40 italic bg-white/[0.02] rounded-xl p-4 leading-[1.7]">{currentCard.what_to_expect}</div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-white/20 text-[12px]">
                Card for {components[activeComp]?.label} — {periods[activePeriod]}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Sheet4Systems({ systems, available }: { systems: any[]; available: boolean }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [viewMode, setViewMode] = useState<'view'|'edit'|'compact'>('view');
  const [editData, setEditData] = useState<Record<string, string>>({});

  if (!available || systems.length === 0) {
    return <div className="text-center py-16 text-white/30 text-[12px] glass">Run Agent 2 to generate Sheet 4 systems.</div>;
  }

  const toggle = (i: number) => {
    const next = new Set(expanded);
    if (next.has(i)) next.delete(i); else next.add(i);
    setExpanded(next);
  };

  const stateColor = (s: string) => {
    if (s === 'STRAINED') return { bg: 'bg-red-500/15', text: 'text-red-400', num: 'bg-red-500' };
    if (s === 'COMPENSATING') return { bg: 'bg-amber-500/15', text: 'text-amber-400', num: 'bg-amber-500' };
    return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', num: 'bg-emerald-500' };
  };

  const charRange: Record<string, [number, number]> = {
    key_insights: [1200, 1800], root_cause: [590, 1450],
    clinical_implications: [270, 830], clarity_card: [730, 850],
  };

  const charBadge = (field: string, len: number) => {
    const range = charRange[field];
    if (!range) return null;
    const [min, max] = range;
    const status = len >= min && len <= max ? 'ok' : len > max ? 'over' : 'under';
    const colors = { ok: 'bg-emerald-500/15 text-emerald-400', over: 'bg-red-500/15 text-red-400', under: 'bg-amber-500/15 text-amber-400' };
    return (
      <span className="flex items-center gap-1.5">
        <span className={clsx('text-[9px] px-1.5 py-0 rounded', colors[status])}>{len.toLocaleString()}</span>
        <span className="text-[8px] text-white/20">{min}-{max}</span>
      </span>
    );
  };

  const colLabels: Record<string, string> = {
    key_insights: 'Key Insights', root_cause: 'Root Cause Analysis',
    clinical_implications: 'Clinical Implications', clarity_card: 'Clarity Card',
  };

  const subLabels: Record<string, string> = {
    1: 'Metabolism + mitochondrial', 2: 'Inflammation + immune load', 3: 'Muscle, bone, connective tissue',
    4: 'Sex hormones + adrenal', 5: 'Brain + neurological', 6: 'Digestive + microbiome',
    7: 'Lipid + vascular', 8: 'Mitochondrial efficiency', 9: 'Liver + detox pathways',
  };

  // Quality gate summary
  const totalChecks = systems.length * 4;
  const warnings = systems.reduce((n, s) => {
    let w = 0;
    for (const f of ['key_insights', 'root_cause', 'clinical_implications', 'clarity_card']) {
      const len = (s[f] || '').length;
      const [min, max] = charRange[f] || [0, 99999];
      if (len > 0 && (len < min || len > max)) w++;
    }
    return n + w;
  }, 0);
  const passed = totalChecks - warnings;

  const getEditValue = (sysIdx: number, field: string) => {
    const key = `${sysIdx}.${field}`;
    return editData[key] !== undefined ? editData[key] : systems[sysIdx]?.[field] || '';
  };

  return (
    <div className="animate-fade-in">
      {/* Quality gate bar */}
      <div className="glass flex items-center gap-4 px-4 py-2.5 mb-3 text-[11px]">
        <span className="font-medium text-white/50">Quality gates:</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="font-medium text-emerald-400">{passed}</span> passed</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span className="font-medium text-amber-400">{warnings}</span> warnings</span>
        <span className="flex-1" />
        <span className="text-white/25">{systems.length}/9 systems</span>
      </div>

      {/* View mode switcher */}
      <div className="flex gap-0 mb-3 glass overflow-hidden" style={{ padding: 0 }}>
        {(['view', 'edit', 'compact'] as const).map(m => (
          <button key={m} className={clsx('px-4 py-2 text-[10px] capitalize transition-all',
            viewMode === m ? 'bg-purple-500/15 text-purple-400 font-medium' : 'text-white/30 hover:text-white/50'
          )} onClick={() => {
            setViewMode(m);
            if (m === 'compact') setExpanded(new Set());
            if (m === 'view' || m === 'edit') { if (expanded.size === 0) setExpanded(new Set([0])); }
          }}>{m} mode</button>
        ))}
      </div>

      {/* Systems */}
      {systems.map((sys, i) => {
        const isOpen = expanded.has(i);
        const sc = stateColor(sys.state);
        const protocolMap: Record<string, string> = { STABLE: 'Maintain', COMPENSATING: 'Support', STRAINED: 'Correct', FAILED: 'Protect' };
        const protocol = protocolMap[sys.state] || '—';

        return (
          <div key={i} className="glass mb-2 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition" onClick={() => toggle(i)}>
              <div className="flex items-center gap-3">
                <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white', sc.num)}>{sys.number || i+1}</div>
                <div>
                  <div className="text-[13px] font-medium text-white/85">{sys.name}</div>
                  <div className="text-[10px] text-white/25">{subLabels[sys.number || i+1] || ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('text-[9px] font-medium px-2.5 py-0.5 rounded-full', sc.bg, sc.text)}>{sys.state}</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/30">{protocol}</span>
                <span className={clsx('text-white/25 text-[11px] transition-transform duration-200', isOpen && 'rotate-180')}>&#9662;</span>
              </div>
            </div>

            {/* Body */}
            {isOpen && (
              <div className="border-t border-white/[0.04] px-4 py-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  {(['key_insights', 'root_cause', 'clinical_implications', 'clarity_card'] as const).map(field => {
                    const content = getEditValue(i, field);
                    const len = content.length;
                    const [min, max] = charRange[field] || [0, 99999];
                    const isOver = len > 0 && len > max;

                    return (
                      <div key={field} className={clsx('glass p-3', isOver && 'border-amber-500/25')}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">{colLabels[field]}</span>
                          {charBadge(field, len)}
                        </div>
                        {viewMode === 'edit' ? (
                          <textarea
                            className="w-full min-h-[120px] text-[10px] leading-relaxed p-2 rounded-lg bg-white/[0.03] border border-purple-500/20 text-white/70 focus:border-purple-500/40"
                            value={content}
                            onChange={(e) => setEditData(prev => ({ ...prev, [`${i}.${field}`]: e.target.value }))}
                          />
                        ) : (
                          <div className={clsx('text-[10px] leading-relaxed max-h-[140px] overflow-y-auto',
                            field === 'clarity_card' ? 'text-purple-300/70' : 'text-white/50'
                          )}>
                            {content || <span className="text-white/15 italic">No content</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Per-system actions */}
                <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-white/[0.04]">
                  <button className="px-3 py-1 text-[10px] rounded-lg border border-white/10 text-white/30 hover:bg-white/5 transition">View source clusters</button>
                  {viewMode === 'edit' && <button className="px-3 py-1 text-[10px] rounded-lg border border-white/10 text-white/30 hover:bg-white/5 transition" onClick={() => {
                    const keys = Object.keys(editData).filter(k => k.startsWith(`${i}.`));
                    const next = { ...editData };
                    keys.forEach(k => delete next[k]);
                    setEditData(next);
                  }}>Reset to original</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Footer */}
      {/* Summary bar */}
      <div className="text-[10px] text-white/20 pt-3 mt-2 border-t border-white/[0.04]">
        {systems.length} systems | {systems.filter(s => s.state === 'STRAINED').length} strained | {warnings} char-range warnings
      </div>
    </div>
  );
}

function SheetsTab({ playbook }: { playbook: Playbook }) {
  const { activeSheet, setSheet } = usePipelineStore();
  const [sheetData, setSheetData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const sheets = ['Input Summary', 'Raw Biomarkers', 'Analysis', 'Systems', 'Roadmap'];

  useEffect(() => {
    setLoading(true);
    setEditMode(false);
    api.getSheet(playbook.run_id, activeSheet).then(setSheetData).catch(() => setSheetData(null)).finally(() => setLoading(false));
  }, [playbook.run_id, activeSheet]);

  const statusColor = (s: string) => {
    if (!s) return 'bg-white/5 text-white/30';
    const sl = s.toLowerCase();
    if (sl === 'optimal') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    if (sl === 'low') return 'bg-red-500/20 text-red-400 border border-red-500/30';
    if (sl === 'high' || sl === 'elevated') return 'bg-red-500/20 text-red-400 border border-red-500/30';
    if (sl === 'low normal') return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    if (sl === 'high normal') return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    if (sl.includes('normal')) return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    return 'bg-white/5 text-white/30';
  };

  const startEdit = (cellId: string, currentValue: string) => {
    setEditingCell(cellId);
    setEditValue(currentValue);
  };

  const saveEdit = (cellId: string) => {
    // Update local state
    if (sheetData?.markers) {
      const [idx, field] = cellId.split('.');
      const updated = [...sheetData.markers];
      updated[parseInt(idx)] = { ...updated[parseInt(idx)], [field]: editValue };
      setSheetData({ ...sheetData, markers: updated });
    }
    setEditingCell(null);
  };

  const EditableCell = ({ cellId, value, className: cn }: { cellId: string; value: string; className?: string }) => {
    if (editingCell === cellId) {
      return <input autoFocus className="w-full text-[10px] p-1 border border-purple-500/30 rounded" value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => saveEdit(cellId)}
        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(cellId); if (e.key === 'Escape') setEditingCell(null); }} />;
    }
    return <span className={clsx(cn, editMode && 'cursor-pointer hover:bg-blue-50 px-1 rounded')} onClick={() => editMode && startEdit(cellId, value || '')}>{value}</span>;
  };

  return (
    <div>
      <div className="flex border-b border-white/[0.06] mb-4">
        {sheets.map((s, i) => (
          <button key={i} className={clsx('px-4 py-2.5 text-[12px] border-b-2 transition', activeSheet === i+1 ? 'text-purple-400 border-blue-600 font-medium' : 'text-white/30 border-transparent hover:text-white/60')} onClick={() => setSheet(i+1)}>Sheet {i+1}: {s}</button>
        ))}
      </div>
      <div className="flex gap-2 mb-4 items-center">
        <button className={clsx('px-3 py-1.5 text-[11px] rounded-lg flex items-center gap-1', editMode ? 'bg-purple-600 text-white' : 'border border-white/[0.06] text-white/50 hover:bg-white/[0.02]')} onClick={() => setEditMode(!editMode)}>
          <Edit3 size={11} /> {editMode ? 'Done Editing' : 'Edit'}
        </button>
        <a href={api.exportXlsx(playbook.run_id)} download className="px-3 py-1.5 text-[11px] border border-white/[0.06] rounded-lg text-white/50 hover:bg-white/[0.02] flex items-center gap-1"><Download size={11} /> Download All Sheets</a>
      </div>
      {editMode && <div className="text-[10px] text-purple-400 bg-blue-50 rounded-lg px-3 py-2 mb-3">Click any cell to edit. Press Enter to save, Escape to cancel.</div>}

      {loading && <div className="text-center py-8"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>}

      {!loading && sheetData && activeSheet === 1 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Member</div>
            <div className="text-[14px] font-semibold">{sheetData.member?.name || '—'}</div>
            <div className="text-[11px] text-white/50 mt-1">
              {sheetData.member?.age}{sheetData.member?.sex?.[0]}, {sheetData.member?.location || '—'}, {sheetData.member?.occupation || '—'}
              {sheetData.member?.height ? `, ${sheetData.member.height}cm` : ''}
              {sheetData.member?.weight ? `, ${sheetData.member.weight}kg` : ''}
            </div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Markers</div>
            <div className="text-[14px] font-semibold">{sheetData.markers_total} total / {sheetData.markers_non_optimal} non-optimal</div>
            <div className="text-[11px] text-white/50 mt-1">
              {Object.entries(sheetData.status_counts || {}).map(([k, v]) => `${v} ${k}`).join(', ')}
            </div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Clinical History</div>
            <div className="text-[14px] font-semibold">{sheetData.clinical_words?.toLocaleString()} words</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Symptoms</div>
            <div className="text-[14px] font-semibold">{sheetData.symptoms_chars?.toLocaleString()} chars</div>
          </div>
        </div>
      )}

      {!loading && sheetData && activeSheet === 2 && (
        <div>
          <div className="text-[11px] text-white/40 mb-3">{sheetData.total} markers (source of truth)</div>
          <div className="glass overflow-hidden max-h-[600px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ backdropFilter: 'blur(20px)', background: 'rgba(12,10,19,0.9)' }}>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left p-3 font-semibold text-white/40 text-[10px] uppercase tracking-wider">Biomarker</th>
                  <th className="text-left p-3 font-semibold text-white/40 text-[10px] uppercase tracking-wider">Value</th>
                  <th className="text-left p-3 font-semibold text-white/40 text-[10px] uppercase tracking-wider">Optimal Range</th>
                  <th className="text-left p-3 font-semibold text-white/40 text-[10px] uppercase tracking-wider">Status</th>
                  <th className="text-left p-3 font-semibold text-white/40 text-[10px] uppercase tracking-wider">Section</th>
                </tr>
              </thead>
              <tbody>
                {(sheetData.markers || []).map((m: any, i: number) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 font-medium text-white/80">{m.biomarker}</td>
                    <td className="p-3 text-white/70 font-mono text-[11px]">{m.value}</td>
                    <td className="p-3 text-white/35 font-mono text-[10px]">{m.optimal_range}</td>
                    <td className="p-3"><span className={clsx('text-[9px] font-semibold px-2.5 py-1 rounded-lg inline-block', statusColor(m.severity || m.status))}>{m.severity || m.status}</span></td>
                    <td className="p-3 text-white/25 text-[10px]">{m.section}</td>
                  </tr>
                ))}
                {(!sheetData.markers || sheetData.markers.length === 0) && (
                  <tr><td colSpan={5} className="text-center py-8 text-white/30">No biomarker data available yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && sheetData && activeSheet === 3 && (
        <div>
          {sheetData.available ? (
            (sheetData.sections || []).map((s: any, i: number) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-3">
                <div className="text-[12px] font-semibold mb-2">{s.name}</div>
                {(s.markers || []).length > 0 ? (
                  <table className="w-full text-[10px]">
                    <thead><tr className="bg-white/[0.02]"><th className="text-left p-1.5">Biomarker</th><th className="text-left p-1.5">Value</th><th className="text-left p-1.5">Range</th><th className="text-left p-1.5">Status</th><th className="text-left p-1.5 w-[40%]">Implication</th></tr></thead>
                    <tbody>{s.markers.map((m: any, j: number) => (
                      <tr key={j} className="border-b border-gray-50">
                        <td className="p-1.5">{m.biomarker}</td>
                        <td className="p-1.5">{m.value_with_units}</td>
                        <td className="p-1.5">{m.optimal_range}</td>
                        <td className="p-1.5"><span className={clsx('text-[8px] px-1.5 py-0.5 rounded-full', statusColor(m.status))}>{m.status}</span></td>
                        <td className="p-1.5 text-white/50 text-[9px] leading-relaxed">
                          <EditableCell cellId={`s3-${i}-${j}.implication`} value={m.implication} />
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : <div className="text-[11px] text-white/30">No markers in this section.</div>}
              </div>
            ))
          ) : <div className="text-center py-16 text-white/30 text-[12px] bg-white/[0.02] rounded-xl border border-dashed border-white/[0.06]">Run Agent 1 to generate Sheet 3 analysis.</div>}
        </div>
      )}

      {!loading && sheetData && activeSheet === 4 && (
        <Sheet4Systems systems={sheetData.systems || []} available={sheetData.available} />
      )}

      {!loading && sheetData && activeSheet === 5 && (
        <Sheet5Roadmap data={sheetData} />
      )}

      {!loading && !sheetData && (
        <div className="text-center py-16 text-white/30 text-[12px] bg-white/[0.02] rounded-xl border border-dashed border-white/[0.06]">
          Unable to load sheet data.
        </div>
      )}
    </div>
  );
}

// ─── Logs Tab ───
function LogsTab({ playbook }: { playbook: Playbook }) {
  const { logs, setLogs } = usePipelineStore();
  const [levelFilter, setLevelFilter] = useState('INFO');
  const [agentFilter, setAgentFilter] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    api.getLogs(playbook.run_id, levelFilter, agentFilter).then((d: any) => setLogs(Array.isArray(d) ? d : d.entries || [])).catch(console.error);
  }, [playbook.run_id, levelFilter, agentFilter, setLogs]);

  const filtered = logs.filter((l) => !search || l.message.toLowerCase().includes(search.toLowerCase()) || l.category?.toLowerCase().includes(search.toLowerCase()));
  const grouped = filtered.reduce<Record<string, LogEntry[]>>((acc, log) => { const c = log.category || 'general'; if (!acc[c]) acc[c] = []; acc[c].push(log); return acc; }, {});
  const levelStyles: Record<string, string> = { INFO: 'bg-blue-50 text-purple-400', DEBUG: 'bg-gray-100 text-white/50', WARN: 'bg-amber-50 text-amber-400', ERROR: 'bg-red-50 text-red-600', TRACE: 'bg-white/[0.02] text-white/30', FATAL: 'bg-red-100 text-red-400' };
  const catIcons: Record<string, string> = { pipeline: '🔄', agent: '🤖', parser: '📄', validate: '✅', user: '👤', export: '📥', general: '📋' };

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center">
        <select className="text-[11px] py-1.5 px-2 rounded-lg" value={agentFilter ?? ''} onChange={(e) => setAgentFilter(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">All agents</option><option value="1">Agent 1</option><option value="2">Agent 2</option><option value="3">Agent 3</option>
        </select>
        <select className="text-[11px] py-1.5 px-2 rounded-lg" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="INFO">INFO+</option><option value="DEBUG">DEBUG+</option><option value="TRACE">All</option>
        </select>
        <input className="flex-1 text-[11px] py-1.5 px-2 rounded-lg" placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {Object.keys(grouped).length === 0 && <div className="text-center py-12 text-white/30 text-[12px]">No logs yet.</div>}
      {Object.entries(grouped).map(([cat, catLogs]) => (
        <div key={cat} className="mb-4">
          <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>{catIcons[cat] || '📋'}</span> {cat} <span className="text-white/20 font-normal">({catLogs.length})</span>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
            {catLogs.map((log) => {
              const exp = expandedLog === log.id;
              const has = log.data && (log.data.full_prompt || log.data.full_response || log.data.validation_results || log.data.error_stack);
              return (
                <div key={log.id} className="border-b border-white/[0.04] last:border-0">
                  <div className={clsx('flex items-start gap-2 px-3 py-2 text-[11px]', has && 'cursor-pointer hover:bg-white/[0.02]')} onClick={() => has && setExpandedLog(exp ? null : log.id)}>
                    {has ? <span className="text-white/30 mt-0.5 flex-shrink-0">{exp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span> : <span className="w-3" />}
                    <span className="text-white/30 font-mono min-w-[55px] text-[10px]">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    <span className={clsx('inline-block px-1.5 rounded text-[9px] font-semibold min-w-[32px] text-center', levelStyles[log.level] || levelStyles.INFO)}>{log.level.slice(0, 4).toLowerCase()}</span>
                    {log.agent && <span className="text-white/20 text-[10px]">A{log.agent}</span>}
                    <span className="flex-1 text-white/80">{log.message}</span>
                    {has && <span className="text-blue-500 text-[10px]">details</span>}
                  </div>
                  {exp && log.data && (
                    <div className="px-4 pb-3 bg-white/[0.02] space-y-2">
                      {log.data.full_prompt && <div><div className="text-[10px] font-semibold text-white/50 mb-1">Full Prompt</div><div className="bg-black/40 text-white/70 rounded-lg p-3 font-mono text-[9px] max-h-[200px] overflow-y-auto whitespace-pre-wrap">{log.data.full_prompt}</div></div>}
                      {log.data.full_response && <div><div className="text-[10px] font-semibold text-white/50 mb-1">Full Response ({log.data.output_chars?.toLocaleString() || '?'} chars)</div><div className="bg-black/40 text-white/70 rounded-lg p-3 font-mono text-[9px] max-h-[200px] overflow-y-auto whitespace-pre-wrap">{log.data.full_response}</div></div>}
                      {log.data.validation_results && <div><div className="text-[10px] font-semibold text-white/50 mb-1">Validation</div>{log.data.validation_results.map((v: any, i: number) => <div key={i} className={clsx('text-[10px] flex items-center gap-1', v.pass ? 'text-emerald-600' : 'text-amber-400')}>{v.pass ? '✓' : '⚠'} {v.name} — {v.detail}</div>)}</div>}
                      {log.data.error_stack && <div><div className="text-[10px] font-semibold text-red-400 mb-1">Error</div><div className="bg-red-950 text-red-200 rounded-lg p-3 font-mono text-[9px] max-h-[150px] overflow-y-auto whitespace-pre-wrap">{log.data.error_stack}</div></div>}
                      {log.data.cost && <div className="text-[10px] text-white/30">Cost: ${log.data.cost.total_cost_usd?.toFixed(2)} (₹{log.data.cost.total_cost_inr?.toFixed(0)}) | {log.data.cost.input_tokens?.toLocaleString()} in + {log.data.cost.output_tokens?.toLocaleString()} out tokens</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Upload Logs Tab ───
function UploadLogsTab({ playbook }: { playbook: Playbook }) {
  const [uploads, setUploads] = useState<any[]>([]);
  useEffect(() => {
    // Try from status first, then API
    const files = (playbook as any).upload_files;
    if (files && files.length > 0) {
      setUploads(files);
    } else {
      api.getUploads(playbook.run_id).then(setUploads).catch(() => {});
    }
  }, [playbook.run_id]);

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes/1024).toFixed(0)} KB`;
    return `${(bytes/1048576).toFixed(1)} MB`;
  };

  return (
    <div>
      <h2 className="text-[14px] font-semibold mb-3">Upload Logs — Run #{playbook.run_id.slice(0, 7)}</h2>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-[11px]">
          <thead><tr className="bg-white/[0.02] border-b border-white/[0.06]">
            <th className="text-left p-3 font-semibold text-white/50 text-[10px]">File</th>
            <th className="text-left p-3 font-semibold text-white/50 text-[10px]">Type</th>
            <th className="text-left p-3 font-semibold text-white/50 text-[10px]">Size</th>
            <th className="text-left p-3 font-semibold text-white/50 text-[10px]">Method</th>
            <th className="text-left p-3 font-semibold text-white/50 text-[10px]">Result</th>
            <th className="text-left p-3 font-semibold text-white/50 text-[10px]">Time</th>
          </tr></thead>
          <tbody>
            {uploads.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-white/30">Upload details appear after file processing.</td></tr>
            )}
            {uploads.map((f, i) => (
              <tr key={i} className="border-b border-white/[0.04] last:border-0">
                <td className="p-3 font-medium">{f.filename}</td>
                <td className="p-3 text-white/50">{f.file_type}</td>
                <td className="p-3 text-white/50">{formatSize(f.file_size)}</td>
                <td className="p-3 text-white/50">{f.parse_method}</td>
                <td className="p-3"><span className="bg-emerald-50 text-emerald-400 text-[9px] font-medium px-2 py-0.5 rounded-full">{f.result_summary}</span></td>
                <td className="p-3 text-white/30">{f.parse_time_ms ? `${(f.parse_time_ms/1000).toFixed(1)}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {uploads.length > 0 && (
        <div className="text-[11px] text-white/30 mt-3">
          No advanced inputs (radiology, physio, CT scan) for this run.
        </div>
      )}
    </div>
  );
}

// ─── Main Pipeline Page ───
export default function Pipeline() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { startStreaming } = useStreaming();
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const activeTab = usePipelineStore((s) => s.activeTab);
  const setTab = usePipelineStore((s) => s.setTab);
  const setSheet = usePipelineStore((s) => s.setSheet);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStatus = useCallback(() => {
    if (!runId) return;
    api.getStatus(runId).then((d: any) => setPlaybook(d)).catch(console.error);
  }, [runId]);

  // Initial load
  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // Poll only while RUNNING, max every 5s
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (playbook?.state?.includes('RUNNING')) {
      pollingRef.current = setInterval(refreshStatus, 5000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [playbook?.state, refreshStatus]);

  if (!playbook) return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const handleRun = (n: 1|2|3, fb?: string) => startStreaming(playbook.run_id, n, fb);
  const handleApprove = async (n: 1|2|3, edits?: string) => { await api.approveAgent(playbook.run_id, n, edits ? { raw_output: edits } : undefined); refreshStatus(); };
  const handleNext = (n: 1|2|3) => { if (n < 3) handleRun((n + 1) as 1|2|3); };
  const handleViewOutput = (n: 1|2|3) => {
    // Redirect to Sheets tab showing the agent's sheet
    const sheetMap: Record<number, number> = { 1: 3, 2: 4, 3: 5 };
    setSheet(sheetMap[n]);
    setTab('sheets');
  };
  const lastCompleted = [3, 2, 1].find(n => playbook.agents[n as 1|2|3]?.status === 'complete') as 1|2|3|undefined;

  // Detect interrupted session (agent was RUNNING when page loaded)
  const interruptedAgent = playbook.state.includes('RUNNING')
    ? parseInt(playbook.state.replace('AGENT_', '').replace('_RUNNING', ''))
    : null;

  const isComplete = playbook.state === 'COMPLETE';
  const tabs = [
    { key: 'agents' as const, label: isComplete ? 'Summary' : 'Agents' },
    { key: 'sheets' as const, label: 'Sheets' },
    { key: 'logs' as const, label: 'Process Logs' },
    { key: 'uploads' as const, label: 'Upload Logs' },
  ];

  return (
    <div className="max-w-4xl">
      <div className="text-[11px] text-white/30 mb-4">
        <span className="text-purple-400 cursor-pointer hover:underline" onClick={() => navigate('/')}>Dashboard</span>
        <span className="mx-1.5">/</span>
        <span className="text-white/80 font-medium">{playbook.member.name}</span>
        <span className="text-white/20 ml-2">Run #{playbook.run_id.slice(0, 7)}</span>
      </div>

      {/* Session resume banner */}
      {interruptedAgent && !usePipelineStore.getState().streamingAgent && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div>
            <div className="text-[12px] font-semibold text-amber-700">Agent {interruptedAgent} was interrupted</div>
            <div className="text-[11px] text-amber-400 mt-0.5">The previous session was interrupted. You can resume or start fresh.</div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-[11px] bg-amber-600 text-white rounded-lg hover:bg-amber-700" onClick={() => handleRun(interruptedAgent as 1|2|3)}>
              Resume Agent {interruptedAgent}
            </button>
            <button className="px-3 py-1.5 text-[11px] border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-100" onClick={refreshStatus}>
              Refresh Status
            </button>
          </div>
        </div>
      )}

      <div className="flex border-b border-white/[0.06] mb-5">
        {tabs.map((t) => (
          <button key={t.key} className={clsx('px-4 py-2.5 text-[12px] border-b-2 transition', activeTab === t.key ? 'text-purple-400 border-blue-600 font-medium' : 'text-white/30 border-transparent hover:text-white/60')} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {activeTab === 'agents' && (isComplete ? <ExportComplete playbook={playbook} /> : (
        <div>
          {([1, 2, 3] as const).map((n) => <AgentCard key={n} playbook={playbook} agentNum={n} onRun={(fb) => handleRun(n, fb)} onApprove={(e) => handleApprove(n, e)} onNext={() => handleNext(n)} isLastCompleted={lastCompleted === n} onViewOutput={() => handleViewOutput(n)} />)}
        </div>
      ))}
      {activeTab === 'sheets' && <SheetsTab playbook={playbook} />}
      {activeTab === 'logs' && <LogsTab playbook={playbook} />}
      {activeTab === 'uploads' && <UploadLogsTab playbook={playbook} />}
    </div>
  );
}
