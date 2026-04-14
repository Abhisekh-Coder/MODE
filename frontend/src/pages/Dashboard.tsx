import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
        <span className="text-[13px] font-medium text-white/85">{pb.member.name}</span>
        <span className="text-[10px] text-white/20">{new Date(pb.created_at).toLocaleDateString()}</span>
      </div>
      <div className="text-[11px] text-white/30 mb-2.5">
        {pb.member.age}{pb.member.sex?.[0]} · {pb.member.location||'—'} · {pb.markers_total??'—'} markers
        {pb.cost_total ? ` · $${pb.cost_total.toFixed(2)}` : ''}
      </div>
      <div className="flex gap-1.5">
        <Pill label="Upload" s={st==='IDLE'?'waiting':'complete'} />
        <Pill label="Agent 1" s={pb.agents[1]?.status??'waiting'} />
        <Pill label="Agent 2" s={pb.agents[2]?.status??'waiting'} />
        <Pill label="Agent 3" s={pb.agents[3]?.status??'waiting'} />
      </div>
      <div className={clsx('text-[10px] mt-2 text-right', st==='ERROR'?'text-red-400':'text-white/20')}>{line}</div>
    </div>
  );
}

export default function Dashboard() {
  const { playbooks, setPlaybooks } = usePipelineStore();
  const nav = useNavigate();
  useEffect(() => { api.listPlaybooks().then(setPlaybooks).catch(console.error); }, [setPlaybooks]);
  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[18px] font-semibold text-white/90">Playbooks</h1>
          <p className="text-[11px] text-white/25 mt-0.5">{playbooks.length} playbook{playbooks.length!==1?'s':''}</p>
        </div>
        <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[11px] font-medium text-white transition-all duration-200 hover:scale-[1.02]" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }} onClick={() => nav('/new')}>
          <Plus size={13} /> New Playbook
        </button>
      </div>
      <div className="space-y-2">
        {playbooks.map(pb => <Card key={pb.run_id} pb={pb} />)}
        {playbooks.length===0 && <div className="text-center py-20 text-white/15 text-[12px] glass rounded-xl">No playbooks yet. Create one to get started.</div>}
      </div>
    </div>
  );
}
