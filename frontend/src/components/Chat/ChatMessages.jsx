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
function Bubble({msg,isOwn,showAvatar,onTaskClick,group,onDeleteMessage}){
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
    const textToCopy = msg.content;
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
          <div className="reply-bubble">
            <div className="reply-content">
              <span className="reply-label">Replying to {msg.reply_sender_name}</span>
              <span className="reply-text">{msg.reply_content}</span>
            </div>
          </div>
        )}
        
        <div className="message-content">
          {msg.content}
          <div className="message-time">
            {format(new Date(msg.sent_at), 'HH:mm')}
          </div>
        </div>

        {/* Image */}
        {msg.message_type === 'image' && fileUrl && (
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
        )}

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
  {msg.message_type === 'image' && fileUrl && (
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
  )}

  {/* Audio */}
  {msg.message_type === 'audio' && fileUrl && (
    <div className="media-content">
      <audio controls>
        <source src={fileUrl} type={msg.mime_type || 'audio/mpeg'} />
        Your browser does not support the audio element.
      </audio>
    </div>
  )}

  {/* Video */}
  {msg.message_type === 'video' && fileUrl && (
    <div className="media-content">
      <video controls width="300" height="200">
        <source src={fileUrl} type={msg.mime_type || 'video/mp4'} />
        Your browser does not support the video element.
      </video>
    </div>
  )}

  {/* File */}
  {msg.message_type === 'file' && fileUrl && (
    <div className="file-content" onClick={() => window.open(fileUrl, '_blank')}>
      <div className="file-icon">{msg.file_icon || '📄'}</div>
      <div className="file-info">
        <div className="file-name">{msg.file_name}</div>
        <div className="file-size">{fs(msg.file_size)}</div>
      </div>
    </div>
  )}

  {/* Text Content */}
  <div className="text-content">
    <div className="message-text">{msg.content}</div>
    {msg.task_ref && (
      <TaskPill taskRef={msg.task_ref} onTaskClick={onTaskClick} />
    )}
  </div>

</div>
        {/* Reactions */}
        {localReactions.length > 0 && (
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
        <div 
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
        </div>

        {/* Message Options */}
        {showOptions && (
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

/* ── Main ──────────────────────────────────────────────────── */
export default function ChatMessages({group,onTaskClick}){
  const {user}=useAuth();
  const {on,joinGroup,markSeen,sendTyping}=useSocket();
  const [messages,setMessages]=useState([]);
  const [loading,setLoading]=useState(true);
  const [page,setPage]=useState(1);
  const [hasMore,setHasMore]=useState(false);
  const [replyTo,setReplyTo]=useState(null);
  const [typingUsers,setTypingUsers]=useState([]);
  const [showTaskPopup,setShowTaskPopup]=useState(false);
  // FIX: track access revocation so we can render a friendly UI instead of
  // continuing to fire 403 API calls when the user is removed mid-session.
  const [accessRevoked,setAccessRevoked]=useState(false);

  const bottomRef=useRef(null);
  const groupIdRef=useRef(null);
  const msRef=useRef(markSeen);
  useEffect(()=>{groupIdRef.current=group?.id?Number(group.id):null;},[group?.id]);
  useEffect(()=>{msRef.current=markSeen;},[markSeen]);

  const load=useCallback(async(p=1)=>{
    if(!group)return;
    if(p===1)setLoading(true);
    try{
      const data=await messagesAPI.getMessages(group.id,p);
      if(p===1){setMessages(data.messages||[]);setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'instant'}),80);}
      else{setMessages(prev=>[...(data.messages||[]),...prev]);}
      setHasMore(data.hasMore);setPage(p);
    }catch(e){console.error(e);}
    setLoading(false);
  },[group]);// eslint-disable-line

  useEffect(()=>{
    if(!group)return;
    setMessages([]);setPage(1);setAccessRevoked(false);load(1);joinGroup(group.id);
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
    
    msRef.current?.(msg.id,msg.group_id);
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),60);
  },[user?.id]);

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

  return(
    <>
      <div className="messages-area">
        {hasMore&&<div style={{textAlign:'center',paddingBottom:12}}><button className="btn btn-secondary btn-sm" onClick={()=>load(page+1)}>Load older</button></div>}
        {loading?(
          <div className="empty-state"><p>Loading…</p></div>
        ):messages.length===0?(
          <div className="empty-state"><div className="empty-state-icon">🚀</div><p>Start the conversation!</p></div>
        ):grouped.map(msg=>(
          <React.Fragment key={msg.id}>
            {msg.showDate&&<div className="date-divider">{fd(msg.sent_at)}</div>}
            <div onDoubleClick={()=>setReplyTo(msg)}>
              <Bubble msg={msg} isOwn={msg.sender_id===user?.id} showAvatar={msg.showAvatar} onTaskClick={onTaskClick} group={group} onDeleteMessage={handleDeleteMessage}/>
            </div>
          </React.Fragment>
        ))}
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
            // Add message to local state from API response
            setMessages(prev => [...prev, newMessage]);
            setReplyTo(null);
            bottomRef.current?.scrollIntoView({behavior:'smooth'});
          }}
          currentUser={user}
          replyTo={replyTo}
          onReplyCancel={() => setReplyTo(null)}
        />
      </div>
    </>
  );
}
