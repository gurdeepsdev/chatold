import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { messagesAPI, authAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';
import ForwardModal from './ForwardModal';
import TaskQuickPopup from '../Tasks/TaskQuickPopup';

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
  const [onDeleteMessageState, setOnDeleteMessageState] = useState(onDeleteMessage);
  const messageRef = useRef(null);
  
  // Sync local reactions with message reactions when they change
  useEffect(() => {
    setLocalReactions(msg.reactions || []);
  }, [msg.reactions]);
  
  const handleCopy = () => {
    let textToCopy = '';
    if (msg.content) {
      textToCopy = msg.content;
    } else if (msg.file_name) {
      textToCopy = msg.file_name;
    }
    
    navigator.clipboard.writeText(textToCopy);
    toast.success('Message copied');
  };
  
  const handleForward = () => {
    setShowForwardModal(true);
  };
  
  const handleForwardMessage = async (groupId, message) => {
    try {
      const messageData = {
        content: message.content,
        file_url: message.file_url,
        file_name: message.file_name,
        file_size: message.file_size,
        mime_type: message.mime_type,
        message_type: message.message_type
      };
      
      await messagesAPI.sendMessage(groupId, messageData);
    } catch (error) {
      console.error('Failed to forward message:', error);
      throw error;
    }
  };
  
  const handleReact = async (reaction) => {
    try {
      const response = await messagesAPI.addReaction(group.id, msg.id, reaction);
      
      // Update local reactions with backend response
      setLocalReactions(response.reactions);
      
      toast.success(`Reacted with ${reaction}`);
    } catch (error) {
      console.error('Failed to add reaction:', error);
      toast.error('Failed to add reaction');
    }
  };
  
  const handleRemoveReaction = async (emoji) => {
    try {
      const response = await messagesAPI.removeReaction(group.id, msg.id, emoji);
      
      // Update local reactions with backend response
      setLocalReactions(response.reactions);
      
      toast.success(`Removed ${emoji} reaction`);
    } catch (error) {
      console.error('Failed to remove reaction:', error);
      toast.error('Failed to remove reaction');
    }
  };
  
  const handleDelete = async () => {
    try {
      await messagesAPI.deleteMessage(group.id, msg.id);
      toast.success('Message deleted');
      
      // Call parent callback to update messages state
      if (onDeleteMessage) {
        onDeleteMessage(msg.id);
      }
      
      // Close options menu
      setShowOptions(false);
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  };

  if(msg.message_type==='task_notification'||msg.message_type==='system'){
    return(
      <div style={{display:'flex',justifyContent:'center',padding:'6px 0'}}>
        <div style={{background:'rgba(79,125,255,.08)',border:'1px solid rgba(79,125,255,.2)',
          borderRadius:20,padding:'4px 14px',fontSize:12,color:'var(--text-secondary)',
          display:'inline-flex',alignItems:'center',gap:8,flexWrap:'wrap',justifyContent:'center',maxWidth:'80%'}}>
          <span>{msg.content}</span>
          {msg.task_ref&&<TaskPill taskRef={msg.task_ref} onTaskClick={onTaskClick}/>}
        </div>
      </div>
    );
  }
  const fileUrl=msg.file_url||null;
  return(
    <div className={`message-row ${isOwn?'own':''}`} style={{position: 'relative'}}>
      {!isOwn&&(
        <div style={{width:32,height:32,borderRadius:'50%',background:`${ac(msg.sender_name)}33`,color:ac(msg.sender_name),
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0,opacity:showAvatar?1:0}}>
          {showAvatar?ini(msg.sender_name):''}
        </div>
      )}
      <div className="message-content">
        {showAvatar&&!isOwn&&(
          <div className="message-sender">{msg.sender_name}
            <span style={{fontSize:10,color:'var(--text-muted)',fontWeight:400,marginLeft:6,textTransform:'capitalize'}}>[{msg.sender_role}]</span>
          </div>
        )}
        {msg.reply_content&&(
          <div style={{background:'var(--bg-active)',borderLeft:'3px solid var(--accent)',borderRadius:6,padding:'4px 10px',marginBottom:4,fontSize:12,color:'var(--text-secondary)'}}>
            <strong>{msg.reply_sender_name}: </strong>{msg.reply_content?.slice(0,80)}{msg.reply_content?.length>80?'…':''}
          </div>
        )}
        {msg.message_type==='image'&&fileUrl?(
          <div style={{maxWidth:300}}>
            <img src={fileUrl} alt={msg.file_name}
              style={{maxWidth:'100%',maxHeight:260,borderRadius:10,cursor:'pointer',border:'1px solid var(--border)',display:'block'}}
              onClick={()=>window.open(fileUrl,'_blank')} onError={e=>e.target.style.display='none'}/>
          </div>
        ):msg.message_type==='audio'&&fileUrl?(
          <div className={`message-bubble ${isOwn?'sent':'received'}`} style={{padding:'8px 12px'}}>
            <audio controls style={{height:34,maxWidth:240}}><source src={fileUrl}/></audio>
          </div>
        ):fileUrl?(
          <a href={fileUrl} download={msg.file_name} style={{textDecoration:'none'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'var(--bg-active)',
              border:'1px solid var(--border)',borderRadius:10,cursor:'pointer',maxWidth:300,transition:'border-color .15s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <span style={{fontSize:26}}>{fi(msg.mime_type)}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{msg.file_name}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{fs(msg.file_size)} · click to download</div>
              </div>
              <span style={{fontSize:22,color:'var(--accent)'}}>⬇</span>
            </div>
          </a>
        ):(
          <div className={`message-bubble ${isOwn?'sent':'received'}`}>
            {msg.is_deleted ? (
              <em style={{opacity:.6}}>Message deleted</em>
            ) : (
              renderContentWithMentions(msg.content)
            )}
          </div>
        )}
        {msg.task_ref&&msg.message_type!=='task_notification'&&(
          <div><TaskPill taskRef={msg.task_ref} onTaskClick={onTaskClick}/></div>
        )}
        
        {/* Message Reactions */}
        <MessageReactions 
          reactions={localReactions} 
          onAddReaction={handleReact}
          onRemoveReaction={handleRemoveReaction}
          currentUserId={user.id}
        />
        <div className="message-time">
          <span>{ft(msg.sent_at)}</span>
          {isOwn&&<span style={{color:'var(--success)',marginLeft:4}}>✓✓</span>}
          <button
            onClick={() => setShowOptions(!showOptions)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              marginLeft: 8,
              fontSize: 12,
              color: 'var(--text-muted)',
              borderRadius: 4,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-active)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            ⋮
          </button>
        </div>
        
        {showOptions && (
          <MessageOptionsMenu
            msg={msg}
            isOwn={isOwn}
            onClose={() => setShowOptions(false)}
            onCopy={handleCopy}
            onForward={handleForward}
            onReact={handleReact}
            onDelete={handleDelete}
          />
        )}
        
        {showForwardModal && (
          <ForwardModal
            message={{
              content: msg.content,
              file_url: msg.file_url,
              file_name: msg.file_name,
              file_size: msg.file_size,
              mime_type: msg.mime_type,
              message_type: msg.message_type
            }}
            onClose={() => setShowForwardModal(false)}
            onForward={handleForwardMessage}
          />
        )}
      </div>
    </div>
  );
}

/* ── Mention Dropdown ─────────────────────────────────────── */
function MentionDropdown({ users, query, selectedIndex, onSelect, onUserSelect, onClose }) {
  if (!users.length) return null;
  
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onSelect((selectedIndex + 1) % users.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onSelect(selectedIndex === 0 ? users.length - 1 : selectedIndex - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };
  
  return (
    <div 
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        maxHeight: 200,
        overflowY: 'auto',
        zIndex: 1000,
        marginBottom: 8,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.15)'
      }}
      onKeyDown={handleKeyDown}
    >
      {users.map((user, index) => (
        <div
          key={user.id}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            background: index === selectedIndex ? 'var(--bg-active)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'background 0.15s'
          }}
          onClick={() => onUserSelect(user)}
          onMouseEnter={() => onSelect(index)}
        >
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: `${ac(user.full_name)}33`,
            color: ac(user.full_name),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700
          }}>
            {ini(user.full_name)}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{user.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.role}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Message Options Menu ─────────────────────────────────── */
function MessageOptionsMenu({ msg, isOwn, onClose, onCopy, onForward, onReact, onDelete }) {
  const [showReactions, setShowReactions] = useState(false);
  
  const reactions = ['❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🎉'];
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: isOwn ? 'auto' : 0,
      right: isOwn ? 0 : 'auto',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
      zIndex: 1000,
      minWidth: 150,
      marginBottom: 8
    }}>
      <div style={{padding: '4px 0'}}>
        <button
          onClick={() => { onCopy(); onClose(); }}
          style={{
            width: '100%',
            padding: '8px 16px',
            border: 'none',
            background: 'transparent',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-active)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          📋 Copy
        </button>
        
        <button
          onClick={() => { onForward(); onClose(); }}
          style={{
            width: '100%',
            padding: '8px 16px',
            border: 'none',
            background: 'transparent',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-active)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          ➡️ Forward
        </button>
        
        <div style={{position: 'relative'}}>
          <button
            onClick={() => setShowReactions(!showReactions)}
            style={{
              width: '100%',
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-active)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            😊 React
          </button>
          
          {showReactions && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px',
              display: 'flex',
              gap: 4,
              boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
              zIndex: 1001,
              marginBottom: 4
            }}>
              {reactions.map(reaction => (
                <button
                  key={reaction}
                  onClick={() => { onReact(reaction); onClose(); }}
                  style={{
                    fontSize: 20,
                    padding: 4,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: 4,
                    transition: 'transform 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {reaction}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {isOwn && (
          <button
            onClick={() => { onDelete(); onClose(); }}
            style={{
              width: '100%',
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 13,
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
            gap: 8
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            🗑️ Delete
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Message Reactions Display ───────────────────────────── */
function MessageReactions({ reactions, onAddReaction, onRemoveReaction, currentUserId, messageId }) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState(null);
  const pickerTimeoutRef = useRef(null);
  
  // Available reactions
  const availableReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];
  
  // Group reactions by emoji and count
  const groupedReactions = reactions?.reduce((acc, reaction) => {
    const emoji = reaction.emoji;
    if (!acc[emoji]) {
      acc[emoji] = {
        emoji,
        count: 0,
        users: [],
        userReacted: false
      };
    }
    acc[emoji].count++;
    acc[emoji].users.push(reaction.user_name);
    if (reaction.user_id === currentUserId) {
      acc[emoji].userReacted = true;
    }
    return acc;
  }, {}) || {};
  
  const handleReactionClick = (emoji) => {
    const reaction = groupedReactions[emoji];
    if (reaction?.userReacted) {
      // Remove reaction if user already reacted
      onRemoveReaction(emoji);
    } else {
      // Add reaction
      onAddReaction(emoji);
    }
  };
  
  const handleMouseEnter = () => {
    // Clear any existing timeout
    if (pickerTimeoutRef.current) {
      clearTimeout(pickerTimeoutRef.current);
    }
    setShowReactionPicker(true);
  };
  
  const handleMouseLeave = () => {
    // Add a small delay before hiding to allow moving to picker
    pickerTimeoutRef.current = setTimeout(() => {
      setShowReactionPicker(false);
    }, 200);
  };
  
  const handlePickerMouseEnter = () => {
    // Keep picker visible when hovering over it
    if (pickerTimeoutRef.current) {
      clearTimeout(pickerTimeoutRef.current);
    }
  };
  
  const handlePickerMouseLeave = () => {
    setShowReactionPicker(false);
  };
  
  return (
    <div 
      style={{ 
        position: 'relative',
        padding: '4px 0', // Add padding to increase hover area
        minHeight: '32px' // Ensure minimum height for hover area even without reactions
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Show existing reactions if any */}
      {reactions && reactions.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center'
        }}>
          {Object.values(groupedReactions).map((group, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: group.userReacted ? 'var(--accent-dim)' : 'var(--bg-active)',
                border: group.userReacted ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 12,
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                setHoveredReaction(group.emoji);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
                setHoveredReaction(null);
              }}
              onClick={() => handleReactionClick(group.emoji)}
              title={group.users.join(', ') + (group.userReacted ? ' (Click to remove)' : '')}
            >
              <span>{group.emoji}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {group.count}
              </span>
              {group.userReacted && (
                <span style={{ 
                  fontSize: 10, 
                  marginLeft: 2, 
                  color: 'var(--accent)',
                  fontWeight: 700 
                }}>✓</span>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Reaction Picker on Hover - Always show on hover */}
      {showReactionPicker && (
        <div 
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 8,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '6px 8px',
            display: 'flex',
            gap: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000
          }}
          onMouseEnter={handlePickerMouseEnter}
          onMouseLeave={handlePickerMouseLeave}
        >
          {availableReactions.map(emoji => {
            const hasReacted = groupedReactions[emoji]?.userReacted || false;
            return (
              <button
                key={emoji}
                onClick={() => handleReactionClick(emoji)}
                style={{
                  fontSize: 18,
                  padding: '4px',
                  border: hasReacted ? '1px solid var(--accent)' : '1px solid transparent',
                  borderRadius: '50%',
                  background: hasReacted ? 'var(--accent-dim)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.2)';
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.background = hasReacted ? 'var(--accent-dim)' : 'transparent';
                }}
                title={hasReacted ? 'Remove reaction' : `React with ${emoji}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Content with Mentions ─────────────────────────────────── */
function renderContentWithMentions(content) {
  if (!content) return content;
  
  const mentionRegex = /@(\w+)/g;
  const parts = content.split(mentionRegex);
  
  return parts.map((part, index) => {
    // Check if this part is a mention (odd index parts are mentions)
    if (index % 2 === 1 && part) {
      return (
        <span 
          key={index} 
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            padding: '2px 6px',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: '0.95em',
            display: 'inline-block',
            margin: '0 2px',
            boxShadow: '0 1px 3px rgba(239, 68, 68, 0.2)'
          }}
        >
          @{part}
        </span>
      );
    }
    return part;
  });
}

/* ── Main ──────────────────────────────────────────────────── */
export default function ChatMessages({group,onTaskClick}){
  const {user}=useAuth();
  const {on,joinGroup,markSeen,sendTyping}=useSocket();
  const [messages,setMessages]=useState([]);
  const [loading,setLoading]=useState(true);
  const [page,setPage]=useState(1);
  const [hasMore,setHasMore]=useState(false);
  const [inputText,setInputText]=useState('');
  const [sending,setSending]=useState(false);
  const [replyTo,setReplyTo]=useState(null);
  const [typingUsers,setTypingUsers]=useState([]);
  const [isRecording,setIsRecording]=useState(false);
  const [showTaskPopup,setShowTaskPopup]=useState(false);
  const [users, setUsers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionRange, setMentionRange] = useState({ start: 0, end: 0 });

  const bottomRef=useRef(null);
  const fileRef=useRef(null);
  const typingTmr=useRef(null);
  const mediaRec=useRef(null);
  const audioChunks=useRef([]);
  const textareaRef=useRef(null);
  const groupIdRef=useRef(null);
  const msRef=useRef(markSeen);
  useEffect(()=>{groupIdRef.current=group?.id?Number(group.id):null;},[group?.id]);
  useEffect(()=>{msRef.current=markSeen;},[markSeen]);
  useEffect(() => {
    authAPI.getUsers().then(d => setUsers(d.users || []));
  }, []);

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

  const insertMention = useCallback((selectedUser) => {
    const text = inputText;
    const beforeMention = text.slice(0, mentionRange.start);
    const afterMention = text.slice(mentionRange.end);
    
    const mentionText = `@${selectedUser.full_name.replace(/\s+/g, '')}`;
    const newText = beforeMention + mentionText + ' ' + afterMention;
    
    setInputText(newText);
    setShowMentions(false);
    setMentionQuery('');
    
    // Set cursor position after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionRange.start + mentionText.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  },[inputText, mentionRange]);

  useEffect(()=>{
    if(!group)return;
    setMessages([]);setPage(1);load(1);joinGroup(group.id);
  },[group?.id]);// eslint-disable-line

  const handleDeleteMessage=useCallback((messageId)=>{
    setMessages(prev=>prev.filter(msg=>msg.id!==messageId));
  },[]);

  const handleNewMsg=useCallback((msg)=>{
    if(Number(msg.group_id)!==groupIdRef.current)return;
    setMessages(prev=>{if(prev.some(m=>m.id===msg.id))return prev;return[...prev,msg];});
    msRef.current?.(msg.id,msg.group_id);
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),60);
  },[]);

  const handleReactionUpdate=useCallback((data)=>{
    console.log('Reaction update received:', data);
    console.log('Current group ID:', groupIdRef.current);
    console.log('Message ID from event:', data.message_id);
    
    if(Number(data.group_id)!==groupIdRef.current){
      console.log('Group ID mismatch, ignoring reaction update');
      return;
    }
    
    setMessages(prev=>{
      const updated = prev.map(msg=> {
        // Compare as numbers to ensure proper matching
        if(Number(msg.id) === Number(data.message_id)) {
          console.log('Updating reactions for message:', msg.id);
          console.log('Old reactions:', msg.reactions);
          console.log('New reactions:', data.reactions);
          return { ...msg, reactions: data.reactions };
        }
        return msg;
      });
      return updated;
    });
  },[]);

  const handleTypingEv=useCallback(({user_id,user_name,groupId,isTyping})=>{
    if(Number(groupId)!==groupIdRef.current)return;
    setTypingUsers(prev=>isTyping?[...prev.filter(u=>u.id!==user_id),{id:user_id,name:user_name}]:prev.filter(u=>u.id!==user_id));
  },[]);

  useEffect(()=>{
    const u1=on('new_message',handleNewMsg);
    const u2=on('user_typing',handleTypingEv);
    const u3=on('reaction_update',handleReactionUpdate);
    return()=>{u1?.();u2?.();u3?.();};
  },[on,handleNewMsg,handleTypingEv,handleReactionUpdate]);

  // Check for forwarded message on mount
  useEffect(() => {
    const forwardData = localStorage.getItem('forwardMessage');
    if (forwardData) {
      try {
        const parsed = JSON.parse(forwardData);
        setInputText(parsed.content || '');
        toast.success('Forwarded message ready to send');
        localStorage.removeItem('forwardMessage');
      } catch (error) {
        console.error('Error parsing forward data:', error);
      }
    }
  }, []);

  const filteredUsers = useMemo(() => {
    if (!mentionQuery) return [];
    return users.filter(u => 
      u.full_name.toLowerCase().includes(mentionQuery.toLowerCase()) &&
      u.id !== user?.id
    ).slice(0, 8);
  }, [mentionQuery, users, user]);

  const detectMention = useCallback((text, cursorPos) => {
    const beforeCursor = text.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    
    if (atMatch) {
      const start = cursorPos - atMatch[0].length;
      return {
        isMention: true,
        query: atMatch[1],
        range: { start, end: cursorPos }
      };
    }
    return { isMention: false, query: '', range: { start: 0, end: 0 } };
  }, []);

  const send=async()=>{
    if(!inputText.trim()||sending)return;
    const txt=inputText.trim();setInputText('');setSending(true);
    clearTimeout(typingTmr.current);sendTyping(group.id,false);
    try{
      const data=await messagesAPI.sendMessage(group.id,{content:txt,reply_to_id:replyTo?.id||null});
      setMessages(prev=>prev.some(m=>m.id===data.message.id)?prev:[...prev,data.message]);
      setReplyTo(null);bottomRef.current?.scrollIntoView({behavior:'smooth'});
    }catch{toast.error('Failed to send');setInputText(txt);}
    setSending(false);
  };

  const onKey=useCallback(e=>{
    if (e.key === 'Enter' && !e.shiftKey) {
      if (showMentions && filteredUsers[mentionIndex]) {
        e.preventDefault();
        insertMention(filteredUsers[mentionIndex]);
      } else {
        e.preventDefault();
        send();
      }
    } else if (e.key === 'Escape' && showMentions) {
      e.preventDefault();
      setShowMentions(false);
      setMentionQuery('');
    } else if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => prev === 0 ? filteredUsers.length - 1 : prev - 1);
      }
    }
  },[showMentions, mentionIndex, filteredUsers, send, insertMention]);
  const onInput=useCallback(e=>{
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;
    const mention = detectMention(text, cursorPos);
    
    setInputText(text);
    sendTyping(group.id,true);
    clearTimeout(typingTmr.current);typingTmr.current=setTimeout(()=>sendTyping(group.id,false),2000);
    
    if (mention.isMention) {
      setMentionQuery(mention.query);
      setMentionRange(mention.range);
      setShowMentions(true);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  },[detectMention, group.id, sendTyping]);

  const uploadFile=async e=>{
    const files=Array.from(e.target.files);
    if(!files.length)return;
    
    // Check total size (max 50MB per file, but we'll allow multiple files up to 100MB total)
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if(totalSize > 104857600){ // 100MB total
      toast.error('Total files size must be less than 100 MB');
      return;
    }
    
    // Check individual file sizes
    const oversizedFiles = files.filter(file => file.size > 52428800); // 50MB per file
    if(oversizedFiles.length > 0){
      toast.error('Each file must be less than 50 MB');
      return;
    }
    
    // Upload files one by one
    const uploadPromises = files.map(async (file) => {
      const fd = new FormData();
      fd.append('file', file);
      
      try {
        const data = await messagesAPI.uploadFile(group.id, fd);
        return { success: true, message: data.message, file };
      } catch (error) {
        return { success: false, error, file };
      }
    });
    
    // Show loading toast
    const fileNames = files.map(f => f.name).join(', ');
    const tid = toast.loading(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`);
    
    try {
      const results = await Promise.all(uploadPromises);
      
      // Separate successful and failed uploads
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      // Add successful messages to chat
      if (successful.length > 0) {
        const newMessages = successful.map(r => r.message);
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
          return [...prev, ...uniqueNewMessages];
        });
        bottomRef.current?.scrollIntoView({behavior: 'smooth'});
      }
      
      // Show appropriate toast message
      if (failed.length === 0) {
        toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded successfully!`, { id: tid });
      } else if (successful.length === 0) {
        toast.error(`Failed to upload ${failed.length} file${failed.length > 1 ? 's' : ''}`, { id: tid });
      } else {
        toast.success(`${successful.length} of ${files.length} files uploaded successfully`, { id: tid });
      }
      
    } catch (error) {
      toast.error('Upload failed', { id: tid });
    }
    
    // Clear input
    e.target.value = '';
  };

  const startRec=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      audioChunks.current=[];
      mediaRec.current=new MediaRecorder(stream);
      mediaRec.current.ondataavailable=e=>audioChunks.current.push(e.data);
      mediaRec.current.onstop=async()=>{
        const blob=new Blob(audioChunks.current,{type:'audio/webm'});
        const fd=new FormData();fd.append('file',blob,`voice_${Date.now()}.webm`);
        const tid=toast.loading('Sending voice…');
        try{const data=await messagesAPI.uploadFile(group.id,fd);setMessages(prev=>[...prev,data.message]);bottomRef.current?.scrollIntoView({behavior:'smooth'});toast.success('Sent!',{id:tid});}
        catch{toast.error('Failed',{id:tid});}
        stream.getTracks().forEach(t=>t.stop());
      };
      mediaRec.current.start();setIsRecording(true);
    }catch{toast.error('Mic denied');}
  };
  const stopRec=()=>{mediaRec.current?.stop();setIsRecording(false);};

  const grouped=messages.reduce((acc,msg,i)=>{
    const prev=messages[i-1];
    acc.push({...msg,showDate:!prev||!isSameDay(new Date(prev.sent_at),new Date(msg.sent_at)),showAvatar:!prev||prev.sender_id!==msg.sender_id||!isSameDay(new Date(prev?.sent_at),new Date(msg.sent_at))});
    return acc;
  },[]);

  if(!group)return(<div className="empty-state" style={{flex:1}}><div className="empty-state-icon">💬</div><p>Select a group</p></div>);

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

      {/* ── Input area — position:relative so popup anchors to it ── */}
      <div className="input-area" style={{position:'relative'}}>

        {/* Task popup sits directly above the input bar, chat messages remain visible */}
        {showTaskPopup && (
          <TaskQuickPopup
            group={group}
            onClose={() => setShowTaskPopup(false)}
          />
        )}

        {/* Mention dropdown */}
        {showMentions && (
          <MentionDropdown
            users={filteredUsers}
            query={mentionQuery}
            selectedIndex={mentionIndex}
            onSelect={(index) => setMentionIndex(index)}
            onUserSelect={(user) => insertMention(user)}
            onClose={() => {
              setShowMentions(false);
              setMentionQuery('');
            }}
          />
        )}

        {replyTo&&(
          <div className="reply-preview">
            <span>↩ <strong>{replyTo.sender_name}:</strong> {replyTo.content?.slice(0,60)}</span>
            <button className="btn-icon" style={{padding:4}} onClick={()=>setReplyTo(null)}>✕</button>
          </div>
        )}
        {isRecording?(
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:'var(--radius-xl)'}}>
            <span style={{fontSize:13,color:'#ef4444',fontWeight:600}}>🔴 Recording…</span>
            <button className="btn btn-danger btn-sm" onClick={stopRec}>Stop &amp; Send</button>
          </div>
        ):(
          <div className="input-container">
            <textarea 
              ref={textareaRef}
              className="message-input"
              placeholder={`Message ${group.group_name}…`}
              value={inputText} 
              onChange={onInput} 
              onKeyDown={onKey}
              rows={1} 
              style={{height:'auto'}}
              onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';}}
            />
            <div className="input-actions">
              <input ref={fileRef} type="file" style={{display:'none'}} onChange={uploadFile}
                multiple
                accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"/>

              {/* Task — first, before attach */}
              <button className="btn-icon" onClick={()=>setShowTaskPopup(p=>!p)} title="Create task"
                style={{color:showTaskPopup?'var(--accent)':'inherit'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
              </button>

              {/* Attach file */}
              <button className="btn-icon" onClick={()=>fileRef.current?.click()} title="Attach file">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>

              {/* Voice */}
              <button className="btn-icon" onClick={startRec} title="Voice note">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                </svg>
              </button>

              {/* Send */}
              <button className="btn btn-primary" style={{padding:'8px 14px',borderRadius:'var(--radius-lg)'}}
                onClick={send} disabled={!inputText.trim()||sending}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
