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
  task_type:type, description:'', assigned_to:'',
  entries: [{ pub_id:'', pid:'', link:'', assigned_to:'', note:'' }],
  pause_entries: [{ pub_id:'', pid:'', assigned_to:'', pause_reason:'' }],
  optimise_entries: [{ assigned_to:'', pub_id:'', pid:'', fp:'', fa:'', f1:'', f2:'', optimise_scenario:'', attachment:null }],
  pause_reason:'', request_type:'geo', request_details:'',
  fp:'', f1:'', f2:'', optimise_scenario:'', attachment:null,
});

// Role-based field definitions for optimise task
const OPTIMISE_FIELDS = {
  admin: ['assigned_to', 'pub_id', 'pid', 'fp', 'f1', 'f2', 'optimise_scenario', 'attachment'],
  advertiser: ['assigned_to', 'pub_id', 'pid', 'fa', 'optimise_scenario', 'attachment'],
  advertiser_manager: ['assigned_to', 'pub_id', 'pid', 'fa', 'optimise_scenario', 'attachment'],
  publisher: ['assigned_to', 'pub_id', 'pid', 'fp', 'optimise_scenario', 'attachment'],
  publisher_manager: ['assigned_to', 'pub_id', 'pid', 'fp', 'optimise_scenario', 'attachment'],
  am: ['assigned_to', 'pub_id', 'pid', 'fp', 'optimise_scenario', 'attachment']
};

