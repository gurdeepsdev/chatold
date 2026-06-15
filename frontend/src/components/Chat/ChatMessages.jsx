// import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// import { messagesAPI, authAPI } from '../../utils/api';
// import { useAuth } from '../../context/AuthContext';
// import { useSocket } from '../../context/SocketContext';
// import { format, isToday, isYesterday, isSameDay } from 'date-fns';
// import toast from 'react-hot-toast';
// import ForwardModal from './ForwardModal';
// import TaskQuickPopup from '../Tasks/TaskQuickPopup';
// import MessageSender from './MessageSender';
// import './ChatMessages.css';

// /* ── helpers ───────────────────────────────────────────────── */
// const COLORS=['#4f7dff','#a855f7','#22c55e','#f59e0b','#ef4444','#06b6d4'];
// function ac(n=''){let h=0;for(const c of n)h=c.charCodeAt(0)+((h<<5)-h);return COLORS[Math.abs(h)%COLORS.length];}
// function ini(n=''){return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}
// function fd(d){const dt=new Date(d);if(isToday(dt))return'Today';if(isYesterday(dt))return'Yesterday';return format(dt,'MMMM d, yyyy');}
// function ft(d){return format(new Date(d),'HH:mm');}
// function fs(b){if(!b)return'';if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(1)+' MB';}
// function fi(m){if(!m)return'📄';if(m.startsWith('image/'))return'🖼️';if(m.startsWith('audio/'))return'🎵';if(m.includes('pdf'))return'📕';if(m.includes('sheet')||m.includes('excel')||m.includes('csv'))return'📊';if(m.includes('word'))return'📝';if(m.includes('zip'))return'🗜️';return'📎';}

// /* ── Task pill ─────────────────────────────────────────────── */
// const TM={initial_setup:{i:'🚀',c:'#a855f7'},share_link:{i:'🔗',c:'#4f7dff'},pause_pid:{i:'⏸️',c:'#f59e0b'},raise_request:{i:'📋',c:'#22c55e'},optimise:{i:'⚡',c:'#06b6d4'}};
// function TaskPill({taskRef,onTaskClick}){
//   if(!taskRef)return null;
//   const m=TM[taskRef.task_type]||TM.share_link;
//   return(
//     <span onClick={()=>onTaskClick?.(taskRef.task_id,taskRef.task_type)}
//       style={{display:'inline-flex',alignItems:'center',gap:5,background:`${m.c}18`,border:`1px solid ${m.c}40`,
//         borderRadius:20,padding:'2px 10px',cursor:'pointer',fontSize:11,color:m.c,fontWeight:600,
//         marginTop:4,userSelect:'none',transition:'background .15s'}}
//       onMouseEnter={e=>e.currentTarget.style.background=`${m.c}30`}
//       onMouseLeave={e=>e.currentTarget.style.background=`${m.c}18`}>
//       {m.i} {taskRef.task_title} <span style={{fontSize:9,opacity:.6}}>→ open</span>
//     </span>
//   );
// }

// /* ── Single bubble ─────────────────────────────────────────── */
// function Bubble({msg,isOwn,showAvatar,onTaskClick,group,onDeleteMessage}){
//   const {user} = useAuth();
//   const [showOptions, setShowOptions] = useState(false);
//   const [localReactions, setLocalReactions] = useState(msg.reactions || []);
//   const [showForwardModal, setShowForwardModal] = useState(false);
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);
//   const [onDeleteMessageState, setOnDeleteMessageState] = useState(null);
//   const messageRef = useRef(null);
  
//   // Sync local reactions with message reactions when they change
//   useEffect(() => {
//     setLocalReactions(msg.reactions || []);
//   }, [msg.reactions]);
  
//   const handleCopy = () => {
//     const textToCopy = msg.content;
//     navigator.clipboard.writeText(textToCopy).then(() => {
//       toast.success('Message copied to clipboard!');
//     }).catch(() => {
//       toast.error('Failed to copy message');
//     });
//   };

//   const handleDelete = async () => {
//     try {
//       await messagesAPI.deleteMessage(group.id, msg.id);
//       if (onDeleteMessageState) {
//         onDeleteMessageState(msg.id);
//       }
//       toast.success('Message deleted');
//     } catch (error) {
//       toast.error('Failed to delete message');
//     }
//   };

//   const handleReaction = async (emoji) => {
//     try {
//       const existingReaction = localReactions.find(r => r.user_id === user?.id && r.emoji === emoji);
      
//       if (existingReaction) {
//         await messagesAPI.removeReaction(group.id, msg.id, emoji);
//         setLocalReactions(prev => prev.filter(r => !(r.user_id === user?.id && r.emoji === emoji)));
//       } else {
//         await messagesAPI.addReaction(group.id, msg.id, emoji);
//         setLocalReactions(prev => [...prev.filter(r => !(r.user_id === user?.id)), { user_id: user?.id, emoji }]);
//       }
//     } catch (error) {
//       toast.error('Failed to add reaction');
//     }
//   };

//   const fileUrl = msg.file_url ? (msg.file_url.startsWith('http') ? msg.file_url : `${process.env.REACT_APP_API_URL}${msg.file_url}`) : null;

//   return(
//     <div className={`message-row ${isOwn?'own':''}`}>
//       {!isOwn&&(
//         <div className="sender-avatar">
//           <div className="avatar-circle" style={{background: ac(msg.sender_name)}}>
//             {ini(msg.sender_name)}
//           </div>
//         </div>
//       )}
      
//       <div className="message-wrapper">
//         {showAvatar&&!isOwn&&(
//           <div className="message-header">
//             <span className="sender-name">{msg.sender_name}</span>
//             <span className="sender-role">{msg.sender_role}</span>
//           </div>
//         )}
        
//         {msg.reply_content&&(
//           <div className="reply-bubble">
//             <div className="reply-content">
//               <span className="reply-label">Replying to {msg.reply_sender_name}</span>
//               <span className="reply-text">{msg.reply_content}</span>
//             </div>
//           </div>
//         )}
        
     


