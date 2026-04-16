import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pill, Leaf, Moon, Brain, Dumbbell, ChevronRight, X, Clock, Droplets } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api/client';

const COMPONENTS = [
  { key: 'supplements', label: 'Supplements', icon: Pill, color: 'text-red-400' },
  { key: 'stress', label: 'Stress', icon: Brain, color: 'text-purple-400' },
  { key: 'sleep', label: 'Sleep', icon: Moon, color: 'text-indigo-400' },
  { key: 'activities', label: 'Activities', icon: Dumbbell, color: 'text-emerald-400' },
  { key: 'nutrition', label: 'Nutrition', icon: Leaf, color: 'text-amber-400' },
];

const WEEKS = ['Week 1-2', 'Week 3-4', 'Week 5-6', 'Week 7-8', 'Week 9-10', 'Week 11-12'];

function GoalCard({ goal, onClick }: { goal: any; onClick: () => void }) {
  return (
    <div className="glass glass-hover p-3.5 flex items-center justify-between cursor-pointer" onClick={onClick}>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-white/80 truncate">{goal.title}</div>
        {goal.notes && <div className="text-[10px] text-white/30 mt-0.5 truncate">{goal.notes}</div>}
        {goal.dosage && <div className="text-[10px] text-white/25 mt-0.5">{goal.dosage} {goal.dosage_unit}</div>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        {goal.time_of_day && (
          <span className="text-[9px] px-2 py-0.5 rounded-lg bg-white/5 text-white/30">
            {goal.frequency || 1}x · {goal.intake_timing === 'pre_meal' ? 'Pre Meal' : goal.intake_timing === 'post_meal' ? 'Post Meal' : 'With Meal'}
          </span>
        )}
        <ChevronRight size={14} className="text-white/20" />
      </div>
    </div>
  );
}

function NutritionCard({ goal, onClick }: { goal: any; onClick: () => void }) {
  const samples = goal.samples || [];
  return (
    <div className="glass glass-hover p-3.5 cursor-pointer" onClick={onClick}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[12px] font-medium text-white/80">{goal.title}</div>
        <span className="text-[9px] text-white/25">Examples</span>
      </div>
      {goal.notes && <div className="text-[10px] text-white/30">{goal.notes}</div>}
      {samples.length > 0 && (
        <div className="mt-1.5 flex gap-1 flex-wrap">
          {samples.slice(0, 3).map((s: any, i: number) => (
            <span key={i} className="text-[9px] px-2 py-0.5 bg-white/5 rounded-lg text-white/30">{s.title || s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalOverlay({ goal, table, onClose, onUpdate }: { goal: any; table: string; onClose: () => void; onUpdate: (data: any) => void }) {
  const samples = goal.samples || [];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg mx-4 mb-4 glass rounded-2xl p-5 max-h-[80vh] overflow-y-auto animate-slide-in"
           onClick={e => e.stopPropagation()} style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="flex justify-between items-center mb-4">
          <span className="text-[11px] text-white/30">Close</span>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={18} /></button>
        </div>
        <h2 className="text-[18px] font-semibold text-white/90 mb-3">{goal.title}</h2>

        {/* Supplement detail */}
        {table === 'supplement_goals' && (
          <div className="space-y-3">
            {goal.dosage && <div className="text-[13px] text-white/60">{goal.dosage} {goal.dosage_unit}</div>}
            <div className="flex gap-2">
              {goal.time_of_day && <span className="px-3 py-1 rounded-xl bg-white/5 text-[10px] text-white/40"><Clock size={10} className="inline mr-1" />{goal.time_of_day}</span>}
              {goal.intake_timing && <span className="px-3 py-1 rounded-xl bg-white/5 text-[10px] text-white/40">{goal.intake_timing?.replace('_', ' ')}</span>}
            </div>
            {goal.notes && <div className="text-[11px] text-white/40 leading-relaxed">{goal.notes}</div>}
          </div>
        )}

        {/* Nutrition detail with food samples */}
        {table === 'nutrition_goals' && (
          <div className="space-y-3">
            {goal.nutrition_group && <div className="text-[11px] text-amber-400 capitalize">{goal.nutrition_group?.replace('_', ' ')}</div>}
            {samples.length > 0 && (
              <div className="space-y-2">
                {samples.map((s: any, i: number) => (
                  <div key={i} className="glass p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-medium text-white/70">{s.title || s}</div>
                      {s.description && <div className="text-[10px] text-white/30">{s.description}</div>}
                    </div>
                    {s.quantity && <span className="text-[10px] px-2.5 py-1 bg-white/5 rounded-xl text-white/30">{s.quantity}</span>}
                  </div>
                ))}
              </div>
            )}
            {goal.notes && <div className="text-[11px] text-white/40 leading-relaxed mt-2">{goal.notes}</div>}
          </div>
        )}

        {/* Generic detail */}
        {!['supplement_goals', 'nutrition_goals'].includes(table) && (
          <div className="space-y-2">
            {goal.category && <div className="text-[11px] text-purple-400 capitalize">{goal.category?.replace(/_/g, ' ')}</div>}
            {goal.range_start && <div className="text-[13px] text-white/60">{goal.range_start} {goal.range_unit}</div>}
            {goal.recurrence && <div className="text-[10px] text-white/30">{goal.frequency}x {goal.recurrence}</div>}
            {(goal.notes || goal.note) && <div className="text-[11px] text-white/40 leading-relaxed">{goal.notes || goal.note}</div>}
          </div>
        )}

        <div className="flex gap-2 mt-4 pt-3 border-t border-white/[0.06]">
          <div className="text-[9px] text-white/20">
            Weeks: {goal.weeks?.join(', ') || '—'} · {goal.start_date} → {goal.end_date}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Protocol() {
  const { runId } = useParams<{ runId: string }>();
  const nav = useNavigate();
  const [activeComp, setActiveComp] = useState('supplements');
  const [activeWeek, setActiveWeek] = useState(0);
  const [protocol, setProtocol] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [overlay, setOverlay] = useState<{ goal: any; table: string } | null>(null);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    api.getProtocol(runId)
      .then(data => {
        const hasData = Object.values(data).some((v: any) => Array.isArray(v) && v.length > 0);
        setProtocol(hasData ? data : null);
      })
      .catch(() => setProtocol(null))
      .finally(() => setLoading(false));
  }, [runId]);

  const handleGenerate = async () => {
    if (!runId) return;
    setGenerating(true);
    try {
      await api.generateProtocol(runId);
      const data = await api.getProtocol(runId);
      setProtocol(data);
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  // Filter goals by active week
  const wkStart = (activeWeek * 2) + 1;
  const wkEnd = wkStart + 1;
  const filterByWeek = (goals: any[]) =>
    goals.filter(g => {
      const weeks = g.weeks || [];
      return weeks.includes(wkStart) || weeks.includes(wkEnd);
    });

  // Group supplements by time_of_day
  const groupByTime = (goals: any[]) => {
    const groups: Record<string, any[]> = { morning: [], afternoon: [], evening: [] };
    for (const g of goals) {
      const t = g.time_of_day || 'morning';
      if (!groups[t]) groups[t] = [];
      groups[t].push(g);
    }
    return groups;
  };

  // Group nutrition by nutrition_group
  const groupByNutrition = (goals: any[]) => {
    const groups: Record<string, any[]> = {};
    for (const g of goals) {
      const grp = g.nutrition_group || 'other';
      const label = grp.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      if (!groups[label]) groups[label] = [];
      groups[label].push(g);
    }
    return groups;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!protocol) {
    return (
      <div className="animate-fade-in">
        <div className="text-[10px] text-white/20 mb-3">
          <span className="text-purple-400 cursor-pointer" onClick={() => nav('/')}>Dashboard</span>
          <span className="mx-1.5 text-white/10">/</span> Protocol
        </div>
        <div className="glass rounded-xl p-12 text-center">
          <div className="text-[32px] mb-3 opacity-20">📋</div>
          <div className="text-[14px] text-white/50 mb-2">No protocol generated yet</div>
          <div className="text-[11px] text-white/25 mb-5">Run Agent 3 and generate structured protocol goals</div>
          <button className="px-5 py-2.5 rounded-xl text-[11px] font-medium text-white transition hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate Protocol'}
          </button>
        </div>
      </div>
    );
  }

  const compData = protocol[activeComp] || [];
  const weekFiltered = filterByWeek(compData);

  return (
    <div className="animate-fade-in">
      <div className="text-[10px] text-white/20 mb-3">
        <span className="text-purple-400 cursor-pointer" onClick={() => nav('/')}>Dashboard</span>
        <span className="mx-1.5 text-white/10">/</span>
        <span className="text-purple-400 cursor-pointer" onClick={() => nav(`/pipeline/${runId}`)}>Pipeline</span>
        <span className="mx-1.5 text-white/10">/</span> Protocol
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[18px] font-semibold text-white/90">Protocols</h1>
        <button className="px-3 py-1.5 text-[10px] rounded-lg border border-white/10 text-white/30 hover:bg-white/5 transition" onClick={handleGenerate}>
          {generating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>

      {/* Week selector */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {WEEKS.map((w, i) => (
          <button key={i} className={clsx('px-3.5 py-1.5 rounded-xl text-[11px] flex-shrink-0 transition-all',
            activeWeek === i ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium' : 'glass text-white/30 hover:text-white/50'
          )} onClick={() => setActiveWeek(i)}>{w}</button>
        ))}
      </div>

      {/* Component tabs (vertical list like Figma) */}
      <div className="flex gap-4">
        <div className="w-[160px] flex-shrink-0 space-y-1">
          {COMPONENTS.map(c => {
            const count = filterByWeek(protocol[c.key] || []).length;
            return (
              <button key={c.key} className={clsx('w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[12px] transition-all',
                activeComp === c.key ? 'glass-active text-white font-medium' : 'text-white/35 hover:bg-white/[0.03]'
              )} onClick={() => setActiveComp(c.key)}>
                <span className="flex items-center gap-2">
                  <c.icon size={14} className={c.color} />
                  {c.label}
                </span>
                {count > 0 && <span className="text-[9px] text-white/20">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Goal list */}
        <div className="flex-1 min-w-0">
          {weekFiltered.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-white/20 text-[12px]">
              No {activeComp.replace('_', ' ')} goals for {WEEKS[activeWeek]}
            </div>
          ) : activeComp === 'supplements' ? (
            // Supplements grouped by time of day
            Object.entries(groupByTime(weekFiltered)).map(([time, goals]) =>
              goals.length > 0 && (
                <div key={time} className="mb-4">
                  <div className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-2 capitalize">{time}</div>
                  <div className="space-y-1.5">
                    {goals.map((g: any) => <GoalCard key={g.id} goal={g} onClick={() => setOverlay({ goal: g, table: 'supplement_goals' })} />)}
                  </div>
                </div>
              )
            )
          ) : activeComp === 'nutrition' ? (
            // Nutrition grouped by category
            Object.entries(groupByNutrition(weekFiltered)).map(([group, goals]) => (
              <div key={group} className="mb-4">
                <div className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-2">{group}</div>
                <div className="space-y-1.5">
                  {goals.map((g: any) => <NutritionCard key={g.id} goal={g} onClick={() => setOverlay({ goal: g, table: 'nutrition_goals' })} />)}
                </div>
              </div>
            ))
          ) : (
            // Generic list
            <div className="space-y-1.5">
              {weekFiltered.map((g: any) => <GoalCard key={g.id} goal={g} onClick={() => setOverlay({ goal: g, table: `${activeComp}_goals` })} />)}
            </div>
          )}
        </div>
      </div>

      {/* Bottom component tabs (horizontal, like Figma bottom bar) */}
      <div className="flex gap-1.5 mt-5 pt-4 border-t border-white/[0.04] justify-center">
        {COMPONENTS.map(c => (
          <button key={c.key} className={clsx('px-3 py-1.5 rounded-xl text-[10px] transition-all',
            activeComp === c.key ? 'bg-emerald-500/15 text-emerald-400 font-medium' : 'text-white/25 hover:text-white/40'
          )} onClick={() => setActiveComp(c.key)}>{c.label}</button>
        ))}
      </div>

      {/* Overlay */}
      {overlay && <GoalOverlay goal={overlay.goal} table={overlay.table} onClose={() => setOverlay(null)} onUpdate={() => {}} />}
    </div>
  );
}
