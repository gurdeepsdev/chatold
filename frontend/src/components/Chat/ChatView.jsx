import React, { useState, useCallback, useEffect, useRef } from 'react';
import ChatMessages from './ChatMessages';
import TasksPanel from '../Tasks/TasksPanel';
import PreviewPanel from '../Preview/PreviewPanel';
import SummaryPanel from './SummaryPanel';
import CampaignDetails from './CampaignDetails';
import { Search } from 'lucide-react';

const TABS=[
  {key:'chat',    label:'Chat',    icon:'💬'},
  {key:'tasks',   label:'Tasks',   icon:'📋'},
  {key:'preview', label:'Preview', icon:'👁️'},
];

const PLACEHOLDER={
  chat:    'Search messages…',
  tasks:   'Search tasks…',
  preview: 'Search PIDs…',
};

export default function ChatView({group}){
  const [activeTab,setActiveTab]=useState('chat');
  const [rightPanel,setRightPanel]=useState('cd');
  const [showSearch,setShowSearch]=useState(false);
  const [searchQuery,setSearchQuery]=useState('');
  const [taskTarget,setTaskTarget]=useState(null);
  const searchInputRef=useRef(null);

  // Reset everything when switching groups
  useEffect(()=>{
    setActiveTab('chat');
    setShowSearch(false);
    setSearchQuery('');
  },[group]);

  // Focus input when search opens; clear query when it closes
  useEffect(()=>{
    if(showSearch) setTimeout(()=>searchInputRef.current?.focus(),50);
    else setSearchQuery('');
  },[showSearch]);

  // Clear query when switching tabs so stale results don't bleed over
  const handleTabChange=useCallback((key)=>{
    setActiveTab(key);
    setSearchQuery('');
  },[]);

  const handleTaskClick=useCallback((taskId,taskType)=>{
    setActiveTab('tasks');
    setTaskTarget({taskId:Number(taskId),taskType,openForm:false,ts:Date.now()});
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
          <div className="chat-header-right" style={{display:'flex',alignItems:'center',gap:6}}>
            <button
              className={`btn btn-xs ${showSearch?'btn-primary':'btn-secondary'}`}
              onClick={()=>setShowSearch(p=>!p)}
              title={`Search ${activeTab}`}
              style={{display:'flex',alignItems:'center',gap:4}}
            >
              <Search size={13}/>
            </button>
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
              onClick={()=>handleTabChange(tab.key)}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* search bar — shared, lives between tabs and content */}
        {showSearch&&(
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',borderBottom:'1px solid var(--border-color)',background:'var(--bg-secondary)',flexShrink:0}}>
            <Search size={13} style={{color:'var(--text-muted)',flexShrink:0}}/>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e=>setSearchQuery(e.target.value)}
              onKeyDown={e=>e.key==='Escape'&&setShowSearch(false)}
              placeholder={PLACEHOLDER[activeTab]||'Search…'}
              style={{flex:1,background:'none',border:'none',fontSize:13,color:'var(--text-primary)',outline:'none'}}
            />
            {searchQuery&&(
              <button onClick={()=>setSearchQuery('')}
                style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:12,padding:'0 4px'}}>
                Clear
              </button>
            )}
            <button onClick={()=>setShowSearch(false)}
              style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:16,lineHeight:1}}>
              ✕
            </button>
          </div>
        )}

        {/* content */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {activeTab==='chat'&&<ChatMessages group={group} onTaskClick={handleTaskClick} searchQuery={searchQuery}/>}
          {activeTab==='tasks'&&<TasksPanel group={group} taskTarget={taskTarget} searchQuery={searchQuery}/>}
          {activeTab==='preview'&&<PreviewPanel group={group} searchQuery={searchQuery}/>}
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