//         {/* <div 
//   ref={messageRef}
//   className={`message-bubble ${isOwn ? 'own' : 'received'} ${msg.message_type}`}
//   onClick={() => setShowOptions(!showOptions)}
//   onMouseLeave={() => setShowOptions(false)}
  
// > */}
// <div 
//   ref={messageRef}
//   className={`message-bubble ${isOwn ? 'own' : 'received'} ${msg.message_type}`}
//   onMouseEnter={() => setShowEmojiPicker(true)}
//   onMouseLeave={() => setShowEmojiPicker(false)}
// >

//   {/* Image */}
//   {msg.message_type === 'image' && fileUrl && (
//     <div className="media-content">
//       <img
//         src={fileUrl}
//         alt="Shared image"
//         loading="lazy"
//         onClick={(e) => {
//           e.stopPropagation();
//           window.open(fileUrl, '_blank');
//         }}
//       />
//     </div>
//   )}

//   {/* Audio */}
//   {msg.message_type === 'audio' && fileUrl && (
//     <div className="media-content">
//       <audio controls>
//         <source src={fileUrl} type={msg.mime_type || 'audio/mpeg'} />
//         Your browser does not support the audio element.
//       </audio>
//     </div>
//   )}

//   {/* Video */}
//   {msg.message_type === 'video' && fileUrl && (
//     <div className="media-content">
//       <video controls width="300" height="200">
//         <source src={fileUrl} type={msg.mime_type || 'video/mp4'} />
//         Your browser does not support the video element.
//       </video>
//     </div>
//   )}

//   {/* File */}
//   {msg.message_type === 'file' && fileUrl && (
//     <div className="file-content" onClick={() => window.open(fileUrl, '_blank')}>
//       <div className="file-icon">{msg.file_icon || '📄'}</div>
//       <div className="file-info">
//         <div className="file-name">{msg.file_name}</div>
//         <div className="file-size">{fs(msg.file_size)}</div>
//       </div>
//     </div>
//   )}

//   {/* Text Content */}
//   <div className="text-content">
//     <div className="message-text">{msg.content}</div>
//     {msg.task_ref && (
//       <TaskPill taskRef={msg.task_ref} onTaskClick={onTaskClick} />
//     )}
//   </div>

// </div>
//         {/* Reactions */}
//         {localReactions.length > 0 && (
//           <div className="reactions-bar">
//             {localReactions.map((reaction, index) => (
//               <div
//                 key={index}
//                 className={`reaction-item ${reaction.user_id === user?.id ? 'own-reaction' : ''}`}
//                 onClick={() => handleReaction(reaction.emoji)}
//               >
//                 <span className="reaction-emoji">{reaction.emoji}</span>
//                 <span className="reaction-count">{reaction.count || 1}</span>
//               </div>
//             ))}
//           </div>
//         )}

//         {/* Emoji Picker on Hover - Larger trigger area */}
//         <div 
//           className="emoji-picker-trigger"
//           onMouseEnter={() => setShowEmojiPicker(true)}
//           onMouseLeave={() => setShowEmojiPicker(false)}
//         >
//           {/* <div className="emoji-picker-hint">
//             h
//           </div> */}
//           {showEmojiPicker && (
//             <div className="emoji-picker">
//               {['❤️', '👍', '😊', '😂', '🎉', '🔥', '💯', '😢', '😡', '👎'].map((emoji) => (
//                 <button
//                   key={emoji}
//                   className="emoji-btn"
//                   onClick={() => handleReaction(emoji)}
//                 >
//                   {emoji}
//                 </button>
//               ))}
//             </div>
            
//           )}
//           <div 
//   className="message-actions"
//   onClick={(e) => {
//     e.stopPropagation();
//     setShowOptions(!showOptions);
//   }}
// >
//   ⋮
// </div>
//         </div>

//         {/* Message Options */}
//         {showOptions && (
//           <div className=""
//               onClick={(e) => e.stopPropagation()} // prevent closing
// >
//             <button className="option-btn" onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
//               <span className="option-icon">📋</span>
//               <span className="option-text">Copy</span>
//             </button>
//             {/* <button className="option-btn" onClick={(e) => { e.stopPropagation(); setShowForwardModal(true); }}>
//               <span className="option-icon">↗️</span>
//               <span className="option-text">Forward</span>
//             </button> */}
//             {isOwn && (
//               <button className="option-btn delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(); }}>
//                 <span className="option-icon">🗑️</span>
//                 <span className="option-text">Delete</span>
//               </button>
//             )}
//           </div>
//         )}
//       </div>
//       {showForwardModal && (
//         <ForwardModal
//           message={msg}
//           onClose={() => setShowForwardModal(false)}
//           onForward={(targetGroupId) => {
//             messagesAPI.forwardMessage(targetGroupId, {
//               content: msg.content,
//               message_type: msg.message_type,
//               file_url: msg.file_url,
//               file_name: msg.file_name,
//               file_size: msg.file_size,
//               mime_type: msg.mime_type
//             }).then(() => {
//               toast.success('Message forwarded successfully!');
//               setShowForwardModal(false);
//             }).catch((error) => {
//               toast.error('Failed to forward message');
//             });
//           }}
//         />
//       )}
//     </div>
//   );
// }

// /* ── Main ──────────────────────────────────────────────────── */
// export default function ChatMessages({group,onTaskClick}){
//   const {user}=useAuth();
//   const {on,joinGroup,markSeen,sendTyping}=useSocket();
//   const [messages,setMessages]=useState([]);
//   const [loading,setLoading]=useState(true);
//   const [page,setPage]=useState(1);
//   const [hasMore,setHasMore]=useState(false);
//   const [replyTo,setReplyTo]=useState(null);
//   const [typingUsers,setTypingUsers]=useState([]);
//   const [showTaskPopup,setShowTaskPopup]=useState(false);

