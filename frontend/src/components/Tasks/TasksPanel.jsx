import React, { useState, useEffect, useRef, useCallback } from 'react';
import { tasksAPI, authAPI, getFileUrl } from '../../utils/api';
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

const emptyForm=(type='share_link')=>({
  task_type:type, title:'', description:'', assigned_to:'',
  pub_id:'', pid:'', link:'',
  pause_reason:'', request_type:'geo', request_details:'',
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
            <span style={{fontWeight:700,fontSize:13}}>{task.title}</span>
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
  const [form,setForm]=useState(emptyForm());
  const [creating,setCreating]=useState(false);
  const fileRef=useRef(null);
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

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
    if(!form.title)return toast.error('Title required');
    setCreating(true);
    try{
      let payload;
      if(form.attachment){
        payload=new FormData();
        Object.entries({group_id:group.id,campaign_id:group.campaign_id||'',...form}).forEach(([k,v])=>{
          if(k!=='attachment'&&v!==null&&v!==undefined)payload.append(k,String(v));
        });
        payload.append('attachment',form.attachment);
      }else{
        payload={group_id:group.id,campaign_id:group.campaign_id,...form};
        delete payload.attachment;
      }
      const data=await tasksAPI.create(payload);
      setTasks(prev=>[data.task,...prev]);
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
    const msg=prompt(`Follow-up for: "${task.title}"`);
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
            <div>
              <label className="form-label">Assign To</label>
              <select className="form-control" value={form.assigned_to} onChange={e=>f('assigned_to',e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select>
            </div>
          </div>

          {/* Only show title and description for non-share_link tasks */}
          {form.task_type !== 'share_link' && (
            <div style={{marginBottom:10}}>
              <label className="form-label">Title *</label>
              <input className="form-control" value={form.title} onChange={e=>f('title',e.target.value)} placeholder="Task title…"/>
            </div>
          )}
          {form.task_type !== 'share_link' && (
            <div style={{marginBottom:10}}>
              <label className="form-label">Description</label>
              <textarea className="form-control" style={{minHeight:50}} value={form.description} onChange={e=>f('description',e.target.value)} placeholder="Optional details…"/>
            </div>
          )}

          {/* Share Link */}
          {form.task_type==='share_link'&&(
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                <div><label className="form-label">PubID</label><input className="form-control" placeholder="Publisher ID" value={form.pub_id} onChange={e=>f('pub_id',e.target.value)}/></div>
                <div><label className="form-label">PID</label><input className="form-control" placeholder="PID" value={form.pid} onChange={e=>f('pid',e.target.value)}/></div>
              </div>
              <div style={{marginBottom:10}}>
                <label className="form-label">Tracking Link</label>
                <input className="form-control" placeholder="https://…" value={form.link} onChange={e=>f('link',e.target.value)}/>
              </div>
            </>
          )}

          {/* Pause PID */}
          {form.task_type==='pause_pid'&&(
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                <div><label className="form-label">PubID</label><input className="form-control" value={form.pub_id} onChange={e=>f('pub_id',e.target.value)}/></div>
                <div><label className="form-label">PID</label><input className="form-control" value={form.pid} onChange={e=>f('pid',e.target.value)}/></div>
              </div>
              <div style={{marginBottom:10}}>
                <label className="form-label">Pause Scenario</label>
                <select className="form-control" value={form.pause_reason} onChange={e=>f('pause_reason',e.target.value)}>
                  <option value="">Select scenario…</option>
                  {PAUSE_SCENARIOS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Raise Request */}
          {form.task_type==='raise_request'&&(
            <>
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
          {form.task_type==='optimise'&&(
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
                <div><label className="form-label">FP</label><input className="form-control" placeholder="e.g. 12%" value={form.fp} onChange={e=>f('fp',e.target.value)}/></div>
                <div><label className="form-label">F1</label><input className="form-control" value={form.f1} onChange={e=>f('f1',e.target.value)}/></div>
                <div><label className="form-label">F2</label><input className="form-control" value={form.f2} onChange={e=>f('f2',e.target.value)}/></div>
              </div>
              <div style={{marginBottom:10}}>
                <label className="form-label">Scenario</label>
                <select className="form-control" value={form.optimise_scenario} onChange={e=>f('optimise_scenario',e.target.value)}>
                  <option value="">Select…</option>
                  {OPTIMISE_SCENARIOS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{marginBottom:10}}>
                <label className="form-label">Attach File</label>
                <input ref={fileRef} type="file" style={{display:'none'}} onChange={e=>f('attachment',e.target.files[0])}/>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={()=>fileRef.current?.click()}>📎 Choose</button>
                  {form.attachment&&<span style={{fontSize:12,color:'var(--text-secondary)'}}>{form.attachment.name} <button type="button" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}} onClick={()=>f('attachment',null)}>✕</button></span>}
                </div>
              </div>
            </>
          )}

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
            <TaskItem task={task} currentUser={user} onStatusUpdate={handleStatusUpdate} onFollowup={handleFollowup}/>
          </div>
        ))}
      </div>
    </div>
  );
}
