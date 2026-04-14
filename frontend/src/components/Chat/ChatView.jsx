import React, { useState, useCallback } from 'react';
import ChatMessages from './ChatMessages';
import TasksPanel from '../Tasks/TasksPanel';
import PreviewPanel from '../Preview/PreviewPanel';
import SummaryPanel from './SummaryPanel';
import CampaignDetails from './CampaignDetails';

const TABS=[
  {key:'chat',    label:'Chat',       icon:'💬'},
  {key:'tasks',   label:'Tasks',      icon:'📋',badge:true},
  {key:'preview', label:'Preview',    icon:'👁️'},
  // {key:'followups',label:'Follow Ups',icon:'↩️'},
  // {key:'summary', label:'Summary',    icon:'📊'},
];

export default function ChatView({group}){
  const [activeTab,setActiveTab]=useState('chat');
  const [rightPanel,setRightPanel]=useState('cd');
  // task highlight: { taskId, openForm, taskType }
  const [taskTarget,setTaskTarget]=useState(null);

  // Called when user clicks a task pill in chat
  // taskType tells TasksPanel which form to open (e.g. 'share_link')
  const handleTaskClick=useCallback((taskId,taskType)=>{
    setActiveTab('tasks');
    setTaskTarget({taskId:Number(taskId),taskType,openForm:false,ts:Date.now()});
    // clear after 4s so re-clicking same task still triggers
    setTimeout(()=>setTaskTarget(null),4000);
  },[]);

  if(!group)return(
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,color:'var(--text-muted)'}}>
      <div style={{fontSize:56,opacity:.3}}>💬</div>
      <p style={{fontSize:15}}>Select a group to start chatting</p>
    </div>
  );

  return(
    <div style={{flex:1,display:'flex',minWidth:0}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>

        {/* header */}
        <div className="chat-header">
          <div className="chat-header-left">
            <div style={{width:36,height:36,borderRadius:'var(--radius-md)',background:'var(--accent-dim)',color:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,border:'1px solid var(--accent-border)'}}>
              {group.group_type==='campaign'?'📊':'💬'}
            </div>
            <div>
              <div className="chat-title">{group.group_name}</div>
              <div className="chat-subtitle">
                {group.campaign_name&&<span>{group.campaign_name} · </span>}
                {group.geo&&<span>{group.geo} · </span>}
                {group.payout&&<span>${group.payout}</span>}
              </div>
            </div>
          </div>
          <div className="chat-header-right">
            <button className={`btn btn-xs ${rightPanel==='cd'?'btn-primary':'btn-secondary'}`}
              onClick={()=>setRightPanel(p=>p==='cd'?null:'cd')}>
              {group.group_type==='campaign'?'CD':'GD'}
            </button>
          </div>
        </div>

        {/* tab bar */}
        <div className="shortcut-tabs">
          {TABS.map(tab=>(
            <button key={tab.key}
              className={`shortcut-tab ${activeTab===tab.key?'active':''}`}
              onClick={()=>setActiveTab(tab.key)}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {/* {tab.badge&&group.pending_tasks>0&&(
                <span style={{background:'#ef4444',color:'white',borderRadius:10,padding:'1px 5px',fontSize:9,fontWeight:700,marginLeft:2}}>
                  {group.pending_tasks}
                </span>
              )} */}
            </button>
          ))}
        </div>

        {/* content */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {activeTab==='chat'&&<ChatMessages group={group} onTaskClick={handleTaskClick}/>}
          {activeTab==='tasks'&&<TasksPanel group={group} taskTarget={taskTarget}/>}
          {activeTab==='preview'&&<PreviewPanel group={group}/>}
          {activeTab==='followups'&&<FollowUpsPanel group={group}/>}
          {activeTab==='summary'&&<SummaryPanel group={group}/>}
        </div>
      </div>

      {rightPanel==='cd'&&(
        <div className="right-panel">
          <div className="panel-header">{group.group_type==='campaign'?'Campaign Details':'Group Details'}</div>
          <div className="panel-content"><CampaignDetails group={group}/></div>
        </div>
      )}
    </div>
  );
}

function FollowUpsPanel({group}){
  const [fups,setFups]=React.useState([]);
  const [loading,setLoading]=React.useState(true);
  React.useEffect(()=>{
    import('../../utils/api').then(({tasksAPI})=>{
      tasksAPI.getFollowups(group.id)
        .then(d=>{setFups(d.followups||[]);setLoading(false);})
        .catch(()=>setLoading(false));
    });
  },[group.id]);
  return(
    <div style={{flex:1,overflowY:'auto',padding:16}}>
      {loading?<div style={{textAlign:'center',color:'var(--text-muted)',fontSize:13}}>Loading…</div>
      :fups.length===0?<div className="empty-state" style={{padding:40}}><div style={{fontSize:32}}>↩</div><p>No follow-ups yet.</p></div>
      :fups.map(fu=>(
        <div key={fu.id} className="card" style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:600}}>{fu.created_by_name}</span>
            <span style={{fontSize:11,color:'var(--text-muted)'}}>{new Date(fu.created_at).toLocaleDateString()}</span>
          </div>
          {fu.task_title&&<div style={{fontSize:11,color:'var(--accent)',marginBottom:4}}>Re: {fu.task_title}</div>}
          <p style={{fontSize:13,color:'var(--text-secondary)'}}>{fu.message}</p>
        </div>
      ))}
    </div>
  );
}