//   const bottomRef=useRef(null);
//   const groupIdRef=useRef(null);
//   const msRef=useRef(markSeen);
//   useEffect(()=>{groupIdRef.current=group?.id?Number(group.id):null;},[group?.id]);
//   useEffect(()=>{msRef.current=markSeen;},[markSeen]);

//   const load=useCallback(async(p=1)=>{
//     if(!group)return;
//     if(p===1)setLoading(true);
//     try{
//       const data=await messagesAPI.getMessages(group.id,p);
//       if(p===1){setMessages(data.messages||[]);setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'instant'}),80);}
//       else{setMessages(prev=>[...(data.messages||[]),...prev]);}
//       setHasMore(data.hasMore);setPage(p);
//     }catch(e){console.error(e);}
//     setLoading(false);
//   },[group]);// eslint-disable-line

//   useEffect(()=>{
//     if(!group)return;
//     setMessages([]);setPage(1);load(1);joinGroup(group.id);
//   },[group?.id]);// eslint-disable-line

//   const handleDeleteMessage=useCallback((messageId)=>{
//     setMessages(prev=>prev.filter(msg=>msg.id!==messageId));
//   },[]);

//   const handleNewMsg=useCallback((msg)=>{
//     if(Number(msg.group_id)!==groupIdRef.current)return;
    
//     // Check if this is the current user's own message
//     const isOwnMessage = msg.sender_id === user?.id;
    
//     // For own messages, don't add them (they come from API response)
//     if (isOwnMessage) {
//       return; // Don't add own messages from socket - they come from API response
//     }
    
//     // Handle real-time message deletion
//     if (msg.message_type === 'message_deleted' || (msg.message_id && msg.group_id && msg.deleted_by)) {
//       // Remove the deleted message from the current state
//       setMessages(prev => prev.filter(m => m.id !== msg.message_id));
//       return; // Don't show deleted messages
//     }
    
//     // Handle messages marked as deleted in database
//     if (msg.is_deleted) {
//       return; // Don't show deleted messages
//     }
    
//     // For other users' messages, add them normally
//     setMessages(prev => {
//       if (prev.some(m => m.id === msg.id)) {
//         return prev; // Prevent duplicates even from others
//       }
//       return [...prev, msg];
//     });
    
//     msRef.current?.(msg.id,msg.group_id);
//     setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),60);
//   },[user?.id]);

//   const handleReactionUpdate=useCallback((data)=>{
//     if(Number(data.group_id)!==groupIdRef.current)return;
//     setMessages(prev=>prev.map(msg=>msg.id===data.message_id?{...msg,reactions:data.reactions}:msg));
//   },[]);

//   const handleTyping=useCallback((data)=>{
//     if(Number(data.group_id)!==groupIdRef.current)return;
//     setTypingUsers(data.users||[]);
//     if(typingTmr.current)clearTimeout(typingTmr.current);
//     typingTmr.current=setTimeout(()=>setTypingUsers([]),3000);
//   },[]);

//   const handleDeletedMessage=useCallback((data)=>{
//     if(Number(data.group_id)!==groupIdRef.current)return;
//     // Remove the deleted message from the current state
//     setMessages(prev => prev.filter(m => m.id !== data.message_id));
//   },[]);

//   useEffect(()=>{
//     const unsubNewMsg=on('new_message',handleNewMsg);
//     const unsubReaction=on('reaction_update',handleReactionUpdate);
//     const unsubTyping=on('typing',handleTyping);
//     const unsubDeleted=on('message_deleted',handleDeletedMessage);
//     return()=>{unsubNewMsg();unsubReaction();unsubTyping();unsubDeleted();};
//   },[on,handleNewMsg,handleReactionUpdate,handleTyping,handleDeletedMessage]);

//   const typingTmr=useRef(null);

//   const grouped=messages.reduce((acc,msg,i)=>{
//     const prev=messages[i-1];
//     acc.push({...msg,showDate:!prev||!isSameDay(new Date(prev.sent_at),new Date(msg.sent_at)),showAvatar:!prev||prev.sender_id!==msg.sender_id||!isSameDay(new Date(prev?.sent_at),new Date(msg.sent_at))});
//     return acc;
//   },[]);

//   if(!group)return(<div className="empty-state" style={{flex:1}}><div className="empty-state-icon">💬</div><p>Select a group</p></div>);

//   return(
//     <>
//       <div className="messages-area">
//         {hasMore&&<div style={{textAlign:'center',paddingBottom:12}}><button className="btn btn-secondary btn-sm" onClick={()=>load(page+1)}>Load older</button></div>}
//         {loading?(
//           <div className="empty-state"><p>Loading…</p></div>
//         ):messages.length===0?(
//           <div className="empty-state"><div className="empty-state-icon">🚀</div><p>Start the conversation!</p></div>
//         ):grouped.map(msg=>(
//           <React.Fragment key={msg.id}>
//             {msg.showDate&&<div className="date-divider">{fd(msg.sent_at)}</div>}
//             <div onDoubleClick={()=>setReplyTo(msg)}>
//               <Bubble msg={msg} isOwn={msg.sender_id===user?.id} showAvatar={msg.showAvatar} onTaskClick={onTaskClick} group={group} onDeleteMessage={handleDeleteMessage}/>
//             </div>
//           </React.Fragment>
//         ))}
//         {typingUsers.length>0&&(
//           <div className="message-row" style={{gap:10,paddingTop:4}}>
//             <div style={{width:32}}/>
//             <div><div className="message-sender">{typingUsers.map(u=>u.name).join(', ')}</div>
//               <div className="typing-indicator"><div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/></div>
//             </div>
//           </div>
//         )}
//         <div ref={bottomRef}/>
//       </div>

//       {/* ── Message Sender with Recipient Selection ── */}
//       <div className="input-area" style={{position:'relative'}}>
        
//         {/* Task popup sits directly above the input bar, chat messages remain visible */}
//         {showTaskPopup && (
//           <TaskQuickPopup
//             group={group}
//             onClose={() => setShowTaskPopup(false)}
//           />
//         )}

