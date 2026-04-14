import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { usePipelineStore } from '../store/pipelineStore';
import { api } from '../api/client';
import type { Playbook, AgentStatus } from '../types';

function Dot({ s }: { s: AgentStatus }) {
  return <span className={clsx('w-1.5 h-1.5 rounded-full', s==='complete'&&'bg-emerald-400', s==='running'&&'bg-purple-400 animate-pulse-dot', s==='waiting'&&'bg-white/15', s==='error'&&'bg-red-400', s==='review'&&'bg-amber-400')} />;
}
function Pill({ label, s }: { label: string; s: AgentStatus }) {
  return <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium',
    s==='complete'&&'bg-emerald-500/10 text-emerald-400', s==='running'&&'bg-purple-500/10 text-purple-400',
    s==='waiting'&&'bg-white/[0.03] text-white/20', s==='error'&&'bg-red-500/10 text-red-400', s==='review'&&'bg-amber-500/10 text-amber-400',
  )}><Dot s={s} />{label}</span>;
}

function Card({ pb }: { pb: Playbook }) {
  const nav = useNavigate();
  const st = pb.state;
  const line = st==='COMPLETE' ? 'Complete' : st.includes('RUNNING') ? `Agent ${st.includes('1')?1:st.includes('2')?2:3} running...` : st.includes('REVIEW') ? 'Ready for review' : st==='DATA_UPLOADED' ? 'Ready for Agent 1' : 'Idle';
  return (
    <div className="glass glass-hover p-4 cursor-pointer animate-fade-in" onClick={() => nav(`/pipeline/${pb.run_id}`)}>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[13px] font-medium text-white/85">{pb.member?.name || 'Unnamed'}</span>
        <span className="text-[10px] text-white/20">{pb.created_at ? new Date(pb.created_at).toLocaleDateString() : ''}</span>
      </div>
      <div className="text-[11px] text-white/30 mb-2.5">
        {pb.member?.age}{pb.member?.sex?.[0]} · {pb.member?.location||'—'} · {pb.markers_total??'—'} markers
        {pb.cost_total ? ` · $${pb.cost_total.toFixed(2)}` : ''}
      </div>
      <div className="flex gap-1.5">
        <Pill label="Upload" s={st==='IDLE'?'waiting':'complete'} />
        <Pill label="Agent 1" s={pb.agents?.[1]?.status??'waiting'} />
        <Pill label="Agent 2" s={pb.agents?.[2]?.status??'waiting'} />
        <Pill label="Agent 3" s={pb.agents?.[3]?.status??'waiting'} />
      </div>
      <div className={clsx('text-[10px] mt-2 text-right', st==='ERROR'?'text-red-400':'text-white/20')}>{line}</div>
    </div>
  );
}

export default function Dashboard() {
  const { playbooks, setPlaybooks } = usePipelineStore();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPlaybooks = () => {
    setLoading(true);
    setError('');
    api.listPlaybooks()
      .then((data) => {
        setPlaybooks(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Failed to load playbooks:', err);
        setError('Could not connect to backend. Make sure the server is running.');
        setPlaybooks([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPlaybooks(); }, []);

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[18px] font-semibold text-white/90">Playbooks</h1>
          {!loading && <p className="text-[11px] text-white/25 mt-0.5">{playbooks.length} playbook{playbooks.length!==1?'s':''}</p>}
        </div>
        <div className="flex gap-2">
          <button className="p-2.5 rounded-xl border border-white/10 text-white/30 hover:text-white/60 hover:bg-white/5 transition" onClick={loadPlaybooks} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[11px] font-medium text-white transition-all duration-200 hover:scale-[1.02]" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }} onClick={() => nav('/new')}>
            <Plus size={13} /> New Playbook
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="glass rounded-xl p-16 text-center animate-fade-in">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-[12px] text-white/30">Loading playbooks...</div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="glass rounded-xl p-8 text-center border-red-500/20 animate-fade-in">
          <div className="text-[13px] text-red-400 mb-2">Connection Error</div>
          <div className="text-[11px] text-white/30 mb-4">{error}</div>
          <button className="px-4 py-2 text-[11px] rounded-xl border border-white/10 text-white/40 hover:bg-white/5 transition" onClick={loadPlaybooks}>
            <RefreshCw size={12} className="inline mr-1.5" /> Try Again
          </button>
        </div>
      )}

      {/* Playbook list */}
      {!loading && !error && (
        <div className="space-y-2">
          {playbooks.map(pb => <Card key={pb.run_id} pb={pb} />)}
          {playbooks.length === 0 && (
            <div className="glass rounded-xl p-16 text-center animate-fade-in">
              <div className="text-[32px] mb-3 opacity-20">📋</div>
              <div className="text-[13px] text-white/40 mb-2">No playbooks yet</div>
              <div className="text-[11px] text-white/20 mb-5">Create your first playbook to start analyzing biomarkers</div>
              <button className="px-5 py-2.5 rounded-xl text-[11px] font-medium text-white transition hover:scale-[1.02]" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }} onClick={() => nav('/new')}>
                <Plus size={12} className="inline mr-1" /> Create Playbook
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