const FA_OPTIONS = ['FA1', 'FA2', 'FA3', 'FA4'];

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

  // Entry management functions
  const addEntry = () => {
    setForm(p => ({
      ...p,
      entries: [...p.entries, { pub_id:'', pid:'', link:'', assigned_to:'', note:'' }]
    }));
  };

  const removeEntry = (index) => {
    setForm(p => ({
      ...p,
      entries: p.entries.filter((_, i) => i !== index)
    }));
  };

  const updateEntry = (index, field, value) => {
    setForm(p => ({
      ...p,
      entries: p.entries.map((entry, i) => 
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  // Pause entry management functions
  const addPauseEntry = () => {
    setForm(p => ({
      ...p,
      pause_entries: [...p.pause_entries, { pub_id:'', pid:'', assigned_to:'', pause_reason:'' }]
    }));
  };

  const removePauseEntry = (index) => {
    setForm(p => ({
      ...p,
      pause_entries: p.pause_entries.filter((_, i) => i !== index)
    }));
  };

  const updatePauseEntry = (index, field, value) => {
    setForm(p => ({
      ...p,
      pause_entries: p.pause_entries.map((entry, i) => 
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  // Optimise entry management functions
  const addOptimiseEntry = () => {
    setForm(p => ({
      ...p,
      optimise_entries: [...p.optimise_entries, { assigned_to:'', pub_id:'', pid:'', fp:'', fa:'', f1:'', f2:'', optimise_scenario:'', attachment:null }]
    }));
  };

  const removeOptimiseEntry = (index) => {
    setForm(p => ({
      ...p,
      optimise_entries: p.optimise_entries.filter((_, i) => i !== index)
    }));
  };

  const updateOptimiseEntry = (index, field, value) => {
    setForm(p => ({
      ...p,
      optimise_entries: p.optimise_entries.map((entry, i) => 
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  useEffect(() => { authAPI.getUsers().then(d => setUsers(d.users || [])); }, []);
  useEffect(() => { if (initialType) setForm(empty(initialType)); }, [initialType]);

  // Close on Escape
  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleCreate = async () => {
    // For share_link, validate entries
    if (form.task_type === 'share_link') {
      const validEntries = form.entries.filter(entry => 
        entry.pub_id.trim() || entry.pid.trim() || entry.link.trim()
      );
      if (validEntries.length === 0) {
        return toast.error('Please fill in at least one entry (PubID, PID, or Link)');
      }
    }
    // For pause_pid, validate pause entries
    if (form.task_type === 'pause_pid') {
      const validPauseEntries = form.pause_entries.filter(entry => 
        entry.pub_id.trim() || entry.pid.trim() || entry.pause_reason.trim()
      );
      if (validPauseEntries.length === 0) {
        return toast.error('Please fill in at least one entry (PubID, PID, or Pause Reason)');
      }
    }
    // For optimise, validate optimise entries
    if (form.task_type === 'optimise') {
      const validOptimiseEntries = form.optimise_entries.filter(entry => 
        entry.pub_id.trim() || entry.pid.trim() || entry.fp.trim() || entry.fa.trim() || entry.f1.trim() || entry.f2.trim() || entry.optimise_scenario.trim()
      );
      if (validOptimiseEntries.length === 0) {
        return toast.error('Please fill in at least one entry (PubID, PID, FP, FA, F1, F2, or Scenario)');
      }
    }
    setCreating(true);
    try {
      let payload;
      if (form.attachment) {
        payload = new FormData();
        Object.entries({ group_id: group.id, campaign_id: group.campaign_id || '', ...form })
          .forEach(([k, v]) => { 
            if (k !== 'attachment' && k !== 'entries' && k !== 'pause_entries' && k !== 'optimise_entries' && v !== null && v !== undefined) {
              payload.append(k, String(v));
            }
          });
        // Add entries as JSON string
        if (form.task_type === 'share_link') {
          payload.append('entries', JSON.stringify(form.entries));
        }
        if (form.task_type === 'pause_pid') {
          payload.append('pause_entries', JSON.stringify(form.pause_entries));
        }
        if (form.task_type === 'optimise') {
          payload.append('optimise_entries', JSON.stringify(form.optimise_entries));
        }
        payload.append('attachment', form.attachment);
      } else {
        payload = { 
          group_id: group.id, 
          campaign_id: group.campaign_id, 
          ...form
        };
        delete payload.attachment;
        if (form.task_type !== 'share_link') delete payload.entries;
        if (form.task_type !== 'pause_pid') delete payload.pause_entries;
        if (form.task_type !== 'optimise') delete payload.optimise_entries;
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
      top: '-500%',              /* center vertically in chat area */
      left: '50%',              /* center horizontally */
      transform: 'translate(-50%, -50%)',  /* perfect center */
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.15)',  /* Fully transparent with dark tint */
      border: '1px solid rgba(255, 255, 255, 0.2)',  /* Subtle white border */
      borderRadius: '12px',  /* Rounded corners */
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',  /* Dark shadow */
      backdropFilter: 'blur(12px)',  /* Strong glass effect */
      width: '340px',  /* Slightly wider */
      maxHeight: '320px',  /* Slightly taller */
      animation: 'slideUp .25s ease-out',
    }}>

      {/* ── Header ── */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',
        borderBottom:'1px solid rgba(255, 255, 255, 0.1)',flexShrink:0}}>
        <span style={{fontSize:16,color:'#fff'}}>{type?.icon || '📋'}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:12,color:'#fff'}}>Create Task</div>
        </div>
        <button 
          onClick={onClose}
          style={{background:'none',border:'none',fontSize:16,cursor:'pointer',color:'rgba(255,255,255,0.7)',padding:2}}
        >
          ✕
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{overflowY:'auto',padding:'10px 12px',flex:1}}>

        {/* Task type pills */}
        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10}}>
          {Object.entries(TASK_TYPES).map(([k, v]) => {
            const active = form.task_type === k;
            return (
              <button key={k} onClick={() => setForm(empty(k))}
                style={{padding:'4px 8px',borderRadius:'6px',fontSize:11,fontWeight:500,
                  background: active ? v.color : 'rgba(255, 255, 255, 0.1)',
                  color: active ? '#fff' : 'rgba(255, 255, 255, 0.8)',
                  border: active ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                  cursor: 'pointer',transition:'all .15s'}}>
                {v.icon} {v.label}
              </button>
            );
          })}
        </div>

        {/* Assign To */}
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6,marginBottom:8}}>
          <div>
            <label className="form-label" style={{fontSize:11,marginBottom:4,color:'rgba(255,255,255,0.8)'}}>Assign To</label>
            <select className="form-control" style={{fontSize:12,padding:6,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
            </select>
          </div>
        </div>

        {/* ── Share Link ── */}
        {form.task_type === 'share_link' && (
          <div style={{padding:'8px 10px',background:'rgba(79,125,255,0.1)',borderRadius:6,
            border:'1px solid rgba(79,125,255,0.2)',marginBottom:8}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.9)',fontWeight:600,marginBottom:6}}>🔗 Link Details</div>
            
            {/* Table Header */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1.5fr 1fr 1.5fr auto',gap:4,marginBottom:6,fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>
              <div>Assign To</div>
              <div>PubID</div>
              <div>PID</div>
              <div>Tracking Link</div>
              <div>Note</div>
              <div></div>
            </div>
            
            {/* Table Entries */}
            <div style={{maxHeight:'200px',overflowY:'auto'}}>
              {form.entries.map((entry, index) => (
                <div key={index} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1.5fr 1fr 1.5fr auto',gap:4,marginBottom:6}}>
                  <select 
                    className="form-control" 
                    style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}}
                    value={entry.assigned_to} 
                    onChange={e => updateEntry(index, 'assigned_to', e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                  <input 
                    className="form-control" 
                    style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} 
                    placeholder="PubID" 
                    value={entry.pub_id} 
                    onChange={e => updateEntry(index, 'pub_id', e.target.value)}
                  />
                  <input 
                    className="form-control" 
                    style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} 
                    placeholder="PID" 
                    value={entry.pid} 
                    onChange={e => updateEntry(index, 'pid', e.target.value)}
                  />
                  <input 
                    className="form-control" 
                    style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} 
                    placeholder="Link" 
                    value={entry.link} 
                    onChange={e => updateEntry(index, 'link', e.target.value)}
                  />
                  <input 
                    className="form-control" 
                    style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} 
                    placeholder="Note" 
                    value={entry.note} 
                    onChange={e => updateEntry(index, 'note', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeEntry(index)}
                    style={{
                      background:'rgba(239,68,68,0.2)',
                      border:'1px solid rgba(239,68,68,0.3)',
                      color:'#ef4444',
                      borderRadius:'4px',
                      padding:'4px 8px',
                      fontSize:'12px',
                      cursor:'pointer',
                      transition:'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background='rgba(239,68,68,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background='rgba(239,68,68,0.2)';
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            
            {/* Add Entry Button */}
            <button
              type="button"
              onClick={addEntry}
              style={{
                background:'rgba(79,125,255,0.2)',
                border:'1px solid rgba(79,125,255,0.3)',
                color:'#4f7dff',
                borderRadius:'6px',
                padding:'6px 12px',
                fontSize:'11px',
                cursor:'pointer',
                transition:'all 0.15s',
                display:'flex',
                alignItems:'center',
                gap:'6px',
                marginTop:'8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background='rgba(79,125,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background='rgba(79,125,255,0.2)';
              }}
            >
              ➕ Add Entry
            </button>
          </div>
        )}

        {/* ── Pause PID ── */}
        {form.task_type === 'pause_pid' && (
          <div style={{padding:'8px 10px',background:'rgba(245,158,11,0.1)',borderRadius:6,
            border:'1px solid rgba(245,158,11,0.2)',marginBottom:8}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.9)',fontWeight:600,marginBottom:6}}>⏸️ Pause Details</div>
            
            {/* Table Header */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:4,marginBottom:6,fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>
              <div>Assign To</div>
              <div>PubID</div>
              <div>PID</div>
              <div>Pause Scenario</div>
              <div></div>
            </div>
            
            {/* Table Entries */}
            <div style={{maxHeight:'200px',overflowY:'auto'}}>
              {form.pause_entries.map((entry, index) => (
                <div key={index} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:4,marginBottom:6}}>
                  <select 
                    className="form-control" 
                    style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}}
                    value={entry.assigned_to} 
                    onChange={e => updatePauseEntry(index, 'assigned_to', e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                  <input 
                    className="form-control" 
                    style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} 
                    placeholder="PubID" 
                    value={entry.pub_id} 
                    onChange={e => updatePauseEntry(index, 'pub_id', e.target.value)}
                  />
                  <input 
                    className="form-control" 
                    style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} 
                    placeholder="PID" 
                    value={entry.pid} 
                    onChange={e => updatePauseEntry(index, 'pid', e.target.value)}
                  />
                  <select 
                    className="form-control" 
                    style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}}
                    value={entry.pause_reason} 
                    onChange={e => updatePauseEntry(index, 'pause_reason', e.target.value)}
                  >
                    <option value="">Select scenario…</option>
                    {PAUSE_SCENARIOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => removePauseEntry(index)}
                    style={{
                      background:'rgba(239,68,68,0.2)',
                      border:'1px solid rgba(239,68,68,0.3)',
                      color:'#ef4444',
                      borderRadius:'4px',
                      padding:'4px 8px',
                      fontSize:'12px',
                      cursor:'pointer',
                      transition:'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background='rgba(239,68,68,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background='rgba(239,68,68,0.2)';
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            
            {/* Add Entry Button */}
            <button
              type="button"
              onClick={addPauseEntry}
              style={{
                background:'rgba(245,158,11,0.2)',
                border:'1px solid rgba(245,158,11,0.3)',
                color:'#f59e0b',
                borderRadius:'6px',
                padding:'6px 12px',
                fontSize:'11px',
                cursor:'pointer',
                transition:'all 0.15s',
                display:'flex',
                alignItems:'center',
                gap:'6px',
                marginTop:'8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background='rgba(245,158,11,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background='rgba(245,158,11,0.2)';
              }}
            >
              ➕ Add Entry
            </button>
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
          <div style={{padding:'8px 10px',background:'rgba(6,182,212,0.1)',borderRadius:6,
            border:'1px solid rgba(6,182,212,0.2)',marginBottom:8}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.9)',fontWeight:600,marginBottom:6}}>⚡ Optimise</div>
            
            {/* Get fields based on user role */}
            {(() => {
              const userFields = OPTIMISE_FIELDS[user?.role] || OPTIMISE_FIELDS.am;
              const renderField = (field, index) => {
                switch(field) {
                  case 'assigned_to':
                    return <div key={field} style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>Assign To</div>;
                  case 'pub_id':
                    return <div key={field} style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>PubID</div>;
                  case 'pid':
                    return <div key={field} style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>PID</div>;
                  case 'fp':
                    return <div key={field} style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>FP</div>;
                  case 'fa':
                    return <div key={field} style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>FA</div>;
                  case 'f1':
                    return <div key={field} style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>F1</div>;
                  case 'f2':
                    return <div key={field} style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>F2</div>;
                  case 'optimise_scenario':
                    return <div key={field} style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>Scenario</div>;
                  case 'attachment':
                    return <div key={field} style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>Attachment</div>;
                  default:
                    return null;
                }
              };
              
              const renderEntryField = (field, entry, entryIndex) => {
                switch(field) {
                  case 'assigned_to':
                    return (
                      <select 
                        className="form-control" 
                        style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}}
                        value={entry.assigned_to} 
                        onChange={e => updateOptimiseEntry(entryIndex, 'assigned_to', e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                      </select>
                    );
                  case 'pub_id':
                    return (
                      <input 
                        className="form-control" 
                        style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} 
                        placeholder="PubID" 
                        value={entry.pub_id} 
                        onChange={e => updateOptimiseEntry(entryIndex, 'pub_id', e.target.value)}
                      />
                    );
                  case 'pid':
                    return (
                      <input 
                        className="form-control" 
                        style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} 
                        placeholder="PID" 
                        value={entry.pid} 
                        onChange={e => updateOptimiseEntry(entryIndex, 'pid', e.target.value)}
                      />
                    );
                  case 'fp':
                    return (
                      <input 
                        className="form-control" 
                        style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} 
                        placeholder="FP" 
                        value={entry.fp} 
                        onChange={e => updateOptimiseEntry(entryIndex, 'fp', e.target.value)}
                      />
                    );
                  case 'fa':
                    return (
                      <select 
                        className="form-control" 
                        style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}}
                        value={entry.fa} 
                        onChange={e => updateOptimiseEntry(entryIndex, 'fa', e.target.value)}
                      >
                        <option value="">Select FA</option>
                        {FA_OPTIONS.map(fa => <option key={fa} value={fa}>{fa}</option>)}
                      </select>
                    );
                  case 'f1':
                    return (
                      <input 
                        className="form-control" 
                        style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} 
                        placeholder="F1" 
                        value={entry.f1} 
                        onChange={e => updateOptimiseEntry(entryIndex, 'f1', e.target.value)}
                      />
                    );
                  case 'f2':
                    return (
                      <input 
                        className="form-control" 
                        style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}} 
                        placeholder="F2" 
                        value={entry.f2} 
                        onChange={e => updateOptimiseEntry(entryIndex, 'f2', e.target.value)}
                      />
                    );
                  case 'optimise_scenario':
                    return (
                      <select 
                        className="form-control" 
                        style={{fontSize:11,padding:4,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff'}}
                        value={entry.optimise_scenario} 
                        onChange={e => updateOptimiseEntry(entryIndex, 'optimise_scenario', e.target.value)}
                      >
                        <option value="">Select scenario…</option>
                        {OPTIMISE_SCENARIOS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    );
                  case 'attachment':
                    return (
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <input 
                          type="file" 
                          style={{display:'none'}} 
                          id={`file-${entryIndex}`}
                          onChange={e => updateOptimiseEntry(entryIndex, 'attachment', e.target.files[0])}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById(`file-${entryIndex}`).click()}
                          style={{
                            background:'rgba(255,255,255,0.2)',
                            border:'1px solid rgba(255,255,255,0.3)',
                            color:'#fff',
                            borderRadius:'4px',
                            padding:'4px 8px',
                            fontSize:'10px',
                            cursor:'pointer'
                          }}
                        >
                          📎 Choose
                        </button>
                        {entry.attachment && (
                          <span style={{fontSize:9,color:'rgba(255,255,255,0.7)'}}>
                            {entry.attachment.name}
                            <button
                              type="button"
                              onClick={() => updateOptimiseEntry(entryIndex, 'attachment', null)}
                              style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.5)',marginLeft:2}}
                            >
                              ✕
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  default:
                    return null;
                }
              };
              
              return (
                <div>
                  {/* Table Header */}
                  <div style={{display:'grid',gridTemplateColumns:`repeat(${userFields.length}, 1fr) auto`,gap:4,marginBottom:6}}>
                    {userFields.map(field => renderField(field))}
                    <div></div>
                  </div>
                  
                  {/* Table Entries */}
                  <div style={{maxHeight:'200px',overflowY:'auto'}}>
                    {form.optimise_entries.map((entry, index) => (
                      <div key={index} style={{display:'grid',gridTemplateColumns:`repeat(${userFields.length}, 1fr) auto`,gap:4,marginBottom:6}}>
                        {userFields.map(field => renderEntryField(field, entry, index))}
                        <button
                          type="button"
                          onClick={() => removeOptimiseEntry(index)}
                          style={{
                            background:'rgba(239,68,68,0.2)',
                            border:'1px solid rgba(239,68,68,0.3)',
                            color:'#ef4444',
                            borderRadius:'4px',
                            padding:'4px 8px',
                            fontSize:'12px',
                            cursor:'pointer',
                            transition:'all 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background='rgba(239,68,68,0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background='rgba(239,68,68,0.2)';
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Add Entry Button */}
                  <button
                    type="button"
                    onClick={addOptimiseEntry}
                    style={{
                      background:'rgba(6,182,212,0.2)',
                      border:'1px solid rgba(6,182,212,0.3)',
                      color:'#06b6d4',
                      borderRadius:'6px',
                      padding:'6px 12px',
                      fontSize:'11px',
                      cursor:'pointer',
                      transition:'all 0.15s',
                      display:'flex',
                      alignItems:'center',
                      gap:'6px',
                      marginTop:'8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background='rgba(6,182,212,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background='rgba(6,182,212,0.2)';
                    }}
                  >
                    ➕ Add Entry
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{padding:'8px 12px',borderTop:'1px solid rgba(255, 255, 255, 0.1)',
        display:'flex',gap:8,justifyContent:'flex-end',background:'rgba(0, 0, 0, 0.2)'}}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} 
          style={{fontSize:11,padding:'4px 8px',background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.8)'}}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}
          style={{fontSize:11,padding:'4px 8px',background:'rgba(79,125,255,0.8)',border:'1px solid rgba(79,125,255,0.3)',color:'#fff'}}>
          {creating ? '⏳ Creating...' : '✓ Create'}
        </button>
      </div>
    </div>
  );
}