//         {/* 🆕 Message Sender with Recipient Selection */}
//         <MessageSender
//           groupId={group?.id}
//           onMessageSent={(newMessage) => {
//             // Add message to local state from API response
//             setMessages(prev => [...prev, newMessage]);
//             setReplyTo(null);
//             bottomRef.current?.scrollIntoView({behavior:'smooth'});
//           }}
//           currentUser={user}
//           replyTo={replyTo}
//           onReplyCancel={() => setReplyTo(null)}
//         />
//       </div>
//     </>
//   );
// }

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { messagesAPI, authAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';
import ForwardModal from './ForwardModal';
import TaskQuickPopup from '../Tasks/TaskQuickPopup';
import MessageSender from './MessageSender';
import './ChatMessages.css';

/* ── helpers ───────────────────────────────────────────────── */
const COLORS=['#4f7dff','#a855f7','#22c55e','#f59e0b','#ef4444','#06b6d4'];
function ac(n=''){let h=0;for(const c of n)h=c.charCodeAt(0)+((h<<5)-h);return COLORS[Math.abs(h)%COLORS.length];}
function ini(n=''){return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}
function fd(d){const dt=new Date(d);if(isToday(dt))return'Today';if(isYesterday(dt))return'Yesterday';return format(dt,'MMMM d, yyyy');}
function ft(d){return format(new Date(d),'HH:mm');}
function fs(b){if(!b)return'';if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(1)+' MB';}
function fi(m){if(!m)return'📄';if(m.startsWith('image/'))return'🖼️';if(m.startsWith('audio/'))return'🎵';if(m.includes('pdf'))return'📕';if(m.includes('sheet')||m.includes('excel')||m.includes('csv'))return'📊';if(m.includes('word'))return'📝';if(m.includes('zip'))return'🗜️';return'📎';}

function parseMsgContent(content) {
  if (!content) return { prefix: null, text: content };
  const match = content.match(/^(📤[^:]+):\s*([\s\S]*)$/);
  if (!match) return { prefix: null, text: content };
  return { prefix: match[1].trim(), text: match[2] };
}

/* ── localStorage "last seen" tracker ───────────────────────── */
// Stores the sent_at timestamp of the newest message the user has loaded
// per group. On next open, any message newer than this (by others) is unread.
const LAST_SEEN_KEY='chat_last_seen';
function getLastSeen(groupId){try{return JSON.parse(localStorage.getItem(LAST_SEEN_KEY)||'{}')[groupId]||null;}catch{return null;}}
function saveLastSeen(groupId,ts){try{const d=JSON.parse(localStorage.getItem(LAST_SEEN_KEY)||'{}');d[String(groupId)]=ts;localStorage.setItem(LAST_SEEN_KEY,JSON.stringify(d));}catch{}}

/* ── Task pill ─────────────────────────────────────────────── */
const TM={initial_setup:{i:'🚀',c:'#a855f7'},share_link:{i:'🔗',c:'#4f7dff'},pause_pid:{i:'⏸️',c:'#f59e0b'},raise_request:{i:'📋',c:'#22c55e'},optimise:{i:'⚡',c:'#06b6d4'}};
function TaskPill({taskRef,onTaskClick}){
  if(!taskRef)return null;
  const m=TM[taskRef.task_type]||TM.share_link;
  return(
    <span onClick={()=>onTaskClick?.(taskRef.task_id,taskRef.task_type)}
      style={{display:'inline-flex',alignItems:'center',gap:5,background:`${m.c}18`,border:`1px solid ${m.c}40`,
        borderRadius:20,padding:'2px 10px',cursor:'pointer',fontSize:11,color:m.c,fontWeight:600,
        marginTop:4,userSelect:'none',transition:'background .15s'}}
      onMouseEnter={e=>e.currentTarget.style.background=`${m.c}30`}
      onMouseLeave={e=>e.currentTarget.style.background=`${m.c}18`}>
      {m.i} {taskRef.task_title} <span style={{fontSize:9,opacity:.6}}>→ open</span>
    </span>
  );
}

/* ── Single bubble ─────────────────────────────────────────── */
function Bubble({msg,isOwn,showAvatar,onTaskClick,group,onDeleteMessage,searchQuery,onReplyClick,onImageClick}){
  const {user} = useAuth();
  const [showOptions, setShowOptions] = useState(false);
  const [localReactions, setLocalReactions] = useState(msg.reactions || []);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [onDeleteMessageState, setOnDeleteMessageState] = useState(null);
  const messageRef = useRef(null);
  
  // Sync local reactions with message reactions when they change
  useEffect(() => {
    setLocalReactions(msg.reactions || []);
  }, [msg.reactions]);
  
  const handleCopy = () => {
    const textToCopy = parseMsgContent(msg.content).text;
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.success('Message copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy message');
    });
  };

  const handleDelete = async () => {
    try {
      await messagesAPI.deleteMessage(group.id, msg.id);
      if (onDeleteMessageState) {
        onDeleteMessageState(msg.id);
      }
      toast.success('Message deleted');
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const handleReaction = async (emoji) => {
    try {
      const existingReaction = localReactions.find(r => r.user_id === user?.id && r.emoji === emoji);
      
      if (existingReaction) {
        await messagesAPI.removeReaction(group.id, msg.id, emoji);
        setLocalReactions(prev => prev.filter(r => !(r.user_id === user?.id && r.emoji === emoji)));
      } else {
        await messagesAPI.addReaction(group.id, msg.id, emoji);
        setLocalReactions(prev => [...prev.filter(r => !(r.user_id === user?.id)), { user_id: user?.id, emoji }]);
      }
    } catch (error) {
      toast.error('Failed to add reaction');
    }
  };

  const fileUrl = msg.file_url ? (msg.file_url.startsWith('http') ? msg.file_url : `${process.env.REACT_APP_API_URL}${msg.file_url}`) : null;

  return(
    <div className={`message-row ${isOwn?'own':''}`}>
      {!isOwn&&(
        <div className="sender-avatar">
          <div className="avatar-circle" style={{background: ac(msg.sender_name)}}>
            {ini(msg.sender_name)}
          </div>
        </div>
      )}
      
      <div className="message-wrapper">
        {showAvatar&&!isOwn&&(
          <div className="message-header">
            <span className="sender-name">{msg.sender_name}</span>
            <span className="sender-role">{msg.sender_role}</span>
          </div>
        )}
        
        {msg.reply_content&&(
          <div
            className="reply-bubble"
            style={{cursor:'pointer'}}
            onClick={()=>onReplyClick&&msg.reply_to_id&&onReplyClick(msg.reply_to_id)}
          >
            <div className="reply-content">
              <span className="reply-label">Replying to {msg.reply_sender_name}</span>
              <span className="reply-text">{msg.reply_content}</span>
            </div>
          </div>
        )}
        
        {/* <div className="message-content">
          {msg.content}
          <div className="message-time">
            {format(new Date(msg.sent_at), 'HH:mm')}
          </div>
        </div> */}

        {/* Image */}
        {/* {msg.message_type === 'image' && fileUrl && (
          <div className="media-content">
            <img
              src={fileUrl}
              alt="Shared image"
              loading="lazy"
              onClick={(e) => {
                e.stopPropagation();
                window.open(fileUrl, '_blank');
              }}
            />
          </div>
        )} */}

        {/* Audio */}
        {msg.message_type === 'audio' && fileUrl && (
          <div className="media-content">
            <audio controls>
              <source src={fileUrl} type={msg.mime_type || 'audio/mpeg'} />
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
        {/* </div> */}
        <div 
          ref={messageRef}
          className={`message-bubble ${isOwn ? 'own' : 'received'} ${msg.message_type}`}
          onMouseEnter={() => setShowEmojiPicker(true)}
          onMouseLeave={() => setShowEmojiPicker(false)}
        >

  {/* Image */}
  {msg.message_type === 'image' && fileUrl && !msg.is_deleted && (
    <div className="media-content">
      <img
        src={fileUrl}
        alt="Shared image"
        loading="lazy"
        style={{cursor:'zoom-in'}}
        onClick={(e) => {
          e.stopPropagation();
          const storedFilename = (msg.file_url || '').split('/').pop();
          const nameParam = encodeURIComponent(msg.file_name || storedFilename);
          const downloadUrl = `${process.env.REACT_APP_API_URL}/api/download/${encodeURIComponent(storedFilename)}?name=${nameParam}`;
          onImageClick?.({ url: fileUrl, name: msg.file_name || storedFilename, downloadUrl });
        }}
      />
    </div>
  )}

  {/* Audio */}
  {msg.message_type === 'audio' && fileUrl && !msg.is_deleted && (
    <div className="media-content">
      <audio controls>
        <source src={fileUrl} type={msg.mime_type || 'audio/mpeg'} />
        Your browser does not support the audio element.
      </audio>
    </div>
  )}

  {/* Video */}
  {msg.message_type === 'video' && fileUrl && !msg.is_deleted && (
    <div className="media-content">
      <video controls width="300" height="200">
        <source src={fileUrl} type={msg.mime_type || 'video/mp4'} />
        Your browser does not support the video element.
      </video>
    </div>
  )}

  {/* File */}
  {msg.message_type === 'file' && fileUrl && !msg.is_deleted && (
    <div className="file-content" onClick={() => {
      const storedFilename = (msg.file_url || '').split('/').pop();
      const nameParam = encodeURIComponent(msg.file_name || storedFilename);
      const downloadUrl = `${process.env.REACT_APP_API_URL}/api/download/${encodeURIComponent(storedFilename)}?name=${nameParam}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = msg.file_name || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }}>
      <div className="file-icon">{msg.file_icon || '📄'}</div>
      <div className="file-info">
        <div className="file-name">{msg.file_name}</div>
        <div className="file-size">{fs(msg.file_size)}</div>
      </div>
    </div>
  )}

  {/* Text Content */}
  <div className="text-content">
    {(() => {
      const { prefix, text } = parseMsgContent(msg.content);
      return (
        <>
          {prefix && (
            <div style={{fontSize:11,fontWeight:600,opacity:0.6,marginBottom:3,letterSpacing:'0.02em'}}>
              {prefix}
            </div>
          )}
          <div className="message-text">{renderContent(text, searchQuery)}</div>
        </>
      );
    })()}
      <div className="message-time">
            {format(new Date(msg.sent_at), 'HH:mm')}
          </div>
    {msg.task_ref && (
      <TaskPill taskRef={msg.task_ref} onTaskClick={onTaskClick} />
    )}
  </div>

</div>
        {/* Reactions */}
        {!msg.is_deleted && localReactions.length > 0 && (
          <div className="reactions-bar">
            {localReactions.map((reaction, index) => (
              <div
                key={index}
                className={`reaction-item ${reaction.user_id === user?.id ? 'own-reaction' : ''}`}
                onClick={() => handleReaction(reaction.emoji)}
              >
                <span className="reaction-emoji">{reaction.emoji}</span>
                <span className="reaction-count">{reaction.count || 1}</span>
              </div>
            ))}
          </div>
        )}

        {/* Emoji Picker on Hover - Larger trigger area */}
        {!msg.is_deleted && <div
          className="emoji-picker-trigger"
          onMouseEnter={() => setShowEmojiPicker(true)}
          onMouseLeave={() => setShowEmojiPicker(false)}
        >
          {/* <div className="emoji-picker-hint">
            h
          </div> */}
          {showEmojiPicker && (
            <div className="emoji-picker">
              {['❤️', '👍', '😊', '😂', '🎉', '🔥', '💯', '😢', '😡', '👎'].map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-btn"
                  onClick={() => handleReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
            
          )}
          <div 
  className="message-actions"
  onClick={(e) => {
    e.stopPropagation();
    setShowOptions(!showOptions);
  }}
>
  ⋮
</div>
        </div>}

        {/* Message Options */}
        {!msg.is_deleted && showOptions && (
          <div className=""
              onClick={(e) => e.stopPropagation()} // prevent closing
>
            <button className="option-btn" onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
              <span className="option-icon">📋</span>
              <span className="option-text">Copy</span>
            </button>
            {/* <button className="option-btn" onClick={(e) => { e.stopPropagation(); setShowForwardModal(true); }}>
              <span className="option-icon">↗️</span>
              <span className="option-text">Forward</span>
            </button> */}
            {isOwn && (
              <button className="option-btn delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(); }}>
                <span className="option-icon">🗑️</span>
                <span className="option-text">Delete</span>
              </button>
            )}
          </div>
        )}
      </div>
      {showForwardModal && (
        <ForwardModal
          message={msg}
          onClose={() => setShowForwardModal(false)}
          onForward={(targetGroupId) => {
            messagesAPI.forwardMessage(targetGroupId, {
              content: msg.content,
              message_type: msg.message_type,
              file_url: msg.file_url,
              file_name: msg.file_name,
              file_size: msg.file_size,
              mime_type: msg.mime_type
            }).then(() => {
              toast.success('Message forwarded successfully!');
              setShowForwardModal(false);
            }).catch((error) => {
              toast.error('Failed to forward message');
            });
          }}
        />
      )}
    </div>
  );
}

/* ── Highlight helper ──────────────────────────────────────── */
function highlightText(text,query){
  if(!query||!text)return text;
  const escaped=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const parts=text.split(new RegExp(`(${escaped})`,'gi'));
  return parts.map((part,i)=>
    part.toLowerCase()===query.toLowerCase()
      ?<mark key={i} style={{background:'#ffd700',color:'#000',borderRadius:2,padding:'0 1px'}}>{part}</mark>
      :part
  );
}

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

function renderContent(text, searchQuery) {
  if (!text) return text;
  const segments = [];
  let last = 0, match;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > last) segments.push({ type: 'text', value: text.slice(last, match.index) });
    segments.push({ type: 'url', value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });

  return segments.map((seg, i) => {
    if (seg.type === 'url') {
      const href = seg.value.startsWith('www.') ? `https://${seg.value}` : seg.value;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer"
          style={{color:'#60a5fa',wordBreak:'break-all',textDecoration:'underline'}}>
          {seg.value}
        </a>
      );
    }
    return searchQuery ? highlightText(seg.value, searchQuery) : seg.value;
  });
}

/* ── Main ──────────────────────────────────────────────────── */
export default function ChatMessages({group,onTaskClick,searchQuery=''}){
  const {user}=useAuth();
  const {on,joinGroup,markSeen,sendTyping}=useSocket();
  const [messages,setMessages]=useState([]);
  const [loading,setLoading]=useState(true);
  const [page,setPage]=useState(1);
  const [hasMore,setHasMore]=useState(false);
  const [replyTo,setReplyTo]=useState(null);
  const [typingUsers,setTypingUsers]=useState([]);
  const [showTaskPopup,setShowTaskPopup]=useState(false);
  const [currentMatchIdx,setCurrentMatchIdx]=useState(0);
  const matchRefs=useRef({});
  const [firstUnreadId,setFirstUnreadId]=useState(null);
  const [accessRevoked,setAccessRevoked]=useState(false);
  const [isDragging,setIsDragging]=useState(false);
  const [dropBatch,setDropBatch]=useState(null);
  const [previewImage,setPreviewImage]=useState(null); // {url, name, downloadUrl}
  useEffect(()=>{
    if(!previewImage)return;
    const onKey=(e)=>{if(e.key==='Escape')setPreviewImage(null);};
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[previewImage]);
  const dragCounterRef=useRef(0);

  const bottomRef=useRef(null);
  const messagesAreaRef=useRef(null);
  const groupIdRef=useRef(null);
  const msRef=useRef(markSeen);

  const isNearBottom=useCallback(()=>{
    const el=messagesAreaRef.current;
    if(!el)return true;
    return el.scrollHeight-el.scrollTop-el.clientHeight<120;
  },[]);
  useEffect(()=>{groupIdRef.current=group?.id?Number(group.id):null;},[group?.id]);
  useEffect(()=>{msRef.current=markSeen;},[markSeen]);

  // Reset match index when searchQuery changes (controlled from parent)
  useEffect(()=>{setCurrentMatchIdx(0);},[searchQuery]);

  const load=useCallback(async(p=1)=>{
    if(!group)return;
    if(p===1)setLoading(true);
    try{
      const data=await messagesAPI.getMessages(group.id,p);
      if(p===1){
        const msgs=data.messages||[];
        setMessages(msgs);
        // Find the first message newer than the last one the user saw,
        // sent by someone else. Works across any group switch.
        const lastSeen=getLastSeen(group.id);
        let firstUnread=null;
        if(lastSeen){
          const threshold=new Date(lastSeen).getTime();
          const firstUnreadMsg=msgs.find(msg=>
            msg.sender_id!==user?.id &&
            new Date(msg.sent_at).getTime()>threshold
          );
          firstUnread=firstUnreadMsg?.id||null;
        }
        setFirstUnreadId(firstUnread);
        // Advance the "seen up to" marker to the newest message in this load.
        if(msgs.length>0) saveLastSeen(group.id, msgs[msgs.length-1].sent_at);
        if(firstUnread){
          setTimeout(()=>{
            const el=document.getElementById(`msg-${firstUnread}`);
            el?.scrollIntoView({behavior:'instant',block:'center'});
          },120);
        } else {
          setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'instant'}),80);
        }
      } else {
        setMessages(prev=>[...(data.messages||[]),...prev]);
      }
      setHasMore(data.hasMore);setPage(p);
    }catch(e){console.error(e);}
    setLoading(false);
  },[group]);// eslint-disable-line

  useEffect(()=>{
    if(!group)return;
    setMessages([]);setPage(1);setFirstUnreadId(null);setAccessRevoked(false);
    load(1);joinGroup(group.id);
  },[group?.id]);// eslint-disable-line

  const handleDeleteMessage=useCallback((messageId)=>{
    setMessages(prev=>prev.filter(msg=>msg.id!==messageId));
  },[]);

  const handleNewMsg=useCallback((msg)=>{
    if(Number(msg.group_id)!==groupIdRef.current)return;
    
    // Check if this is the current user's own message
    const isOwnMessage = msg.sender_id === user?.id;
    
    // For own messages, don't add them (they come from API response)
    if (isOwnMessage) {
      return; // Don't add own messages from socket - they come from API response
    }
    
    // Handle real-time message deletion
    if (msg.message_type === 'message_deleted' || (msg.message_id && msg.group_id && msg.deleted_by)) {
      // Remove the deleted message from the current state
      setMessages(prev => prev.filter(m => m.id !== msg.message_id));
      return; // Don't show deleted messages
    }
    
    // Handle messages marked as deleted in database
    if (msg.is_deleted) {
      return; // Don't show deleted messages
    }
    
    // For other users' messages, add them normally
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) {
        return prev; // Prevent duplicates even from others
      }
      return [...prev, msg];
    });
    // Keep "last seen" marker current so switching away + back doesn't
    // re-show the divider for messages already visible in this session.
    if(msg.sent_at) saveLastSeen(groupIdRef.current, msg.sent_at);
    msRef.current?.(msg.id,msg.group_id);
    if(isNearBottom()){
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),60);
    }
  },[user?.id,isNearBottom]);

  const handleReactionUpdate=useCallback((data)=>{
    if(Number(data.group_id)!==groupIdRef.current)return;
    setMessages(prev=>prev.map(msg=>msg.id===data.message_id?{...msg,reactions:data.reactions}:msg));
  },[]);

  const handleTyping=useCallback((data)=>{
    if(Number(data.group_id)!==groupIdRef.current)return;
    setTypingUsers(data.users||[]);
    if(typingTmr.current)clearTimeout(typingTmr.current);
    typingTmr.current=setTimeout(()=>setTypingUsers([]),3000);
  },[]);

  const handleDeletedMessage=useCallback((data)=>{
    if(Number(data.group_id)!==groupIdRef.current)return;
    // Remove the deleted message from the current state
    setMessages(prev => prev.filter(m => m.id !== data.message_id));
  },[]);

  useEffect(()=>{
    const unsubNewMsg=on('new_message',handleNewMsg);
    const unsubReaction=on('reaction_update',handleReactionUpdate);
    const unsubTyping=on('typing',handleTyping);
    const unsubDeleted=on('message_deleted',handleDeletedMessage);

    // FIX: listen for self-removal while this chat panel is open.
    // When received, set accessRevoked=true which renders a "you were removed"
    // message and stops any further load() / markSeen() calls that would 403.
    // App.jsx also calls setSelectedGroup(null) which unmounts this component,
    // but the race window between the socket event and React re-render means
    // this component can still fire an API call — this guard closes that gap.
    const unsubRemoved=on('member_removed',(data)=>{
      if(group && Number(data.group_id)===Number(group.id)){
        setAccessRevoked(true);
        setMessages([]);
        setLoading(false);
      }
    });

    return()=>{unsubNewMsg();unsubReaction();unsubTyping();unsubDeleted();unsubRemoved();};
  },[on,handleNewMsg,handleReactionUpdate,handleTyping,handleDeletedMessage,group?.id]);

  const typingTmr=useRef(null);

  const grouped=messages.reduce((acc,msg,i)=>{
    const prev=messages[i-1];
    acc.push({...msg,showDate:!prev||!isSameDay(new Date(prev.sent_at),new Date(msg.sent_at)),showAvatar:!prev||prev.sender_id!==msg.sender_id||!isSameDay(new Date(prev?.sent_at),new Date(msg.sent_at))});
    return acc;
  },[]);

  // Compute search matches across loaded messages
  const searchMatches=useMemo(()=>{
    if(!searchQuery.trim())return[];
    const q=searchQuery.toLowerCase();
    return grouped
      .map((msg,i)=>({msg,i}))
      .filter(({msg})=>msg.content&&msg.content.toLowerCase().includes(q));
  },[grouped,searchQuery]);

  // Reset match index when query changes (handled by parent-controlled searchQuery)
  // useEffect already set above

  // Scroll to current match
  useEffect(()=>{
    if(!searchMatches.length)return;
    const target=searchMatches[currentMatchIdx];
    if(target&&matchRefs.current[target.msg.id]){
      matchRefs.current[target.msg.id].scrollIntoView({behavior:'smooth',block:'center'});
    }
  },[currentMatchIdx,searchMatches]);

  const scrollToMessage = useCallback((messageId) => {
    const el = matchRefs.current[messageId];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'outline 0.2s';
    el.style.outline = '2px solid var(--accent)';
    el.style.borderRadius = '8px';
    setTimeout(() => { el.style.outline = ''; }, 1500);
  }, []);

  if(!group)return(<div className="empty-state" style={{flex:1}}><div className="empty-state-icon">💬</div><p>Select a group</p></div>);

  // FIX: render a clear UI instead of firing repeated 403 API calls when the
  // user has been removed from this group mid-session.
  if(accessRevoked)return(
    <div className="empty-state" style={{flex:1}}>
      <div className="empty-state-icon">🚫</div>
      <p style={{color:'var(--text-muted)',fontSize:13,textAlign:'center'}}>
        You have been removed from this group.<br/>
        <span style={{fontSize:11,opacity:0.7}}>Select another group to continue.</span>
      </p>
    </div>
  );

  const activeMatchId=searchMatches[currentMatchIdx]?.msg?.id;

  const handleDragEnter=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current+=1;
    if(e.dataTransfer.items&&e.dataTransfer.items.length>0) setIsDragging(true);
  };
  const handleDragLeave=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current-=1;
    if(dragCounterRef.current===0) setIsDragging(false);
  };
  const handleDragOver=(e)=>{e.preventDefault();e.stopPropagation();};
  const handleDrop=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current=0;
    const files=Array.from(e.dataTransfer.files).filter(f=>f.size>0);
    if(files.length>0) setDropBatch({files,id:Date.now()});
  };

  return(
    <div
      style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── Image preview lightbox ── */}
      {previewImage && (
        <div
          onClick={()=>setPreviewImage(null)}
          className="image-preview-overlay"
        >
          <img
            src={previewImage.url}
            alt={previewImage.name}
            onClick={e=>e.stopPropagation()}
            style={{
              maxWidth:'90vw',maxHeight:'80vh',
              borderRadius:8,objectFit:'contain',
              boxShadow:'0 8px 40px rgba(0,0,0,0.7)',
            }}
          />
          <div style={{display:'flex',gap:12}} onClick={e=>e.stopPropagation()}>
            <a
              href={previewImage.downloadUrl}
              download={previewImage.name}
              style={{
                padding:'8px 20px',borderRadius:8,
                background:'#4f7dff',color:'#fff',
                fontWeight:600,fontSize:13,textDecoration:'none',
                display:'flex',alignItems:'center',gap:6,
              }}
            >
              ⬇ Download
            </a>
            <button
              onClick={()=>setPreviewImage(null)}
              style={{
                padding:'8px 20px',borderRadius:8,
                background:'var(--bg-secondary)',color:'var(--text-primary)',
                fontWeight:600,fontSize:13,border:'1px solid var(--border)',
                cursor:'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {isDragging&&(
        <div className="drop-overlay">
          <div className="drop-overlay-content">
            <span className="drop-icon">📎</span>
            <span className="drop-label">Drop files to attach</span>
          </div>
        </div>
      )}
      {/* ── Match navigation strip (shown when searching messages) ── */}
      {searchQuery.trim()&&(
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 12px',borderBottom:'1px solid var(--border-color)',background:'var(--bg-secondary)',flexShrink:0,fontSize:11}}>
          <span style={{color:'var(--text-muted)'}}>
            {searchMatches.length===0?`No results for "${searchQuery}"`:`${currentMatchIdx+1} / ${searchMatches.length} matches`}
          </span>
          <button disabled={!searchMatches.length} onClick={()=>setCurrentMatchIdx(i=>(i-1+searchMatches.length)%searchMatches.length)}
            style={{background:'none',border:'1px solid var(--border-color)',borderRadius:5,padding:'2px 7px',cursor:'pointer',color:'var(--text-muted)',opacity:searchMatches.length?1:0.4}}>▲</button>
          <button disabled={!searchMatches.length} onClick={()=>setCurrentMatchIdx(i=>(i+1)%searchMatches.length)}
            style={{background:'none',border:'1px solid var(--border-color)',borderRadius:5,padding:'2px 7px',cursor:'pointer',color:'var(--text-muted)',opacity:searchMatches.length?1:0.4}}>▼</button>
        </div>
      )}

      <div className="messages-area" ref={messagesAreaRef}>
        {hasMore&&<div style={{textAlign:'center',paddingBottom:12}}><button className="btn btn-secondary btn-sm" onClick={()=>load(page+1)}>Load older</button></div>}
        {loading?(
          <div className="empty-state"><p>Loading…</p></div>
        ):messages.length===0?(
          <div className="empty-state"><div className="empty-state-icon">🚀</div><p>Start the conversation!</p></div>
        ):grouped.map(msg=>{
          const isMatch=searchQuery.trim()&&msg.content&&msg.content.toLowerCase().includes(searchQuery.toLowerCase());
          const isCurrent=msg.id===activeMatchId;
          const isFirstUnread=firstUnreadId&&msg.id===firstUnreadId;
          return(
          <React.Fragment key={msg.id}>
            {msg.showDate&&<div className="date-divider">{fd(msg.sent_at)}</div>}
            {isFirstUnread&&(
              <div className="date-divider unread-divider">New Messages</div>
            )}
            <div
              id={`msg-${msg.id}`}
              ref={el=>{if(el)matchRefs.current[msg.id]=el;}}
              onDoubleClick={()=>setReplyTo(msg)}
              style={isCurrent?{outline:'2px solid var(--accent)',borderRadius:8,transition:'outline 0.2s'}:isMatch?{outline:'1px solid #ffd70066',borderRadius:8}:{}}
            >
              <Bubble
                msg={msg}
                isOwn={msg.sender_id===user?.id}
                showAvatar={msg.showAvatar}
                onTaskClick={onTaskClick}
                group={group}
                onDeleteMessage={handleDeleteMessage}
                searchQuery={searchQuery}
                onReplyClick={scrollToMessage}
                onImageClick={setPreviewImage}
              />
            </div>
          </React.Fragment>
        );})}

        {typingUsers.length>0&&(
          <div className="message-row" style={{gap:10,paddingTop:4}}>
            <div style={{width:32}}/>
            <div><div className="message-sender">{typingUsers.map(u=>u.name).join(', ')}</div>
              <div className="typing-indicator"><div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/></div>
            </div>
          </div>
        )}
         <div ref={bottomRef}/> 
      </div>

      {/* ── Message Sender with Recipient Selection ── */}
      <div className="input-area" style={{position:'relative'}}>
        
        {/* Task popup sits directly above the input bar, chat messages remain visible */}
        {showTaskPopup && (
          <TaskQuickPopup
            group={group}
            onClose={() => setShowTaskPopup(false)}
          />
        )}

        {/* 🆕 Message Sender with Recipient Selection */}
        <MessageSender
          groupId={group?.id}
          onMessageSent={(newMessage) => {
            setMessages(prev => [...prev, newMessage]);
            setReplyTo(null);
            if(newMessage?.sent_at) saveLastSeen(group?.id, newMessage.sent_at);
            bottomRef.current?.scrollIntoView({behavior:'smooth'});
          }}
          currentUser={user}
          replyTo={replyTo}
          onReplyCancel={() => setReplyTo(null)}
          dropBatch={dropBatch}
        />
      </div>
    </div>
  );
}
