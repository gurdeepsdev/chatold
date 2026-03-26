import React, { useState, useEffect, useRef, useCallback } from 'react';
import { tasksAPI, authAPI, groupsAPI, getFileUrl } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const TASK_TYPES={
  initial_setup:{label:'Initial Setup',icon:'🚀',color:'#a855f7'},
  share_link:   {label:'Share Link',   icon:'🔗',color:'#4f7dff'},
  pause_pid:    {label:'Pause PID',    icon:'⏸️',color:'#f59e0b'},
  raise_request:{label:'Raise Request',icon:'📋',color:'#22c55e'},
  optimise:     {label:'Optimise',     icon:'⚡',color:'#06b6d4'},
};

const PAUSE_SCENARIOS=[
  'Low Quality Traffic','Fraud Detected','Budget Exhausted',
  'Geo Mismatch','KPI Not Met','Technical Issue','Advertiser Request','Other'
];
const OPTIMISE_SCENARIOS=[
  'Increase Budget','Decrease Budget','Expand GEO','Restrict GEO',
  'Update KPI Target','Change Payout','Pause Sub-publisher',
  'Whitelist Publisher','Blacklist Publisher','Other'
];
const REQUEST_TYPES=['geo','payout','link','budget'];

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

const emptyForm=(type='share_link')=>({
  task_type:type, description:'', assigned_to:'',
  entries: [{ pub_id:'', pid:'', link:'', assigned_to:'', note:'' }],
  pause_entries: [{ pub_id:'', pid:'', assigned_to:'', pause_reason:'' }],
optimise_entries: [{
  assigned_to:'', pub_id:'', pid:'', fp:'', fa:'', f1:'', f2:'', optimise_scenario:'', attachment:null
}],  pause_reason:'', request_type:'geo', request_details:'',
  fp:'', f1:'', f2:'', optimise_scenario:'', attachment:null,
});

