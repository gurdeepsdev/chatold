import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';

/* ── Service Worker ─────────────────────────────────────────── */
export async function registerServiceWorker(){
  if(!('serviceWorker' in navigator))return null;
  try{
    const reg=await navigator.serviceWorker.register('/service-worker.js',{scope:'/'});
    return reg;
  }catch(e){console.error('[PWA] SW failed',e);return null;}
}

/* ── Permission ─────────────────────────────────────────────── */
export async function requestNotificationPermission(){
  if(!('Notification' in window))return false;
  if(Notification.permission==='granted')return true;
  if(Notification.permission==='denied')return false;
  const r=await Notification.requestPermission();
  return r==='granted';
}

/* ── App badge (Android PWA / desktop Chrome) ───────────────── */
async function setBadge(count){
  try{
    if('setAppBadge' in navigator){
      count>0?await navigator.setAppBadge(count):await navigator.clearAppBadge();
    }
  }catch{}
}

/* ── OS notification via Service Worker ─────────────────────── */
function showOsNotification(title,body,groupId){
  if(Notification.permission!=='granted')return;
  if(document.hasFocus()&&document.visibilityState==='visible')return;
  navigator.serviceWorker?.ready.then(reg=>{
    reg.showNotification(title,{
      body,
      icon:'/icon-192.png',
      badge:'/icon-72.png',
      tag: groupId?`g-${groupId}`:'crm',
      renotify:true,
      vibrate:[200,80,200,80,400],
      data:{group_id:groupId},
      actions:[{action:'open',title:'Open chat'}],
    });
  }).catch(()=>{
    // Fallback to basic Notification API
    const n=new Notification(title,{body,icon:'/icon-192.png'});
    n.onclick=()=>{window.focus();n.close();};
    setTimeout(()=>n.close(),6000);
  });
}

/* ── Notification sound ─────────────────────────────────────── */
function playSound(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const t=ctx.currentTime;
    [[880,t],[1100,t+0.13]].forEach(([freq,when])=>{
      const osc=ctx.createOscillator();
      const g=ctx.createGain();
      osc.connect(g);g.connect(ctx.destination);
      osc.type='sine';osc.frequency.value=freq;
      g.gain.setValueAtTime(0,when);
      g.gain.linearRampToValueAtTime(0.09,when+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,when+0.2);
      osc.start(when);osc.stop(when+0.22);
    });
  }catch{}
}

