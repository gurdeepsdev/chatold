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

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
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

// Pulls the {name, uid} pairs out of "@[Name](uid:123)" tokens and returns the
// display-safe text (id stripped) alongside them, so the edit box never shows a uid.
function extractMentions(text) {
  const mentions = [];
  const stripped = text.replace(/@\[([^\]]+)\]\(uid:(\d+)\)/g, (_, name, uid) => {
    mentions.push({ name, uid });
    return `@${name}`;
  });
  return { stripped, mentions };
}

// Reverses extractMentions: puts the uid tokens back for any mention names still
// present (in order) in the edited text, so tags survive an edit that didn't touch them.
function rehydrateMentions(text, mentions) {
  let result = text;
  let searchFrom = 0;
  for (const { name, uid } of mentions) {
    const plain = `@${name}`;
    const idx = result.indexOf(plain, searchFrom);
    if (idx === -1) continue; // user removed this mention while editing
    const token = `@[${name}](uid:${uid})`;
    result = result.slice(0, idx) + token + result.slice(idx + plain.length);
    searchFrom = idx + token.length;
  }
  return result;
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
function Bubble({msg,isOwn,showAvatar,onTaskClick,group,onDeleteMessage,onEditMessage,searchQuery,onReplyClick,onImageClick,isPinned,pinnedByName,onPin,onUnpin}){
  const {user} = useAuth();
  const [showOptions, setShowOptions] = useState(false);
  const [localReactions, setLocalReactions] = useState(msg.reactions || []);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showExtendedPicker, setShowExtendedPicker] = useState(false);
  const [extendedPickerPos, setExtendedPickerPos] = useState(null);
  const [onDeleteMessageState, setOnDeleteMessageState] = useState(null);
  const [reactionPopup, setReactionPopup] = useState(null);
  const [localReadBy, setLocalReadBy] = useState(msg.read_by || []);
  const [seenPopup, setSeenPopup] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const editInputRef = useRef(null);
  const editMentionsRef = useRef([]); // {name, uid} pairs stripped out of msg.content when edit mode opened
  const messageRef = useRef(null);
  const plusBtnRef = useRef(null);
  
  // Sync local reactions with message reactions when they change
  useEffect(() => {
    setLocalReactions(msg.reactions || []);
  }, [msg.reactions]);

  // Sync local read-by list with message read_by when it changes
  useEffect(() => {
    setLocalReadBy(msg.read_by || []);
  }, [msg.read_by]);

  // Close the seen-by popup on any click outside it (it's click-toggled, not hover)
  useEffect(() => {
    if (!seenPopup) return;
    const closeIt = () => setSeenPopup(null);
    document.addEventListener('click', closeIt);
    return () => document.removeEventListener('click', closeIt);
  }, [seenPopup]);

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (msg.message_type === 'image' && fileUrl) {
      fetch(fileUrl)
        .then(res => res.blob())
        .then(blob => {
          if (blob.type === 'image/png') return blob;
          // Convert non-PNG formats to PNG via canvas (Clipboard API only supports image/png reliably)
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              URL.revokeObjectURL(img.src);
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              canvas.getContext('2d').drawImage(img, 0, 0);
              canvas.toBlob(png => png ? resolve(png) : reject(new Error('canvas failed')), 'image/png');
            };
            img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('load failed')); };
            img.src = URL.createObjectURL(blob);
          });
        })
        .then(pngBlob => navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]))
        .then(() => {
          if (msg.file_name) sessionStorage.setItem('clipboard_image_name', msg.file_name);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => toast.error('Failed to copy image'));
      return;
    }
    const plain = parseMsgContent(msg.content).text;
    const html  = contentToHtml(plain);
    navigator.clipboard.write([
      new ClipboardItem({
        'text/html':  new Blob([html],  { type: 'text/html'  }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })
    ]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback: plain text only (older browsers)
      navigator.clipboard.writeText(plain)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
        .catch(() => toast.error('Failed to copy message'));
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

  const handleEditStart = () => {
    const { text } = parseMsgContent(msg.content);
    const { stripped, mentions } = extractMentions(text);
    editMentionsRef.current = mentions;
    setEditContent(stripped);
    setIsEditing(true);
    setShowOptions(false);
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.style.height = 'auto';
        editInputRef.current.style.height = editInputRef.current.scrollHeight + 'px';
        editInputRef.current.focus();
        editInputRef.current.setSelectionRange(editInputRef.current.value.length, editInputRef.current.value.length);
      }
    }, 0);
  };

  const handleEditSave = async () => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    const { text: original } = parseMsgContent(msg.content);
    const rehydrated = rehydrateMentions(trimmed, editMentionsRef.current);
    if (rehydrated === original) { setIsEditing(false); return; }
    setEditSaving(true);
    try {
      await messagesAPI.editMessage(group.id, msg.id, rehydrated);
      if (onEditMessage) onEditMessage(msg.id, rehydrated);
      setIsEditing(false);
    } catch {
      toast.error('Failed to edit message');
    }
    setEditSaving(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleReaction = async (emoji) => {
    try {
      const existingReaction = localReactions.find(r => r.user_id === user?.id && r.emoji === emoji);
      
      if (existingReaction) {
        await messagesAPI.removeReaction(group.id, msg.id, emoji);
        setLocalReactions(prev => prev.filter(r => !(r.user_id === user?.id && r.emoji === emoji)));
      } else {
        await messagesAPI.addReaction(group.id, msg.id, emoji);
        setLocalReactions(prev => [...prev.filter(r => !(r.user_id === user?.id && r.emoji === emoji)), { user_id: user?.id, emoji, user_name: user?.full_name || 'You' }]);
      }
    } catch (error) {
      toast.error('Failed to add reaction');
    }
  };

  const handlePin = async (e) => {
    e.stopPropagation();
    setShowOptions(false);
    try {
      await messagesAPI.pinMessage(group.id, msg.id);
      onPin && onPin(msg.id);
    } catch {
      toast.error('Failed to pin message');
    }
  };

  const handleUnpin = async (e) => {
    e.stopPropagation();
    setShowOptions(false);
    try {
      await messagesAPI.unpinMessage(group.id, msg.id);
      onUnpin && onUnpin(msg.id);
    } catch {
      toast.error('Failed to unpin message');
    }
  };

  const fileUrl = msg.file_url ? (msg.file_url.startsWith('http') ? msg.file_url : `${process.env.REACT_APP_API_URL}${msg.file_url}`) : null;

  const hasAdditional = msg.additional_files && msg.additional_files.length > 0;
  const additionalImages = msg.additional_files ? msg.additional_files.filter(f => f.mime_type?.startsWith('image/')) : [];
  const additionalAudios = msg.additional_files ? msg.additional_files.filter(f => f.mime_type?.startsWith('audio/')) : [];
  const additionalVideos = msg.additional_files ? msg.additional_files.filter(f => f.mime_type?.startsWith('video/')) : [];
  const additionalOthers = msg.additional_files ? msg.additional_files.filter(f => !f.mime_type?.startsWith('image/') && !f.mime_type?.startsWith('audio/') && !f.mime_type?.startsWith('video/')) : [];

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
              <span className="reply-text">{msg.reply_content.replace(/@\[([^\]]+)\]\(uid:\d+\)/g, '@$1')}</span>
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

  {hasAdditional && !msg.is_deleted ? (
    <>
      {/* Multiple Images Grid */}
      {additionalImages.length > 0 && (
        <div className="additional-images-grid" style={{
          display: 'grid',
          gridTemplateColumns: additionalImages.length === 1 ? '1fr' : additionalImages.length === 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '8px',
          marginBottom: '8px',
          maxWidth: '360px'
        }}>
          {additionalImages.map((file, idx) => {
            const fUrl = file.file_url.startsWith('http') ? file.file_url : `${process.env.REACT_APP_API_URL}${file.file_url}`;
            const storedFilename = (file.file_url || '').split('/').pop();
            const nameParam = encodeURIComponent(file.file_name || storedFilename);
            const downloadUrl = `${process.env.REACT_APP_API_URL}/api/download/${encodeURIComponent(storedFilename)}?name=${nameParam}`;
            return (
              <div key={idx} className="media-content" style={{ margin: 0, borderRadius: '8px', overflow: 'hidden' }}>
                <img
                  src={fUrl}
                  alt={file.file_name || "Shared image"}
                  loading="lazy"
                  style={{
                    cursor: 'zoom-in',
                    width: '100%',
                    height: additionalImages.length > 1 ? '120px' : 'auto',
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageClick?.({
                      url: fUrl,
                      name: file.file_name || storedFilename,
                      downloadUrl,
                      images: additionalImages.map(img => {
                        const imgUrl = img.file_url.startsWith('http') ? img.file_url : `${process.env.REACT_APP_API_URL}${img.file_url}`;
                        const stored = (img.file_url || '').split('/').pop();
                        const nParam = encodeURIComponent(img.file_name || stored);
                        const dlUrl = `${process.env.REACT_APP_API_URL}/api/download/${encodeURIComponent(stored)}?name=${nParam}`;
                        return { url: imgUrl, name: img.file_name || stored, downloadUrl: dlUrl };
                      }),
                      currentIndex: idx
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Audios */}
      {additionalAudios.map((file, idx) => {
        const fUrl = file.file_url.startsWith('http') ? file.file_url : `${process.env.REACT_APP_API_URL}${file.file_url}`;
        return (
          <div key={idx} className="media-content">
            <audio controls>
              <source src={fUrl} type={file.mime_type || 'audio/mpeg'} />
              Your browser does not support the audio element.
            </audio>
          </div>
        );
      })}

      {/* Videos */}
      {additionalVideos.map((file, idx) => {
        const fUrl = file.file_url.startsWith('http') ? file.file_url : `${process.env.REACT_APP_API_URL}${file.file_url}`;
        return (
          <div key={idx} className="media-content">
            <video controls width="300" height="200">
              <source src={fUrl} type={file.mime_type || 'video/mp4'} />
              Your browser does not support the video element.
            </video>
          </div>
        );
      })}

      {/* Generic Files */}
      {additionalOthers.map((file, idx) => {
        const fUrl = file.file_url.startsWith('http') ? file.file_url : `${process.env.REACT_APP_API_URL}${file.file_url}`;
        const storedFilename = (file.file_url || '').split('/').pop();
        const nameParam = encodeURIComponent(file.file_name || storedFilename);
        const downloadUrl = `${process.env.REACT_APP_API_URL}/api/download/${encodeURIComponent(storedFilename)}?name=${nameParam}`;
        let fileIcon = '📄';
        if(file.mime_type?.includes('pdf')) fileIcon = '📕';
        else if(file.mime_type?.includes('word')||file.mime_type?.includes('document')) fileIcon = '📝';
        else if(file.mime_type?.includes('sheet')||file.mime_type?.includes('excel')) fileIcon = '📊';
        else if(file.mime_type?.includes('zip')||file.mime_type?.includes('compressed')) fileIcon = '🗜️';
        return (
          <div key={idx} className="file-content" style={{ marginBottom: '8px' }} onClick={() => {
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = file.file_name || 'file';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}>
            <div className="file-icon">{fileIcon}</div>
            <div className="file-info">
              <div className="file-name">{file.file_name}</div>
              <div className="file-size">{fs(file.file_size)}</div>
            </div>
          </div>
        );
      })}
    </>
  ) : (
    <>
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
              onImageClick?.({
                url: fileUrl,
                name: msg.file_name || storedFilename,
                downloadUrl,
                images: [{ url: fileUrl, name: msg.file_name || storedFilename, downloadUrl }],
                currentIndex: 0
              });
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
    </>
  )}

  {/* Text Content */}
  <div className="text-content" onCopy={e => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.toString()) return;
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const div = document.createElement('div');
    div.appendChild(fragment);
    // <br> for Teams, pre-wrap wrapper for Gmail — no trailing \n or double breaks.
    const rawHtml = div.innerHTML.replace(/\n/g, '<br>');
    const html = `<div style="white-space:pre-wrap;font-family:inherit">${rawHtml}</div>`;
    e.clipboardData.setData('text/html', html);
    e.clipboardData.setData('text/plain', selection.toString());
    e.preventDefault();
  }}>
    {isEditing ? (
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        <textarea
          ref={editInputRef}
          value={editContent}
          onChange={e => {
            setEditContent(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
            if (e.key === 'Escape') handleEditCancel();
          }}
          style={{
            width:'100%', minHeight:80, resize:'none', overflow:'hidden',
            background:'var(--bg-primary)', color:'var(--text-primary)',
            border:'1.5px solid var(--accent)', borderRadius:8,
            padding:'8px 10px', fontSize:13, fontFamily:'inherit', lineHeight:1.5,
            outline:'none', boxSizing:'border-box',
          }}
        />
        <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
          <button onClick={handleEditCancel}
            style={{padding:'3px 10px',borderRadius:6,border:'1px solid var(--border)',
              background:'transparent',color:'var(--text-secondary)',fontSize:12,cursor:'pointer'}}>
            Cancel
          </button>
          <button onClick={handleEditSave} disabled={editSaving || !editContent.trim()}
            style={{padding:'3px 10px',borderRadius:6,border:'none',
              background:'var(--accent)',color:'#fff',fontSize:12,cursor:'pointer',opacity:editSaving?0.6:1}}>
            {editSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    ) : (
      (() => {
        const { prefix, text } = parseMsgContent(msg.content);
        return (
          <>
            {prefix && (
              <div style={{fontSize:11,fontWeight:600,opacity:0.6,marginBottom:3,letterSpacing:'0.02em',userSelect:'none'}}>
                {prefix}
              </div>
            )}
            <div className="message-text">{renderContent(text, searchQuery)}</div>
          </>
        );
      })()
    )}
      <div className="message-time" style={{userSelect:'none'}}>
            {format(new Date(msg.sent_at), 'HH:mm')}
            {msg.is_edited && <span style={{fontSize:10,opacity:0.5,marginLeft:4}}>(edited)</span>}
          </div>
    {msg.task_ref && (
      <TaskPill taskRef={msg.task_ref} onTaskClick={onTaskClick} />
    )}
  </div>

</div>

  {isOwn && seenPopup && (
    <div style={{
      position: 'fixed',
      bottom: window.innerHeight - seenPopup.rect.top + 6,
      left: seenPopup.rect.left + seenPopup.rect.width / 2,
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: 8,
      padding: '5px 10px',
      fontSize: 12,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
      pointerEvents: 'none',
    }}>
      <div style={{fontWeight:600,opacity:0.7,marginBottom:2}}>Seen by</div>
      {seenPopup.names.map((n,i) => <div key={i}>{n}</div>)}
    </div>
  )}

        {/* Reactions + Seen-by */}
        {!msg.is_deleted && (localReactions.length > 0 || (isOwn && localReadBy.length > 0)) && (
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          {localReactions.length > 0 && (
          <div className="reactions-bar">
            {Object.entries(
              localReactions.reduce((acc, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = [];
                acc[r.emoji].push(r);
                return acc;
              }, {})
            ).map(([emoji, reactors]) => {
              const isOwn = reactors.some(r => r.user_id === user?.id);
              return (
                <div
                  key={emoji}
                  className={`reaction-item ${isOwn ? 'own-reaction' : ''}`}
                  onClick={() => handleReaction(emoji)}
                  onMouseEnter={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setReactionPopup({ names: reactors.map(r => r.user_name || 'User'), rect });
                  }}
                  onMouseLeave={() => setReactionPopup(null)}
                >
                  <span className="reaction-emoji">{emoji}</span>
                  <span className="reaction-count">{reactors.length}</span>
                </div>
              );
            })}
            {reactionPopup && (
              <div style={{
                position: 'fixed',
                bottom: window.innerHeight - reactionPopup.rect.top + 6,
                left: reactionPopup.rect.left + reactionPopup.rect.width / 2,
                transform: 'translateX(-50%)',
                zIndex: 9999,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
                pointerEvents: 'none',
              }}>
                {reactionPopup.names.join(', ')}
              </div>
            )}
          </div>
          )}

          {isOwn && localReadBy.length > 0 && (
            <div
              className="seen-by-bar"
              style={{display:'flex',alignItems:'center',cursor:'pointer',padding:'3px 8px 3px 3px',borderRadius:20,border:'1px solid var(--border-color)'}}
              onClick={e => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setSeenPopup(prev => prev ? null : {
                  names: localReadBy.map(r => `${r.user_name || 'User'} · ${format(new Date(r.timestamp), 'HH:mm')}`),
                  rect
                });
              }}
              title="Seen by"
            >
              <div style={{display:'flex'}}>
                {localReadBy.slice(0,4).map((r,i) => (
                  <div key={r.user_id} style={{
                    width:18,height:18,borderRadius:'50%',
                    background:ac(r.user_name||''),
                    color:'#fff',fontSize:8,fontWeight:700,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    border:'1.5px solid var(--bg-primary)',
                    marginLeft: i===0?0:-6,
                  }}>
                    {ini(r.user_name||'U')}
                  </div>
                ))}
              </div>
              {localReadBy.length > 4 && (
                <span style={{fontSize:10,color:'var(--text-muted)',marginLeft:3}}>+{localReadBy.length-4}</span>
              )}
              <span style={{fontSize:10,color:'var(--text-muted)',marginLeft:4}}>Seen</span>
            </div>
          )}
          </div>
        )}

        {/* Emoji Picker on Hover */}
        {!msg.is_deleted && <div
          className="emoji-picker-trigger"
          onMouseEnter={() => setShowEmojiPicker(true)}
          onMouseLeave={() => { if(!showExtendedPicker) setShowEmojiPicker(false); }}
        >
          {showEmojiPicker && (
            <div className="emoji-picker">
              {['❤️', '👍', '😂', '🎉', '🔥', '💯', '😢', '😡', '👎', '😍'].map((emoji) => (
                <button key={emoji} className="emoji-btn" onClick={() => handleReaction(emoji)}>{emoji}</button>
              ))}
              <button
                ref={plusBtnRef}
                className="emoji-btn"
                style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = plusBtnRef.current?.getBoundingClientRect();
                  if(rect) setExtendedPickerPos(rect);
                  setShowExtendedPicker(v => !v);
                }}
              >＋</button>
            </div>
          )}
          <div
            className="message-actions"
            onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
          >⋮</div>
        </div>}

        {/* Extended emoji picker panel */}
        {showExtendedPicker && extendedPickerPos && (
          <div
            style={{position:'fixed',inset:0,zIndex:9998}}
            onClick={() => { setShowExtendedPicker(false); setShowEmojiPicker(false); }}
          >
            <div
              onClick={e=>e.stopPropagation()}
              style={{
                position:'fixed',
                bottom: window.innerHeight - extendedPickerPos.top + 8,
                left: Math.min(extendedPickerPos.left, window.innerWidth - 250),
                zIndex:9999,
                background:'var(--bg-primary)',
                border:'1px solid var(--border-color)',
                borderRadius:12,
                padding:'10px 8px 8px',
                boxShadow:'0 4px 24px rgba(0,0,0,0.25)',
                width:242,
              }}
            >
              <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:6,paddingLeft:2,letterSpacing:'0.05em'}}>REACTIONS</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:3}}>
                {[
                  '😢','😮','🙏','😭','🫩','🙇‍♂️',
                  '😰','🤭','😊','🤞','👀','🤔',
                  '🤘','🤜','🥺','😎','😤','😍',
                  '🙌','🔥','🎉','💯','💡','✔️',
                  '➕','❌','🔜','🚢','😌','🫡',
                ].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { handleReaction(emoji); setShowExtendedPicker(false); setShowEmojiPicker(false); }}
                    style={{
                      background:'none',border:'none',cursor:'pointer',
                      fontSize:20,padding:'4px 2px',borderRadius:6,
                      transition:'background 0.1s',lineHeight:1.2,
                    }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg-secondary)'}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}
                  >{emoji}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Options */}
        {!msg.is_deleted && showOptions && (
          <div className=""
              onClick={(e) => e.stopPropagation()} // prevent closing
>
            <button className="option-btn" onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
              <span className="option-icon">{copied ? '✅' : '📋'}</span>
              <span className="option-text">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            {isPinned ? (
              <button className="option-btn" onClick={handleUnpin}>
                <span className="option-icon">📌</span>
                <span className="option-text">Unpin</span>
              </button>
            ) : (
              <button className="option-btn" onClick={handlePin}>
                <span className="option-icon">📌</span>
                <span className="option-text">Pin</span>
              </button>
            )}
            {isOwn && (msg.message_type === 'text' || msg.message_type === 'image' || msg.message_type === 'file') && (
              <button className="option-btn" onClick={(e) => { e.stopPropagation(); handleEditStart(); }}>
                <span className="option-icon">✏️</span>
                <span className="option-text">Edit</span>
              </button>
            )}
            {isOwn && (
              <button className="option-btn delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(); }}>
                <span className="option-icon">🗑️</span>
                <span className="option-text">Delete</span>
              </button>
            )}
          </div>
        )}
        {isPinned && (
          <div style={{
            display:'flex', alignItems:'center', gap:4,
            fontSize:10, color:'var(--text-muted)', marginTop:2,
            paddingLeft: isOwn ? 0 : 4,
            justifyContent: isOwn ? 'flex-end' : 'flex-start',
          }}>
            <span>📌</span>
            <span>Pinned{pinnedByName ? ` by ${pinnedByName}` : ''}</span>
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
// Matches @[Name](uid:1) mention tokens first, then markdown links [label](url), then plain URLs.
const COMBINED_REGEX = /@\[([^\]]+)\]\(uid:(\d+)\)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+|www\.[^\s]+)/g;

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Converts message text to HTML string — same link logic as renderContent but returns a string.
function contentToHtml(text) {
  if (!text) return '';
  let out = '', last = 0;
  COMBINED_REGEX.lastIndex = 0;
  let m;
  while ((m = COMBINED_REGEX.exec(text)) !== null) {
    if (m.index > last) out += escHtml(text.slice(last, m.index));
    if (m[1] != null) {
      out += `<b>@${escHtml(m[1])}</b>`;
    } else if (m[3] != null) {
      out += `<a href="${escHtml(m[4])}">${escHtml(m[3])}</a>`;
    } else {
      const href = m[5].startsWith('www.') ? `https://${m[5]}` : m[5];
      out += `<a href="${escHtml(href)}">${escHtml(m[5])}</a>`;
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out += escHtml(text.slice(last));
  // <br> for Teams, pre-wrap wrapper for Gmail — no trailing \n or double breaks.
  return `<div style="white-space:pre-wrap;font-family:inherit">${out.replace(/\n/g, '<br>')}</div>`;
}

function renderContent(text, searchQuery) {
  if (!text) return text;
  const segments = [];
  let last = 0, match;
  COMBINED_REGEX.lastIndex = 0;
  while ((match = COMBINED_REGEX.exec(text)) !== null) {
    if (match.index > last) segments.push({ type: 'text', value: text.slice(last, match.index) });
    if (match[1] != null) {
      segments.push({ type: 'mention', label: match[1], uid: match[2] });
    } else if (match[3] != null) {
      segments.push({ type: 'mdlink', label: match[3], href: match[4] });
    } else {
      segments.push({ type: 'url', value: match[5] });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });

  return segments.map((seg, i) => {
    if (seg.type === 'mention') {
      return (
        <span key={i} style={{color:'#4f7dff',fontWeight:600,background:'rgba(79,125,255,0.15)',borderRadius:4,padding:'0 3px'}}>
          @{seg.label}
        </span>
      );
    }
    if (seg.type === 'mdlink') {
      return (
        <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer"
          style={{color:'#60a5fa',wordBreak:'break-all',textDecoration:'underline'}}>
          {seg.label}
        </a>
      );
    }
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
  const [pinnedMessages,setPinnedMessages]=useState([]);
  const [pinnedBannerIdx,setPinnedBannerIdx]=useState(0);
  // ── Full-history search (backend-driven, not limited to loaded messages) ──
  const [remoteMatches,setRemoteMatches]=useState([]);
  const [searching,setSearching]=useState(false);
  const [searchCursor,setSearchCursor]=useState(null);
  const [searchHasMore,setSearchHasMore]=useState(false);
  const searchDebounceRef=useRef(null);
  useEffect(()=>{
    if(!previewImage)return;
    const onKey=(e)=>{
      if(e.key==='Escape')setPreviewImage(null);
      else if(e.key==='ArrowLeft') {
        if (previewImage.images && previewImage.images.length > 1) {
          const newIdx = (previewImage.currentIndex - 1 + previewImage.images.length) % previewImage.images.length;
          const nextImg = previewImage.images[newIdx];
          setPreviewImage(prev => ({
            ...prev,
            currentIndex: newIdx,
            url: nextImg.url,
            name: nextImg.name,
            downloadUrl: nextImg.downloadUrl
          }));
        }
      }
      else if(e.key==='ArrowRight') {
        if (previewImage.images && previewImage.images.length > 1) {
          const newIdx = (previewImage.currentIndex + 1) % previewImage.images.length;
          const nextImg = previewImage.images[newIdx];
          setPreviewImage(prev => ({
            ...prev,
            currentIndex: newIdx,
            url: nextImg.url,
            name: nextImg.name,
            downloadUrl: nextImg.downloadUrl
          }));
        }
      }
    };
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[previewImage]);

  const handlePrevImage = (e) => {
    e.stopPropagation();
    if (!previewImage || !previewImage.images || previewImage.images.length <= 1) return;
    const newIdx = (previewImage.currentIndex - 1 + previewImage.images.length) % previewImage.images.length;
    const nextImg = previewImage.images[newIdx];
    setPreviewImage({
      ...previewImage,
      currentIndex: newIdx,
      url: nextImg.url,
      name: nextImg.name,
      downloadUrl: nextImg.downloadUrl
    });
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    if (!previewImage || !previewImage.images || previewImage.images.length <= 1) return;
    const newIdx = (previewImage.currentIndex + 1) % previewImage.images.length;
    const nextImg = previewImage.images[newIdx];
    setPreviewImage({
      ...previewImage,
      currentIndex: newIdx,
      url: nextImg.url,
      name: nextImg.name,
      downloadUrl: nextImg.downloadUrl
    });
  };
  const dragCounterRef=useRef(0);

  const bottomRef=useRef(null);
  const messagesAreaRef=useRef(null);
  const groupIdRef=useRef(null);
  const msRef=useRef(markSeen);
  const pendingSeenRef=useRef({});
  const notifiedSeenRef=useRef(new Set());

  // ── Infinite-scroll (load older on scroll-to-top) bookkeeping ──
  const olderLoadingRef=useRef(false);   // synchronous re-entrancy guard against double-fetching a page
  const scrollAnchorRef=useRef(null);    // {height, top} captured just before an older-page fetch
  const restoreScrollRef=useRef(false);  // tells the layout effect "the last messages update was a prepend"
  const [loadingOlder,setLoadingOlder]=useState(false);

  const isNearBottom=useCallback(()=>{
    const el=messagesAreaRef.current;
    if(!el)return true;
    return el.scrollHeight-el.scrollTop-el.clientHeight<120;
  },[]);
  useEffect(()=>{groupIdRef.current=group?.id?Number(group.id):null;},[group?.id]);
  useEffect(()=>{msRef.current=markSeen;},[markSeen]);

  // Reset match index when searchQuery changes (controlled from parent)
  useEffect(()=>{setCurrentMatchIdx(0);},[searchQuery]);

  // Debounced full-history search — queries the backend instead of only
  // filtering whatever page of messages happens to already be loaded.
  useEffect(()=>{
    clearTimeout(searchDebounceRef.current);
    const q=searchQuery.trim();
    if(!q||!group?.id){
      setRemoteMatches([]);setSearchCursor(null);setSearchHasMore(false);setSearching(false);
      return;
    }
    setSearching(true);
    searchDebounceRef.current=setTimeout(async()=>{
      try{
        const data=await messagesAPI.searchMessages(group.id,q);
        setRemoteMatches(data.messages||[]);
        setSearchCursor(data.nextCursor);
        setSearchHasMore(!!data.hasMore);
      }catch(e){console.error(e);setRemoteMatches([]);}
      setSearching(false);
    },300);
    return()=>clearTimeout(searchDebounceRef.current);
  },[searchQuery,group?.id]);

  // Fetches the next batch of older matches (only relevant on very long histories
  // where the backend stopped scanning before filling the requested limit).
  const searchDeeper=useCallback(async()=>{
    const q=searchQuery.trim();
    if(!q||!group?.id||!searchCursor)return;
    setSearching(true);
    try{
      const data=await messagesAPI.searchMessages(group.id,q,searchCursor);
      setRemoteMatches(prev=>[...prev,...(data.messages||[])]);
      setSearchCursor(data.nextCursor);
      setSearchHasMore(!!data.hasMore);
    }catch(e){console.error(e);}
    setSearching(false);
  },[searchQuery,group?.id,searchCursor]);

  const markSeenBatch=useCallback((msgs)=>{
    const uid=user?.id;
    if(uid==null)return;
    msgs.forEach(m=>{
      if(m.sender_id===uid)return;
      if(notifiedSeenRef.current.has(m.id))return;
      notifiedSeenRef.current.add(m.id);
      msRef.current?.(m.id,m.group_id);
    });
  },[user?.id]);

  const load=useCallback(async(p=1)=>{
    if(!group)return;
    const requestGroupId=Number(group.id);
    if(p===1){
      setLoading(true);
    } else {
      if(olderLoadingRef.current)return; // a fetch for an older page is already in flight
      olderLoadingRef.current=true;
      setLoadingOlder(true);
      const el=messagesAreaRef.current;
      scrollAnchorRef.current={height:el?el.scrollHeight:0,top:el?el.scrollTop:0};
    }
    try{
      const data=await messagesAPI.getMessages(group.id,p);

      // The user may have switched to a different group while this request was
      // in flight. If so, this response is stale — discard it and leave the
      // loading state as-is until the request for the current group resolves.
      if(requestGroupId!==groupIdRef.current)return;
      if(p===1){
        const msgs=data.messages||[];
        setMessages(msgs);
        markSeenBatch(msgs);
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
        restoreScrollRef.current=true;
        setMessages(prev=>[...(data.messages||[]),...prev]);
        markSeenBatch(data.messages||[]);
      }
      setHasMore(data.hasMore);setPage(p);
      if(p===1){
        setLoading(false);
      } else {
        olderLoadingRef.current=false;
        setLoadingOlder(false);
      }
    }catch(e){
      console.error(e);
      if(requestGroupId===groupIdRef.current){
        if(p===1){
          setLoading(false);
        } else {
          olderLoadingRef.current=false;
          setLoadingOlder(false);
        }
      }
    }
  },[group,markSeenBatch]);// eslint-disable-line

  // After older messages are prepended, the browser keeps scrollTop fixed in pixels —
  // since a chunk of new (taller) content just appeared above the viewport, that visually
  // yanks the view to a different spot. Re-anchor scrollTop so the same message stays put.
  useLayoutEffect(()=>{
    if(!restoreScrollRef.current)return;
    restoreScrollRef.current=false;
    const el=messagesAreaRef.current;
    const anchor=scrollAnchorRef.current;
    if(!el||!anchor)return;
    el.scrollTop=anchor.top+(el.scrollHeight-anchor.height);
  },[messages]);

  const handleMessagesScroll=useCallback(()=>{
    const el=messagesAreaRef.current;
    if(!el||!hasMore||olderLoadingRef.current)return;
    if(el.scrollTop<150)load(page+1);
  },[hasMore,page,load]);

  useEffect(()=>{
    if(!group)return;
    setMessages([]);setPage(1);setFirstUnreadId(null);setAccessRevoked(false);
    setReplyTo(null);
    setRemoteMatches([]);setSearchCursor(null);setSearchHasMore(false);setSearching(false);
    // Abandon any older-page fetch that was in flight for the group we're leaving,
    // so its re-entrancy guard doesn't stay stuck "true" and block pagination forever.
    olderLoadingRef.current=false;setLoadingOlder(false);
    load(1);joinGroup(group.id);
  },[group?.id]);// eslint-disable-line

  useEffect(()=>{
    if(!group?.id)return;
    setPinnedMessages([]);
    setPinnedBannerIdx(0);
    messagesAPI.getPinnedMessages(group.id)
      .then(data=>setPinnedMessages(data.pinned||[]))
      .catch(()=>{});
  },[group?.id]);

  const handleDeleteMessage=useCallback((messageId)=>{
    setMessages(prev=>prev.filter(msg=>msg.id!==messageId));
  },[]);

  const applyPendingSeen=useCallback((msg)=>{
    const pending=pendingSeenRef.current[msg.id];
    if(!pending||!pending.length)return msg;
    delete pendingSeenRef.current[msg.id];
    const existing=msg.read_by||[];
    const merged=[...existing];
    pending.forEach(p=>{
      if(p.user_id===msg.sender_id)return;
      if(!merged.some(r=>r.user_id===p.user_id))merged.push(p);
    });
    return {...msg,read_by:merged};
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
      return [...prev, applyPendingSeen(msg)];
    });
    // Keep "last seen" marker current so switching away + back doesn't
    // re-show the divider for messages already visible in this session.
    if(msg.sent_at) saveLastSeen(groupIdRef.current, msg.sent_at);
    notifiedSeenRef.current.add(msg.id);
    msRef.current?.(msg.id,msg.group_id);
    if(isNearBottom()){
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),60);
    }
  },[user?.id,isNearBottom,applyPendingSeen]);

  const handleReactionUpdate=useCallback((data)=>{
    if(Number(data.group_id)!==groupIdRef.current)return;
    setMessages(prev=>prev.map(msg=>msg.id===data.message_id?{...msg,reactions:data.reactions}:msg));
  },[]);

  const handleSeenUpdate=useCallback((data)=>{
    if(Number(data.group_id)!==groupIdRef.current)return;
    setMessages(prev=>{
      const idx=prev.findIndex(msg=>msg.id===data.message_id);
      if(idx===-1){
        const list=pendingSeenRef.current[data.message_id]||[];
        if(!list.some(r=>r.user_id===data.user_id)){
          pendingSeenRef.current[data.message_id]=[...list,{user_id:data.user_id,user_name:data.user_name,timestamp:data.timestamp}];
        }
        return prev;
      }
      const msg=prev[idx];
      if(msg.sender_id===data.user_id)return prev;
      const existing=msg.read_by||[];
      if(existing.some(r=>r.user_id===data.user_id))return prev;
      const next=[...prev];
      next[idx]={...msg,read_by:[...existing,{user_id:data.user_id,user_name:data.user_name,timestamp:data.timestamp}]};
      return next;
    });
  },[]);

  const handleTyping=useCallback((data)=>{
    if(Number(data.group_id)!==groupIdRef.current)return;
    setTypingUsers(data.users||[]);
    if(typingTmr.current)clearTimeout(typingTmr.current);
    typingTmr.current=setTimeout(()=>setTypingUsers([]),3000);
  },[]);

  const handleDeletedMessage=useCallback((data)=>{
    if(Number(data.group_id)!==groupIdRef.current)return;
    setMessages(prev => prev.filter(m => m.id !== data.message_id));
  },[]);

  const handleEditMessage=useCallback((messageId, newContent)=>{
    setMessages(prev=>prev.map(m=>
      m.id===messageId ? {...m, content:newContent, is_edited:true} : m
    ));
  },[]);

  const handleEditedMessage=useCallback((data)=>{
    if(Number(data.group_id)!==groupIdRef.current)return;
    setMessages(prev=>prev.map(m=>
      m.id===data.message_id ? {...m, content:data.content, is_edited:true, edited_at:data.edited_at} : m
    ));
  },[]);

  useEffect(()=>{
    const unsubNewMsg=on('new_message',handleNewMsg);
    const unsubReaction=on('reaction_update',handleReactionUpdate);
    const unsubSeen=on('message_status_update',handleSeenUpdate);
    const unsubTyping=on('typing',handleTyping);
    const unsubDeleted=on('message_deleted',handleDeletedMessage);
    const unsubEdited=on('message_edited',handleEditedMessage);

    const unsubPinned=on('message_pinned',(data)=>{
      if(Number(data.group_id)!==groupIdRef.current)return;
      const mid=Number(data.message_id);
      setPinnedMessages(prev=>{
        if(prev.some(p=>Number(p.message_id)===mid))return prev;
        return [...prev,{message_id:mid,pinned_by_name:data.pinned_by_name,pinned_at:data.pinned_at}];
      });
    });
    const unsubUnpinned=on('message_unpinned',(data)=>{
      if(Number(data.group_id)!==groupIdRef.current)return;
      const mid=Number(data.message_id);
      setPinnedMessages(prev=>prev.filter(p=>Number(p.message_id)!==mid));
      setPinnedBannerIdx(0);
    });

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

    return()=>{unsubNewMsg();unsubReaction();unsubSeen();unsubTyping();unsubDeleted();unsubEdited();unsubPinned();unsubUnpinned();unsubRemoved();};
  },[on,handleNewMsg,handleReactionUpdate,handleSeenUpdate,handleTyping,handleDeletedMessage,handleEditedMessage,group?.id]);

  const typingTmr=useRef(null);

  const grouped=messages.reduce((acc,msg,i)=>{
    const prev=messages[i-1];
    acc.push({...msg,showDate:!prev||!isSameDay(new Date(prev.sent_at),new Date(msg.sent_at)),showAvatar:!prev||prev.sender_id!==msg.sender_id||!isSameDay(new Date(prev?.sent_at),new Date(msg.sent_at))});
    return acc;
  },[]);

  // Search matches — authoritative list comes from the backend (full history,
  // not just whatever page of messages happens to be loaded right now).
  const searchMatches=useMemo(()=>remoteMatches.map(msg=>({msg})),[remoteMatches]);
  const matchIdSet=useMemo(()=>new Set(remoteMatches.map(m=>m.id)),[remoteMatches]);

  // Scroll to current match — the target may not be in the currently loaded
  // page, so this reuses scrollToMessage's "keep loading older pages" logic.
  useEffect(()=>{
    if(!searchMatches.length)return;
    const target=searchMatches[currentMatchIdx];
    if(target)scrollToMessage(target.msg.id);
  },[currentMatchIdx,searchMatches]);

  const scrollToMessage = useCallback(async (messageId) => {
    const highlight = (el) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'outline 0.2s';
      el.style.outline = '2px solid var(--accent)';
      el.style.borderRadius = '8px';
      setTimeout(() => { el.style.outline = ''; }, 1500);
    };

    // If already in DOM, jump immediately
    const existing = matchRefs.current[messageId];
    if (existing) { highlight(existing); return; }

    // Message not loaded yet — keep fetching older pages until we find it
    let nextPage = page + 1;
    let found = false;
    while (!found && hasMore) {
      try {
        const data = await messagesAPI.getMessages(group.id, nextPage);
        const older = data.messages || [];
        setMessages(prev => [...older, ...prev]);
        setPage(nextPage);
        setHasMore(data.hasMore);
        // Give React time to render the new messages into the DOM
        await new Promise(r => setTimeout(r, 150));
        const el = matchRefs.current[messageId];
        if (el) { highlight(el); found = true; }
        if (!data.hasMore) break;
        nextPage++;
      } catch { break; }
    }
  }, [group, page, hasMore]);

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
          {previewImage.images && previewImage.images.length > 1 && (
            <>
              <button
                onClick={handlePrevImage}
                style={{
                  position: 'absolute',
                  left: '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: 10000,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
              >
                ◀
              </button>
              <button
                onClick={handleNextImage}
                style={{
                  position: 'absolute',
                  right: '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: 10000,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
              >
                ▶
              </button>
            </>
          )}
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
            {searching&&!searchMatches.length?'Searching…':searchMatches.length===0?`No results for "${searchQuery}"`:`${currentMatchIdx+1} / ${searchMatches.length}${searchHasMore?'+':''} matches`}
          </span>
          {searchHasMore&&!searching&&(
            <button onClick={searchDeeper}
              style={{background:'none',border:'1px solid var(--border-color)',borderRadius:5,padding:'2px 7px',cursor:'pointer',color:'var(--text-muted)',fontSize:11}}>
              Search further back
            </button>
          )}
          <button disabled={!searchMatches.length} onClick={()=>setCurrentMatchIdx(i=>(i-1+searchMatches.length)%searchMatches.length)}
            style={{background:'none',border:'1px solid var(--border-color)',borderRadius:5,padding:'2px 7px',cursor:'pointer',color:'var(--text-muted)',opacity:searchMatches.length?1:0.4}}>▲</button>
          <button disabled={!searchMatches.length} onClick={()=>setCurrentMatchIdx(i=>(i+1)%searchMatches.length)}
            style={{background:'none',border:'1px solid var(--border-color)',borderRadius:5,padding:'2px 7px',cursor:'pointer',color:'var(--text-muted)',opacity:searchMatches.length?1:0.4}}>▼</button>
        </div>
      )}

      {/* ── Pinned message banner ── */}
      {pinnedMessages.length>0&&(()=>{
        const safeIdx=pinnedBannerIdx%pinnedMessages.length;
        const current=pinnedMessages[pinnedMessages.length-1-safeIdx];
        return(
          <div style={{
            display:'flex',alignItems:'center',gap:8,
            padding:'5px 12px',
            borderBottom:'1px solid var(--border-color)',
            background:'var(--bg-secondary)',
            flexShrink:0,fontSize:12,cursor:'pointer',userSelect:'none',
          }}
            onClick={()=>{
              const el=matchRefs.current[current.message_id];
              if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
              setPinnedBannerIdx(i=>(i+1)%pinnedMessages.length);
            }}
          >
            <span style={{fontSize:14}}>📌</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:11}}>
                {pinnedMessages.length>1?`${safeIdx+1} / ${pinnedMessages.length} pinned messages`:'Pinned message'}
              </div>
              <div style={{color:'var(--text-muted)',fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                Pinned by {current.pinned_by_name}
              </div>
            </div>
            {pinnedMessages.length>1&&(
              <span style={{fontSize:10,color:'var(--text-muted)',flexShrink:0}}>▲</span>
            )}
          </div>
        );
      })()}

      <div className="messages-area" ref={messagesAreaRef} onScroll={handleMessagesScroll}>
        {loadingOlder&&<div style={{textAlign:'center',padding:'8px 0',fontSize:12,color:'var(--text-muted)'}}>Loading older messages…</div>}
        {loading?(
          <div className="empty-state"><p>Loading…</p></div>
        ):messages.length===0?(
          <div className="empty-state"><div className="empty-state-icon">🚀</div><p>Start the conversation!</p></div>
        ):grouped.map(msg=>{
          const isMatch=searchQuery.trim()&&matchIdSet.has(msg.id);
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
                onEditMessage={handleEditMessage}
                searchQuery={searchQuery}
                onReplyClick={scrollToMessage}
                onImageClick={setPreviewImage}
                isPinned={pinnedMessages.some(p=>Number(p.message_id)===Number(msg.id))}
                pinnedByName={pinnedMessages.find(p=>Number(p.message_id)===Number(msg.id))?.pinned_by_name}
                onPin={(msgId)=>setPinnedMessages(prev=>{const n=Number(msgId);if(prev.some(p=>Number(p.message_id)===n))return prev;return[...prev,{message_id:n,pinned_by_name:user?.full_name||'You',pinned_at:new Date().toISOString()}];})}
                onUnpin={(msgId)=>{const n=Number(msgId);setPinnedMessages(prev=>prev.filter(p=>Number(p.message_id)!==n));setPinnedBannerIdx(0);}}
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
            setMessages(prev => [...prev, applyPendingSeen(newMessage)]);
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