/* ── Task item ─────────────────────────────────────────────── */
function TaskItem({task,currentUser,onStatusUpdate,onFollowup}){
  const [expanded,setExpanded]=useState(false);
  const [comment,setComment]=useState('');
  const [busy,setBusy]=useState(false);
  const type=TASK_TYPES[task.task_type]||TASK_TYPES.initial_setup;
  const sc={pending:'#f59e0b',accepted:'#4f7dff',completed:'#22c55e',rejected:'#ef4444'};

  const doStatus=async(status)=>{
    setBusy(true);
    try{await onStatusUpdate(task.id,status,comment);toast.success(`Task ${status}`);setComment('');setExpanded(false);}
    catch{toast.error('Failed to update');}
    setBusy(false);
  };

  

  return(
    <div style={{marginBottom:10,borderRadius:10,background:'var(--bg-secondary)',border:'1px solid var(--border)',borderLeft:`3px solid ${type.color}`,padding:'12px 14px'}}>
      <div style={{display:'flex',gap:10}}>
        <span style={{fontSize:20}}>{type.icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
            <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:20,background:`${sc[task.status]}20`,color:sc[task.status],border:`1px solid ${sc[task.status]}40`,textTransform:'uppercase',letterSpacing:'.5px'}}>{task.status}</span>
            <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:`${type.color}15`,color:type.color}}>{type.label}</span>
          </div>
          {task.description&&<div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:6}}>{task.description}</div>}
          <div style={{display:'flex',gap:12,fontSize:11,color:'var(--text-muted)',marginBottom:8,flexWrap:'wrap'}}>
            <span>By {task.assigned_by_name}</span>
            {task.assigned_to_name&&<span>→ {task.assigned_to_name}</span>}
            <span style={{marginLeft:'auto'}}>{format(new Date(task.created_at),'MMM d, HH:mm')}</span>
          </div>
          {/* extra fields */}
          {(task.pub_id||task.pid||task.link||task.pause_reason||task.fp||task.optimise_scenario)&&(
            <div style={{background:'var(--bg-active)',borderRadius:8,padding:'8px 10px',marginBottom:8,fontSize:12}}>
              {task.pub_id&&<div style={{marginBottom:2}}><span style={{color:'var(--text-muted)'}}>PubID: </span><code style={{color:'var(--accent)'}}>{task.pub_id}</code></div>}
              {task.pid&&<div style={{marginBottom:2}}><span style={{color:'var(--text-muted)'}}>PID: </span><code style={{color:'var(--accent)'}}>{task.pid}</code></div>}
              {task.link&&<div style={{marginBottom:2}}><span style={{color:'var(--text-muted)'}}>Link: </span><a href={task.link} target="_blank" rel="noreferrer" style={{color:'var(--accent)',wordBreak:'break-all'}}>{task.link}</a></div>}
              {task.pause_reason&&<div style={{color:'#f59e0b'}}>⚠️ {task.pause_reason}</div>}
              {task.request_type&&<div><span style={{color:'var(--text-muted)'}}>Request: </span><strong style={{textTransform:'uppercase'}}>{task.request_type}</strong> – {task.request_details}</div>}
              {task.fp&&<div><span style={{color:'var(--text-muted)'}}>FP: </span>{task.fp}</div>}
              {task.f1&&<div><span style={{color:'var(--text-muted)'}}>F1: </span>{task.f1}</div>}
              {task.f2&&<div><span style={{color:'var(--text-muted)'}}>F2: </span>{task.f2}</div>}
              {task.optimise_scenario&&<div><span style={{color:'var(--text-muted)'}}>Scenario: </span><span style={{color:'#06b6d4'}}>{task.optimise_scenario}</span></div>}
              {task.attachment_url&&(
                <a href={getFileUrl(task.attachment_url)} download={task.attachment_name} target="_blank" rel="noreferrer"
                  style={{display:'inline-flex',alignItems:'center',gap:4,color:'var(--accent)',fontSize:11,marginTop:4,textDecoration:'none',background:'var(--bg-primary)',padding:'3px 8px',borderRadius:6,border:'1px solid var(--border)'}}>
                  📎 {task.attachment_name||'Attachment'} ⬇
                </a>
              )}
            </div>
          )}
          {/* actions */}
          {task.status==='pending'&&(
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
              <button className="btn btn-xs btn-success" onClick={()=>doStatus('accepted')} disabled={busy}>✓ Accept</button>
              <button className="btn btn-xs btn-danger"  onClick={()=>doStatus('rejected')} disabled={busy}>✗ Reject</button>
              <button className="btn btn-xs btn-primary" onClick={()=>doStatus('completed')} disabled={busy}>✔ Complete</button>
              <button className="btn-icon" style={{padding:'3px 8px',fontSize:11,border:'1px solid var(--border)',borderRadius:6}} onClick={()=>setExpanded(x=>!x)}>
                {expanded?'▲':'+ Note'}
              </button>
            </div>
          )}
          {task.status==='accepted'&&(
            <button className="btn btn-xs btn-success" style={{marginTop:6}} onClick={()=>doStatus('completed')} disabled={busy}>✔ Mark Complete</button>
          )}
          {expanded&&<textarea className="form-control" style={{minHeight:56,fontSize:12,marginTop:8}} placeholder="Comment…" value={comment} onChange={e=>setComment(e.target.value)}/>}
          {(task.status==='completed'||task.status==='rejected')&&(
            <button className="btn btn-xs btn-secondary" style={{marginTop:6}} onClick={()=>onFollowup(task)}>↩ Follow Up</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main TasksPanel ────────────────────────────────────────── */
export default function TasksPanel({group, taskTarget}){
  const {user}=useAuth();
  const {on}=useSocket();
  const [tasks,setTasks]=useState([]);
  const [filter,setFilter]=useState('all');
  const [showCreate,setShowCreate]=useState(false);
  const [users,setUsers]=useState([]);
  const [members,setMembers]=useState([]);
  const [form,setForm]=useState(emptyForm());
  const [creating,setCreating]=useState(false);
  const fileRef=useRef(null);
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  // API call to get group members
  useEffect(() => {
    if (!group) return;
    groupsAPI.getById(group.id).then(d => setMembers(d.members || []));
    authAPI.getUsers().then(d => setUsers(d.users || []));
  }, [group?.id]);

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
                        {members.map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}
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

  const load=useCallback(async()=>{
    if(!group)return;
    const data=await tasksAPI.getByGroup(group.id);
    setTasks(data.tasks||[]);
  },[group?.id]);// eslint-disable-line

  useEffect(()=>{
    load();
    authAPI.getUsers().then(d=>setUsers(d.users||[]));
  },[group?.id]);// eslint-disable-line

  useEffect(()=>{
    const unsub=on('task_update',({action,task,task_id,status})=>{
      if(action==='created')setTasks(prev=>[task,...prev]);
      if(action==='status_changed')setTasks(prev=>prev.map(t=>t.id===task_id?{...t,status}:t));
    });
    return unsub;
  },[on]);

  /* ── Handle taskTarget from chat pill click ──
     If taskTarget.openForm === true: open the create form pre-set to that task type
     Also highlight the task if we have a taskId */
  useEffect(()=>{
    if(!taskTarget)return;
    const {taskId,taskType,openForm}=taskTarget;
    // Scroll to / highlight existing task
    if(taskId){
      setTimeout(()=>{
        const el=document.getElementById(`task-${taskId}`);
        if(el){
          el.scrollIntoView({behavior:'smooth',block:'center'});
          el.style.transition='box-shadow .2s';
          el.style.boxShadow='0 0 0 2px #4f7dff';
          setTimeout(()=>el.style.boxShadow='',2500);
        }
      },150);
    }
    // Open create form pre-filled with that task type
    if(openForm&&taskType){
      setForm(emptyForm(taskType));
      setShowCreate(true);
    }
  },[taskTarget]);// re-runs each time taskTarget changes (new ts)

  const handleCreate=async()=>{
    // Validate share_link entries
    if (form.task_type === 'share_link') {
      const validEntries = form.entries.filter(entry => 
        entry.pub_id.trim() || entry.pid.trim() || entry.link.trim()
      );
      if (validEntries.length === 0) {
        return toast.error('Please fill in at least one entry (PubID, PID, or Link)');
      }
    }
    // Validate pause_pid entries
    if (form.task_type === 'pause_pid') {
      const validPauseEntries = form.pause_entries.filter(entry => 
        entry.pub_id.trim() || entry.pid.trim() || entry.pause_reason.trim()
      );
      if (validPauseEntries.length === 0) {
        return toast.error('Please fill in at least one entry (PubID, PID, or Pause Reason)');
      }
    }
    // Validate optimise entries
    if (form.task_type === 'optimise') {
      const validOptimiseEntries = form.optimise_entries.filter(entry => 
        entry.pub_id.trim() || entry.pid.trim() || entry.fp.trim() || entry.fa.trim() || entry.f1.trim() || entry.f2.trim() || entry.optimise_scenario.trim()
      );
      if (validOptimiseEntries.length === 0) {
        return toast.error('Please fill in at least one entry (PubID, PID, FP, FA, F1, F2, or Scenario)');
      }
    }
    setCreating(true);
    try{
      let payload;
      if(form.attachment){
        payload=new FormData();
        Object.entries({group_id:group.id,campaign_id:group.campaign_id||'',...form}).forEach(([k,v])=>{
          if(k!=='attachment'&&k!=='entries'&&k!=='pause_entries'&&k!=='optimise_entries'&&v!==null&&v!==undefined)payload.append(k,String(v));
        });
        if(form.task_type === 'share_link') payload.append('entries',JSON.stringify(form.entries));
        if(form.task_type === 'pause_pid') payload.append('pause_entries',JSON.stringify(form.pause_entries));
        if(form.task_type === 'optimise') payload.append('optimise_entries',JSON.stringify(form.optimise_entries));
        payload.append('attachment',form.attachment);
      }else{
        payload={group_id:group.id,campaign_id:group.campaign_id,...form};
        delete payload.attachment;
        if(form.task_type !== 'share_link') delete payload.entries;
        if(form.task_type !== 'pause_pid') delete payload.pause_entries;
        if(form.task_type !== 'optimise') delete payload.optimise_entries;
      }
      const data=await tasksAPI.create(payload);
      if(data.subTasks && data.subTasks.length > 0){
        setTasks(prev=>[data.task,...prev,...data.subTasks]);
      }else{
        setTasks(prev=>[data.task,...prev]);
      }
      setShowCreate(false);
      setForm(emptyForm());
      toast.success('Task created!');
    }catch(e){toast.error(e?.error||'Failed');}
    setCreating(false);
  };

  const handleStatusUpdate=async(taskId,status,comment)=>{
    await tasksAPI.updateStatus(taskId,status,comment);
    setTasks(prev=>prev.map(t=>t.id===taskId?{...t,status}:t));
  };

  const handleFollowup=async(task)=>{
    const msg=prompt(`Follow-up for: ${type.label} task`);
    if(!msg)return;
    await tasksAPI.createFollowup({group_id:group.id,task_id:task.id,message:msg});
    toast.success('Follow-up added!');
  };

  const filtered=tasks.filter(t=>filter==='all'?true:t.status===filter);
  const pendingCount=tasks.filter(t=>t.status==='pending').length;

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>

      {/* filter bar */}
      <div style={{display:'flex',gap:6,padding:'10px 14px',borderBottom:'1px solid var(--border)',flexWrap:'wrap',alignItems:'center'}}>
        {['all','pending','accepted','completed','rejected'].map(f2=>(
          <button key={f2} onClick={()=>setFilter(f2)}
            className={`btn btn-xs ${filter===f2?'btn-primary':'btn-secondary'}`}
            style={{textTransform:'capitalize'}}>
            {f2}
            {f2==='pending'&&pendingCount>0&&(
              <span style={{marginLeft:4,background:'#ef4444',color:'white',borderRadius:10,padding:'0 5px',fontSize:9,fontWeight:700}}>{pendingCount}</span>
            )}
          </button>
        ))}
        <button className="btn btn-xs btn-primary" style={{marginLeft:'auto'}} onClick={()=>{setShowCreate(x=>!x);if(!showCreate)setForm(emptyForm());}}>
          {showCreate?'✕ Cancel':'+ New Task'}
        </button>
      </div>

      {/* CREATE FORM */}
      {showCreate&&(
        <div style={{padding:16,borderBottom:'1px solid var(--border)',background:'var(--bg-tertiary)',overflowY:'auto',maxHeight:500}}>

          {/* banner for share_link pre-fill */}
          {form.task_type==='share_link'&&(
            <div style={{marginBottom:12,padding:'8px 12px',background:'rgba(79,125,255,.1)',borderRadius:8,border:'1px solid rgba(79,125,255,.3)',fontSize:12,color:'#4f7dff',fontWeight:600}}>
              🔗 Fill in the campaign link details and assign to a publisher
            </div>
          )}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>
              <label className="form-label">Task Type</label>
              <select className="form-control" value={form.task_type} onChange={e=>f('task_type',e.target.value)}>
                {Object.entries(TASK_TYPES).filter(([k])=>k!=='initial_setup').map(([k,v])=>(
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            {/* <div>
              <label className="form-label">Assign To</label>
              <select className="form-control" value={form.assigned_to} onChange={e=>f('assigned_to',e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select>
            </div> */}
          </div>

          {/* Share Link */}
          {form.task_type==='share_link'&&(
            <div style={{padding:'8px 10px',background:'rgba(79,125,255,0.1)',borderRadius:6,
              border:'1px solid rgba(79,125,255,0.2)',marginBottom:10}}>
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
                      {members.map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}
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

          {/* Pause PID */}
          {form.task_type==='pause_pid'&&(
            <div style={{padding:'8px 10px',background:'rgba(245,158,11,0.1)',borderRadius:6,
              border:'1px solid rgba(245,158,11,0.2)',marginBottom:10}}>
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
                      {members.map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}
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

          {/* Raise Request */}
          {form.task_type==='raise_request'&&(
            <>
              <div style={{marginBottom:10}}>
                <label className="form-label">Assign To</label>
                <select className="form-control" value={form.assigned_to} onChange={e=>f('assigned_to',e.target.value)}>
                  <option value="">Unassigned</option>
                  {members.map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                </select>
              </div>
              <div style={{marginBottom:10}}>
                <label className="form-label">Request Type</label>
                <select className="form-control" value={form.request_type} onChange={e=>f('request_type',e.target.value)}>
                  {REQUEST_TYPES.map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
              <div style={{marginBottom:10}}>
                <label className="form-label">Details</label>
                <textarea className="form-control" style={{minHeight:60}} value={form.request_details} onChange={e=>f('request_details',e.target.value)} placeholder="Describe…"/>
              </div>
            </>
          )}

          {/* Optimise */}
       {form.task_type === 'optimise' && (() => {
  const userFields = OPTIMISE_FIELDS[user?.role] || OPTIMISE_FIELDS.am;

  const renderHeader = (field) => {
    const labels = {
      assigned_to: 'Assign To',
      pub_id: 'PubID',
      pid: 'PID',
      fp: 'FP',
      fa: 'FA',
      f1: 'F1',
      f2: 'F2',
      optimise_scenario: 'Scenario',
      attachment: 'Attachment'
    };
    return (
      <div key={field} style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:500}}>
        {labels[field]}
      </div>
    );
  };

  return (
    <div style={{
      padding:'8px 10px',
      background:'rgba(6,182,212,0.1)',
      borderRadius:6,
      border:'1px solid rgba(6,182,212,0.2)',
      marginBottom:10
    }}>
      <div style={{
        fontSize:10,
        color:'rgba(255,255,255,0.9)',
        fontWeight:600,
        marginBottom:6
      }}>
        ⚡ Optimise
      </div>

      {/* Header */}
      <div style={{
        display:'grid',
        gridTemplateColumns:`repeat(${userFields.length}, 1fr) auto`,
        gap:4,
        marginBottom:6
      }}>
        {userFields.map(renderHeader)}
        <div></div>
      </div>

      {/* Rows */}
      <div style={{maxHeight:'200px',overflowY:'auto'}}>
        {form.optimise_entries.map((entry, index) => (
          <div key={index} style={{
            display:'grid',
            gridTemplateColumns:`repeat(${userFields.length}, 1fr) auto`,
            gap:4,
            marginBottom:6
          }}>
            {userFields.map(field =>
              renderEntryField(field, entry, index)
            )}

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
                cursor:'pointer'
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add Row */}
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
          display:'flex',
          alignItems:'center',
          gap:'6px',
          marginTop:'8px'
        }}
      >
        ➕ Add Entry
      </button>
    </div>
  );
})()}

          <button className="btn btn-primary" style={{width:'100%',marginTop:4}} onClick={handleCreate} disabled={creating}>
            {creating?'Creating…':'✓ Create Task'}
          </button>
        </div>
      )}

      {/* task list */}
      <div style={{flex:1,overflowY:'auto',padding:'10px 12px'}}>
        {filtered.length===0?(
          <div className="empty-state" style={{padding:40}}><div style={{fontSize:32}}>✅</div><p>No {filter!=='all'?filter:''} tasks</p></div>
        ):filtered.map(task=>(
          <div id={`task-${task.id}`} key={task.id}>
            <TaskItem 
              key={task.id} 
              task={task} 
              currentUser={user} 
              onStatusUpdate={handleStatusUpdate} 
              onFollowup={handleFollowup}
              group={group} 
            />
          </div>
        ))}
      </div>
    </div>
  );
}
