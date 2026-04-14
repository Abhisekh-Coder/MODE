import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api/client';
import type { Member } from '../types';

const mandatory = ['biomarkers','clinical_history','symptoms'] as const;
const optional = ['radiology','physio','ct_scan'] as const;
const labels: Record<string,string> = { biomarkers:'Biomarker XLSX', clinical_history:'Clinical History DOCX/PDF', symptoms:'Symptoms PDF', radiology:'Radiology', physio:'Physio', ct_scan:'CT Scan' };

export default function NewPlaybook() {
  const nav = useNavigate();
  const ref = useRef<HTMLInputElement>(null);
  const [m, setM] = useState<Member>({ name:'', age:'', sex:'', location:'', occupation:'', height:'', weight:'' });
  const [files, setFiles] = useState<Record<string,File>>({});
  const [submitting, setSub] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const up = (f: keyof Member, v: string) => setM(p => ({ ...p, [f]: v }));
  const assign = (fs: File[]) => {
    const u = { ...files };
    for (const f of fs) {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ext==='xlsx'&&!u.biomarkers) u.biomarkers=f;
      else if (ext==='docx'&&!u.clinical_history) u.clinical_history=f;
      else if (ext==='pdf'&&!u.symptoms) u.symptoms=f;
    }
    setFiles(u);
  };
  const submit = async () => {
    if (!m.name||!m.age||!m.sex||!files.biomarkers||!files.clinical_history||!files.symptoms) return;
    setSub(true);
    try { const r = await api.createPlaybook(m, files); nav(`/pipeline/${r.run_id}`); }
    catch(e) { console.error(e); setSub(false); }
  };
  const ok = m.name&&m.age&&m.sex&&files.biomarkers&&files.clinical_history&&files.symptoms;

  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="text-[10px] text-white/20 mb-3">
        <span className="text-purple-400 cursor-pointer hover:text-purple-300 transition" onClick={() => nav('/')}>Dashboard</span>
        <span className="mx-1.5 text-white/10">/</span> New Playbook
      </div>
      <h1 className="text-[18px] font-semibold text-white/90 mb-5">Create New Playbook</h1>

      <div className="glass p-5 mb-4">
        <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">Member Details</h3>
        <div className="grid grid-cols-2 gap-3">
          {([['name','Full name *','Karteek Narumanchi'],['age','Age *','37'],['sex','Sex *',''],['location','Location','Bengaluru'],['occupation','Occupation','Tech startup'],['height','Height (cm)','183'],['weight','Weight (kg)','83.5']] as const).map(([f,l,ph]) => (
            <div key={f}>
              <label className="text-[10px] text-white/25 block mb-1">{l}</label>
              {f==='sex' ? <select className="w-full" value={m.sex} onChange={e=>up('sex',e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option></select>
              : <input className="w-full" placeholder={ph} value={m[f as keyof Member]} onChange={e=>up(f as keyof Member,e.target.value)} />}
            </div>
          ))}
        </div>
      </div>

      <div className="glass p-5 mb-4">
        <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">Upload Documents</h3>
        <div
          className={clsx('border border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 mb-4',
            dragOver ? 'border-purple-400/50 bg-purple-500/10 scale-[1.01]' : 'border-white/10 hover:border-purple-500/30 hover:bg-purple-500/5'
          )}
          onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);assign(Array.from(e.dataTransfer.files))}}
          onClick={()=>ref.current?.click()}
        >
          <Upload size={24} className={clsx('mx-auto mb-2 transition-colors', dragOver?'text-purple-400':'text-white/15')} />
          <div className="text-[12px] text-white/40">Drop files or click to browse</div>
          <div className="text-[9px] text-white/15 mt-1">XLSX, DOCX, PDF</div>
          <input ref={ref} type="file" multiple className="hidden" onChange={e=>e.target.files&&assign(Array.from(e.target.files))} />
        </div>

        <div className="text-[9px] font-semibold text-white/25 uppercase tracking-wider mb-2">Required</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {mandatory.map(k => (
            <span key={k} className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] transition-all duration-300',
              files[k] ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 glow-green' : 'bg-white/[0.02] border border-dashed border-white/10 text-white/25'
            )}>
              {files[k] ? <><CheckCircle size={11}/>{files[k].name}</> : labels[k]}
            </span>
          ))}
        </div>
        <div className="text-[9px] font-semibold text-white/15 uppercase tracking-wider mb-2">Optional</div>
        <div className="flex flex-wrap gap-1.5">
          {optional.map(k => <span key={k} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] bg-white/[0.02] border border-dashed border-white/[0.06] text-white/20">+ {labels[k]}</span>)}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button className="px-4 py-2.5 text-[11px] rounded-xl border border-white/10 text-white/35 hover:bg-white/5 transition" onClick={()=>nav('/')}>Cancel</button>
        <button
          className={clsx('px-5 py-2.5 text-[11px] rounded-xl font-medium text-white transition-all duration-200 flex items-center gap-2',
            ok ? 'hover:scale-[1.02]' : 'opacity-30 cursor-not-allowed'
          )}
          style={{ background: ok ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.05)' }}
          disabled={!ok||submitting} onClick={submit}
        >
          {submitting && <Loader2 size={13} className="animate-spin" />}
          {submitting?'Creating...':'Create & Start Pipeline'}
        </button>
      </div>
    </div>
  );
}