/* ── Rich in-app toast ──────────────────────────────────────── */
function showToast(data,onClick){
  // Use a custom div so we can make it big and obvious
  toast.custom(t=>(
    <div
      onClick={()=>{onClick?.(data.group_id);toast.dismiss(t.id);}}
      style={{
        display:'flex',alignItems:'flex-start',gap:12,
        background:'#0f1117',
        border:'1px solid #2a2f3d',
        borderLeft:'4px solid #4f7dff',
        borderRadius:14,padding:'14px 16px',
        cursor:'pointer',width:340,maxWidth:'95vw',
        boxShadow:'0 12px 40px rgba(0,0,0,.7)',
        animation:'notif-drop .35s cubic-bezier(.22,.68,0,1.2)',
        fontFamily:'inherit',
      }}
    >
      {/* avatar / icon */}
      <div style={{width:42,height:42,borderRadius:'50%',flexShrink:0,
        background:'linear-gradient(135deg,#4f7dff,#7c3aed)',
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
        💬
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:700,color:'#e8eaf0',marginBottom:2,
          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {data.title}
        </div>
        <div style={{fontSize:12,color:'#9399a8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {data.body}
        </div>
        {data.group_name&&(
          <div style={{fontSize:11,color:'#4f7dff',marginTop:3}}>📊 {data.group_name}</div>
        )}
      </div>
      <button
        onClick={e=>{e.stopPropagation();toast.dismiss(t.id);}}
        style={{background:'none',border:'none',color:'#555',cursor:'pointer',fontSize:16,padding:'0 2px',lineHeight:1,flexShrink:0}}
      >✕</button>
    </div>
  ),{duration:8000,position:'top-right'});
}

/* ── PWA Install Button ─────────────────────────────────────── */
export function PWAInstallButton(){
  const [prompt,setPrompt]=useState(null);
  const [installed]=useState(()=>window.matchMedia?.('(display-mode: standalone)').matches);
  useEffect(()=>{
    const h=e=>{e.preventDefault();setPrompt(e);};
    window.addEventListener('beforeinstallprompt',h);
    window.addEventListener('appinstalled',()=>setPrompt(null));
    return()=>window.removeEventListener('beforeinstallprompt',h);
  },[]);
  if(installed||!prompt)return null;
  const install=async()=>{prompt.prompt();const{outcome}=await prompt.userChoice;if(outcome==='accepted')toast.success('Installing…');setPrompt(null);};
  return(
    <button onClick={install} style={{display:'flex',alignItems:'center',gap:6,
      background:'linear-gradient(135deg,#4f7dff,#7c3aed)',border:'none',borderRadius:8,
      padding:'8px 14px',color:'white',fontSize:12,fontWeight:700,cursor:'pointer',
      fontFamily:'inherit',boxShadow:'0 2px 16px rgba(79,125,255,.5)',
      animation:'pwa-pulse 2.5s ease-in-out infinite'}}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Install App
    </button>
  );
}

/* ── Main hook ──────────────────────────────────────────────── */
export function useNotifications(onGroupClick){
  const {on}=useSocket();
  // ✅ FIX: return 'permission' (matches what App.jsx used to destructure as 'notifPermission')
  // We now return BOTH names so App.jsx works either way
  const [permission,setPermission]=useState(()=>Notification?.permission||'default');
  const [unreadCount,setUnreadCount]=useState(0);

  // Register SW once on mount
  useEffect(()=>{
    registerServiceWorker();
    // Listen for notification click from SW (when app was in background)
    navigator.serviceWorker?.addEventListener('message',ev=>{
      if(ev.data?.type==='NOTIFICATION_CLICK') onGroupClick?.(ev.data.group_id);
    });
  },[]);// eslint-disable-line

  // Ask for permission automatically after 1.5s if not yet decided
  useEffect(()=>{
    if(Notification?.permission!=='default')return;
    const t=setTimeout(async()=>{
      const ok=await requestNotificationPermission();
      setPermission(ok?'granted':'denied');
      if(ok)toast.success('🔔 Notifications enabled!');
    },1500);
    return()=>clearTimeout(t);
  },[]);

  /* push_notification from socket */
  const handlePush=useCallback((data)=>{
    setUnreadCount(c=>{
      const n=c+1;
      setBadge(n);
      return n;
    });
    showToast(data,onGroupClick);
    showOsNotification(data.title,data.body,data.group_id);
    playSound();
  },[onGroupClick]);

  /* notification_count from socket */
  const handleCount=useCallback(({count})=>{
    setUnreadCount(count);
    setBadge(count);
  },[]);

  useEffect(()=>{
    const u1=on('push_notification',handlePush);
    const u2=on('notification_count',handleCount);
    return()=>{u1?.();u2?.();};
  },[on,handlePush,handleCount]);

  // Tab title badge
  useEffect(()=>{
    document.title=unreadCount>0?`(${unreadCount}) CRM Chat`:'CRM Chat';
  },[unreadCount]);

  const requestPermission=async()=>{
    const ok=await requestNotificationPermission();
    setPermission(ok?'granted':'denied');
    if(ok)toast.success('🔔 Notifications enabled!');
    return ok;
  };

  const clearUnread=useCallback(()=>{setUnreadCount(0);setBadge(0);},[]);

  // Return BOTH 'permission' and 'notifPermission' so nothing breaks
  return{permission,notifPermission:permission,unreadCount,clearUnread,requestPermission};
}
