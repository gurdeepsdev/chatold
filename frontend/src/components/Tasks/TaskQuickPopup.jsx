import React, { useState, useEffect, useRef } from 'react';
import { tasksAPI, authAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const TASK_TYPES = {
  share_link:    { label: 'Share Link',    icon: '🔗', color: '#4f7dff' },
  pause_pid:     { label: 'Pause PID',     icon: '⏸️', color: '#f59e0b' },
  raise_request: { label: 'Raise Request', icon: '📋', color: '#22c55e' },
  optimise:      { label: 'Optimise',      icon: '⚡', color: '#06b6d4' },
};
const PAUSE_SCENARIOS = ['Low Quality Traffic','Fraud Detected','Budget Exhausted','Geo Mismatch','KPI Not Met','Technical Issue','Advertiser Request','Other'];
const OPTIMISE_SCENARIOS = ['Increase Budget','Decrease Budget','Expand GEO','Restrict GEO','Update KPI Target','Change Payout','Pause Sub-publisher','Whitelist Publisher','Blacklist Publisher','Other'];
const REQUEST_TYPES = ['geo','payout','link','budget'];

const empty = (type='share_link') => ({
  task_type:type, title:'', description:'', assigned_to:'',
  pub_id:'', pid:'', link:'',
  pause_reason:'', request_type:'geo', request_details:'',
  fp:'', f1:'', f2:'', optimise_scenario:'', attachment:null,
});

/*
 * TaskQuickPopup
 * Renders as a floating panel anchored above the input bar.
 * The chat messages remain fully visible behind/above it.
 * No full-screen overlay — just a contained card.
 */
export default function TaskQuickPopup({ group, onClose, initialType }) {
  const { user } = useAuth();
  const [users,    setUsers]    = useState([]);
  const [form,     setForm]     = useState(empty(initialType || 'share_link'));
  const [creating, setCreating] = useState(false);
  const fileRef = useRef(null);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => { authAPI.getUsers().then(d => setUsers(d.users || [])); }, []);
  useEffect(() => { if (initialType) setForm(empty(initialType)); }, [initialType]);

  // Close on Escape
  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleCreate = async () => {
    if (!form.title.trim()) return toast.error('Title required');
    setCreating(true);
    try {
      let payload;
      if (form.attachment) {
        payload = new FormData();
        Object.entries({ group_id: group.id, campaign_id: group.campaign_id || '', ...form })
          .forEach(([k, v]) => { if (k !== 'attachment' && v !== null && v !== undefined) payload.append(k, String(v)); });
        payload.append('attachment', form.attachment);
      } else {
        payload = { group_id: group.id, campaign_id: group.campaign_id, ...form };
        delete payload.attachment;
      }
      await tasksAPI.create(payload);
      toast.success('Task created!');
      onClose();
    } catch (e) { toast.error(e?.error || 'Failed'); }
    setCreating(false);
  };

  const type = TASK_TYPES[form.task_type];

  return (
    /*
     * Positioned absolutely at bottom of the chat column (above the input bar).
     * z-index 100 so it floats above messages but does not cover the whole screen.
     * Chat messages behind it are still visible via scroll.
     */
    <div style={{
      position: 'absolute',
      bottom: '100%',          /* sits directly above whatever renders this */
      left: 0,
      right: 0,
      zIndex: 100,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderBottom: 'none',
      borderRadius: '14px 14px 0 0',
      boxShadow: '0 -6px 32px rgba(0,0,0,.45)',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '72vh',
      animation: 'slideUp .22s cubic-bezier(.22,.68,0,1.2)',
    }}>

      {/* ── Header ── */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'13px 16px',
        borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:20}}>{type?.icon || '📋'}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14}}>Create Task</div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>{group?.group_name}</div>
        </div>
        <button onClick={onClose}
          style={{background:'var(--bg-active)',border:'1px solid var(--border)',
            borderRadius:7,width:28,height:28,cursor:'pointer',fontSize:14,
            color:'var(--text-secondary)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          ✕
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{overflowY:'auto',padding:'14px 16px',flex:1}}>

        {/* Task type pills */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
          {Object.entries(TASK_TYPES).map(([k, v]) => {
            const active = form.task_type === k;
            return (
              <button key={k} onClick={() => f('task_type', k)}
                style={{display:'flex',alignItems:'center',gap:5,padding:'5px 13px',
                  borderRadius:20,fontFamily:'inherit',fontSize:12,cursor:'pointer',transition:'all .13s',
                  border:`1.5px solid ${active ? v.color : 'var(--border)'}`,
                  background: active ? `${v.color}20` : 'var(--bg-active)',
                  color: active ? v.color : 'var(--text-secondary)',
                  fontWeight: active ? 700 : 400}}>
                {v.icon} {v.label}
              </button>
            );
          })}
        </div>

        {/* Title + Assign — always shown */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:10}}>
          <div style={{gridColumn:'1/-1'}}>
            <label className="form-label">Title *</label>
            <input className="form-control" autoFocus value={form.title}
              onChange={e => f('title', e.target.value)} placeholder="Task title…"/>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label className="form-label">Assign To</label>
            <select className="form-control" value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
            </select>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label className="form-label">Description</label>
            <textarea className="form-control" style={{minHeight:44,resize:'vertical'}}
              value={form.description} onChange={e => f('description', e.target.value)} placeholder="Optional…"/>
          </div>
        </div>

        {/* ── Share Link ── */}
        {form.task_type === 'share_link' && (
          <div style={{padding:'10px 13px',background:'rgba(79,125,255,.06)',borderRadius:9,
            border:'1px solid rgba(79,125,255,.2)',marginBottom:8}}>
            <div style={{fontSize:11,color:'#4f7dff',fontWeight:700,marginBottom:9}}>🔗 Link Details</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div><label className="form-label">PubID</label>
                <input className="form-control" placeholder="Publisher ID" value={form.pub_id} onChange={e=>f('pub_id',e.target.value)}/></div>
              <div><label className="form-label">PID</label>
                <input className="form-control" placeholder="PID" value={form.pid} onChange={e=>f('pid',e.target.value)}/></div>
            </div>
            <label className="form-label">Tracking Link</label>
            <input className="form-control" placeholder="https://…" value={form.link} onChange={e=>f('link',e.target.value)}/>
          </div>
        )}

        {/* ── Pause PID ── */}
        {form.task_type === 'pause_pid' && (
          <div style={{padding:'10px 13px',background:'rgba(245,158,11,.06)',borderRadius:9,
            border:'1px solid rgba(245,158,11,.2)',marginBottom:8}}>
            <div style={{fontSize:11,color:'#f59e0b',fontWeight:700,marginBottom:9}}>⏸️ Pause Details</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div><label className="form-label">PubID</label>
                <input className="form-control" value={form.pub_id} onChange={e=>f('pub_id',e.target.value)}/></div>
              <div><label className="form-label">PID</label>
                <input className="form-control" value={form.pid} onChange={e=>f('pid',e.target.value)}/></div>
            </div>
            <label className="form-label">Reason</label>
            <select className="form-control" value={form.pause_reason} onChange={e=>f('pause_reason',e.target.value)}>
              <option value="">Select scenario…</option>
              {PAUSE_SCENARIOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {/* ── Raise Request ── */}
        {form.task_type === 'raise_request' && (
          <div style={{padding:'10px 13px',background:'rgba(34,197,94,.06)',borderRadius:9,
            border:'1px solid rgba(34,197,94,.2)',marginBottom:8}}>
            <div style={{fontSize:11,color:'#22c55e',fontWeight:700,marginBottom:9}}>📋 Request</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:9}}>
              {REQUEST_TYPES.map(t => (
                <button key={t} onClick={() => f('request_type', t)} style={{padding:'4px 13px',borderRadius:20,cursor:'pointer',fontFamily:'inherit',
                  border:`1.5px solid ${form.request_type===t?'#22c55e':'var(--border)'}`,
                  background:form.request_type===t?'rgba(34,197,94,.15)':'transparent',
                  color:form.request_type===t?'#22c55e':'var(--text-secondary)',
                  fontWeight:form.request_type===t?700:400,fontSize:12,textTransform:'uppercase'}}>
                  {t}
                </button>
              ))}
            </div>
            <label className="form-label">Details</label>
            <textarea className="form-control" style={{minHeight:52}} value={form.request_details}
              onChange={e=>f('request_details',e.target.value)} placeholder="Describe the request…"/>
          </div>
        )}

        {/* ── Optimise ── */}
        {form.task_type === 'optimise' && (
          <div style={{padding:'10px 13px',background:'rgba(6,182,212,.06)',borderRadius:9,
            border:'1px solid rgba(6,182,212,.2)',marginBottom:8}}>
            <div style={{fontSize:11,color:'#06b6d4',fontWeight:700,marginBottom:9}}>⚡ Optimise</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:8}}>
              <div><label className="form-label">FP</label><input className="form-control" placeholder="12%" value={form.fp} onChange={e=>f('fp',e.target.value)}/></div>
              <div><label className="form-label">F1</label><input className="form-control" value={form.f1} onChange={e=>f('f1',e.target.value)}/></div>
              <div><label className="form-label">F2</label><input className="form-control" value={form.f2} onChange={e=>f('f2',e.target.value)}/></div>
            </div>
            <div style={{marginBottom:8}}>
              <label className="form-label">Scenario</label>
              <select className="form-control" value={form.optimise_scenario} onChange={e=>f('optimise_scenario',e.target.value)}>
                <option value="">Select…</option>
                {OPTIMISE_SCENARIOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Attach File</label>
              <input ref={fileRef} type="file" style={{display:'none'}} onChange={e=>f('attachment',e.target.files[0])}/>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={()=>fileRef.current?.click()}>📎 Choose</button>
                {form.attachment && (
                  <span style={{fontSize:11,color:'var(--text-secondary)'}}>
                    {form.attachment.name}
                    <button type="button" onClick={()=>f('attachment',null)}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',marginLeft:4}}>✕</button>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{padding:'12px 16px',borderTop:'1px solid var(--border)',
        display:'flex',gap:8,flexShrink:0}}>
        <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" style={{flex:2}} onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : `✓ Create ${type?.label || 'Task'}`}
        </button>
      </div>
    </div>
  );
}
