// import React, { useState, useEffect, useRef } from 'react';
// import { messagesAPI } from '../../utils/api';
// import { useAuth } from '../../context/AuthContext';
// import { useSocket } from '../../context/SocketContext';
// import toast from 'react-hot-toast';
// import TaskQuickPopup from '../Tasks/TaskQuickPopup';
// import './MessageSender.css';

// const MessageSender = ({ 
//   groupId, 
//   onMessageSent, 
//   currentUser,
//   replyTo = null,
//   onReplyCancel = null 
// }) => {
//   const { user } = useAuth();
//   const { on } = useSocket();
  
//   const [content, setContent] = useState('');
//   const [recipientId, setRecipientId] = useState(''); // 🔄 Back to single recipient
//   const [secondaryRecipientId, setSecondaryRecipientId] = useState('');
//   const [recipients, setRecipients] = useState([]);
//   const [assignmentInfo, setAssignmentInfo] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [loadingRecipients, setLoadingRecipients] = useState(false);
//   const [showSecondaryOption, setShowSecondaryOption] = useState(false);
  
//   // 🆕 Existing feature states
//   const [showTaskPopup, setShowTaskPopup] = useState(false);
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [isRecording, setIsRecording] = useState(false);
//   const fileInputRef = useRef(null);

//   // 📋 Load available recipients
//   useEffect(() => {
//     if (groupId) {
//       loadRecipients();
//     }
//   }, [groupId]);

//   // Listen for member updates (when members are added to group)
//   useEffect(() => {
//     const unsub = on('member_added', (data) => {
//       // Only handle member updates for current group
//       if (Number(data.group_id) === groupId) {
//         // Reload recipients to update the dropdown
//         loadRecipients();
//       }
//     });
//     return unsub;
//   }, [on, groupId]);

//   // Listen for member removal updates (when members are removed from group)
//   useEffect(() => {
//     const unsub = on('member_removed', (data) => {
//       // Only handle member updates for current group
//       if (Number(data.group_id) === groupId) {
//         // Reload recipients to update the dropdown
//         loadRecipients();
//       }
//     });
//     return unsub;
//   }, [on, groupId]);

//   // 🔍 Load assignment info when recipient is selected
//   useEffect(() => {
//     if (recipientId && recipientId !== '') {
//       loadAssignmentInfo(recipientId);
//     } else {
//       setAssignmentInfo(null);
//       setSecondaryRecipientId('');
//       setShowSecondaryOption(false);
//     }
//   }, [recipientId]);

//   const loadRecipients = async () => {
//     setLoadingRecipients(true);
//     try {
//       const data = await messagesAPI.getRecipients(groupId);
//       setRecipients(data.recipients || []);
//     } catch (error) {
//     } finally {
//       setLoadingRecipients(false);
//     }
//   };

//   const loadAssignmentInfo = async (recipientId) => {
//     try {
//       const info = await messagesAPI.getAssignmentInfo(groupId, recipientId);
//       setAssignmentInfo(info);
//       setShowSecondaryOption(info.isAssigned && info.secondaryUsers.length > 0);
//     } catch (error) {
//       setAssignmentInfo(null);
//       setShowSecondaryOption(false);
//     }
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
    
//     try {
//       // 🔒 CORE RULE: Validate recipient selection
//       if (!recipientId) {
//         alert('Please select a recipient before sending message.');
//         return;
//       }
      
//       if (typeof content === 'undefined') {
//         alert('Please enter a message.');
//         return;
//       }
      
//       if (!content || !content.trim()) {
//         alert('Please enter a message.');
//         return;
//       }


//       setLoading(true);
      
//       const messageData = {
//         content: content.trim(),
//         recipient_id: parseInt(recipientId),
//         secondary_recipient_id: secondaryRecipientId ? parseInt(secondaryRecipientId) : null,
//         reply_to_id: replyTo?.id || null
//       };

//       const response = await messagesAPI.sendMessage(groupId, messageData);
      
//       // 🎯 Reset form
//       setContent('');
//       setRecipientId('');
//       setSecondaryRecipientId('');
//       setShowSecondaryOption(false);
//       setAssignmentInfo(null);
      
//       // 🔄 Notify parent
//       if (onMessageSent) {
//         onMessageSent(response.message);
//       }

//       // 🔄 Cancel reply if active
//       if (onReplyCancel) {
//         onReplyCancel();
//       }

//     } catch (error) {
//       alert(error?.error || 'Failed to send message');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleReplyCancel = () => {
//     if (onReplyCancel) {
//       onReplyCancel();
//     }
//   };

//   // 🆕 Enhanced feature handlers
//   const handleFileSelect = (e) => {
//     const file = e.target.files[0];
//     if (file) {
//       // Validate file size (10MB limit)
//       const maxSize = 10 * 1024 * 1024; // 10MB
//       if (file.size > maxSize) {
//         toast.error('File size must be less than 10MB');
//         return;
//       }

//       // Validate file type
//       const allowedTypes = [
//         'image/jpeg', 'image/png', 'image/gif', 'image/webp',
//         'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg',
//         'video/mp4', 'video/webm', 'video/ogg',
//         'application/pdf', 
//         'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//         'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
//         'application/zip', 'application/x-zip-compressed'
//       ];

//       if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/') && !file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
//         toast.error('File type not supported');
//         return;
//       }

//       setSelectedFile(file);
//       // Auto-send file message
//       handleFileUpload(file);
//     }
    
//     // Reset file input
//     if (fileInputRef.current) {
//       fileInputRef.current.value = '';
//     }
//   };

//   const handleFileUpload = async (file) => {
//     if (!file || !recipientId) {
//       toast.error('Please select a recipient before uploading a file.');
//       return;
//     }

//     const formData = new FormData();
//     formData.append('file', file);
//     formData.append('recipient_id', recipientId);
//     formData.append('secondary_recipient_id', secondaryRecipientId || '');
//     formData.append('caption', file.name); // Use filename as caption

//     try {
//       setLoading(true);
//       toast.loading('Uploading file...', { id: 'file-upload' });
      
//       const response = await messagesAPI.uploadFile(groupId, formData);
      
//       // Reset form
//       setContent('');
//       setRecipientId('');
//       setSecondaryRecipientId('');
//       setSelectedFile(null);
//       setShowSecondaryOption(false);
//       setAssignmentInfo(null);
      
//       // Notify parent
//       if (onMessageSent) {
//         onMessageSent(response.message);
//       }

//       // Cancel reply if active
//       if (replyTo && onReplyCancel) {
//         onReplyCancel();
//       }

//       toast.success(`${file.name} uploaded successfully!`, { id: 'file-upload' });
//     } catch (error) {
//       const errorMessage = error.error || 'Failed to upload file';
//       toast.error(errorMessage, { id: 'file-upload' });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleTaskClick = () => {
//     setShowTaskPopup(true);
//   };

//   const handleTaskCreated = (task) => {
//     setShowTaskPopup(false);
//     // Task message will be sent via socket
//     toast.success('Task created successfully!');
//   };

//   const handleVoiceRecord = () => {
//     if (isRecording) {
//       // Stop recording
//       setIsRecording(false);
//       toast.success('Voice recording stopped!');
//     } else {
//       // Start recording
//       setIsRecording(true);
//       toast.success('Voice recording started...');
//       // TODO: Implement actual voice recording logic
//     }
//   };

//   return (
//     <div className="message-sender">
//       {/* 📝 Reply To Indicator */}
//       {replyTo && (
//         <div className="reply-to-indicator">
//           <div className="reply-info">
//             <span className="reply-label">Replying to</span>
//             <span className="reply-content">{replyTo.content}</span>
//             <span className="reply-author">- {replyTo.sender_name}</span>
//           </div>
//           <button type="button" className="reply-cancel" onClick={handleReplyCancel}>
//             ✕
//           </button>
//         </div>
//       )}

//       <form onSubmit={handleSubmit} className="message-form">
//         {/* � Compact Recipient Selection */}
//         <div className="input-row">
//           <div className="recipient-selector">
//             <select
//               className="recipient-dropdown"
//               value={recipientId}
//               onChange={(e) => setRecipientId(e.target.value)}
//               required
//               disabled={loadingRecipients}
//             >
//               <option value="">To: *</option>
//               {loadingRecipients ? (
//                 <option disabled>Loading...</option>
//               ) : (
//                 recipients.map((recipient) => (
//                   <option key={recipient.user_id} value={recipient.user_id}>
//                     {recipient.full_name}
//                   </option>
//                 ))
//               )}
//             </select>
//           </div>

//           {/* 🔗 Secondary Recipient (Manager) */}
//           {showSecondaryOption && assignmentInfo?.secondaryUsers?.length > 0 && (
//             <div className="secondary-selector">
//               <select
//                 className="secondary-dropdown"
//                 value={secondaryRecipientId}
//                 onChange={(e) => setSecondaryRecipientId(e.target.value)}
//               >
//                 <option value="">CC: Manager</option>
//                 {assignmentInfo.secondaryUsers.map((user) => (
//                   <option key={user.id} value={user.id}>
//                     {user.full_name} ({user.readable_role || user.role})
//                   </option>
//                 ))}
//               </select>
//             </div>
//           )}
//         </div>

//         {/* 📱 Modern Input Row */}
//         <div className="input-row">
//           <div className="input-container">
//             <textarea
//               className="message-input"
//               value={content}
//               onChange={(e) => setContent(e.target.value)}
//               placeholder="Type a message..."
//               rows={1}
//               required
//               onKeyPress={(e) => {
//                 if (e.key === 'Enter' && !e.shiftKey) {
//                   e.preventDefault();
//                   handleSubmit(e);
//                 }
//               }}
//             />
            
//             {/* 🎯 Action Buttons */}
//             <div className="action-buttons">
//               <button type="button" className="action-btn attachment-btn" title="Attach file" onClick={() => fileInputRef.current?.click()}>
//                 📎
//               </button>
//               {/* <button type="button" className={`action-btn voice-btn ${isRecording ? 'recording' : ''}`} title="Voice message" onClick={handleVoiceRecord}>
//                 🎤
//               </button> */}
//               <button type="button" className="action-btn task-btn" title="Create task" onClick={handleTaskClick}>
//                 ✅
//               </button>
//             </div>
            
//             {/* Hidden file input */}
//             <input
//               ref={fileInputRef}
//               type="file"
//               style={{ display: 'none' }}
//               onChange={handleFileSelect}
//               accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.csv,.ppt,.pptx"
//             />
//           </div>

//           {/* 🚀 Send Button */}
//           <button
//             type="submit"
//             className="send-btn"
//             disabled={loading || !recipientId || !content.trim()}
//           >
//             {loading ? (
//               <div className="loading-dots">
//                 <span></span>
//                 <span></span>
//                 <span></span>
//               </div>
//             ) : (
//               <span>➤</span>
//             )}
//           </button>
//         </div>
//       </form>
      
//       {/* 📋 Task Popup */}
//       {showTaskPopup && (
//         <TaskQuickPopup
//           group={{ id: groupId }}
//           onClose={() => setShowTaskPopup(false)}
//         />
//       )}
//     </div>
//   );
// };

// export default MessageSender;

// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { messagesAPI } from '../../utils/api';
// import { useAuth } from '../../context/AuthContext';
// import { useSocket } from '../../context/SocketContext';
// import toast from 'react-hot-toast';
// import TaskQuickPopup from '../Tasks/TaskQuickPopup';
// import './MessageSender.css';

// const MessageSender = ({ 
//   groupId, 
//   onMessageSent, 
//   currentUser,
//   replyTo = null,
//   onReplyCancel = null 
// }) => {
//   const { user } = useAuth();
//   const { on } = useSocket();
  
//   const [content, setContent] = useState('');
//   const [recipientId, setRecipientId] = useState('');
//   const [secondaryRecipientId, setSecondaryRecipientId] = useState('');
//   const [recipients, setRecipients] = useState([]);
//   const [assignmentInfo, setAssignmentInfo] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [loadingRecipients, setLoadingRecipients] = useState(false);
//   const [showSecondaryOption, setShowSecondaryOption] = useState(false);
  
//   const [showTaskPopup, setShowTaskPopup] = useState(false);
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [isRecording, setIsRecording] = useState(false);
//   const fileInputRef = useRef(null);

//   // FIX: cache recipients per groupId so socket events (member_added/removed)
//   // don't trigger a fresh network request every time. Recipients for the same
//   // group are stable between events — we only need to refetch when membership
//   // actually changes, and we debounce that to avoid N rapid refetches.
//   const recipientCacheRef = useRef({});   // { [groupId]: recipients[] }
//   const reloadTimerRef    = useRef(null); // debounce handle

//   const loadRecipients = useCallback(async (skipCache = false) => {
//     if (!groupId) return;
//     // Serve from cache unless caller explicitly wants a fresh fetch
//     if (!skipCache && recipientCacheRef.current[groupId]) {
//       setRecipients(recipientCacheRef.current[groupId]);
//       return;
//     }
//     setLoadingRecipients(true);
//     try {
//       const data = await messagesAPI.getRecipients(groupId);
//       const list = data.recipients || [];
//       recipientCacheRef.current[groupId] = list; // cache result
//       setRecipients(list);
//     } catch (error) {
//       // silently fail — recipients dropdown will be empty, user can retry by
//       // switching groups. Don't spam console or toast on every poll failure.
//     } finally {
//       setLoadingRecipients(false);
//     }
//   }, [groupId]);

//   // Load on group change — always fresh
//   useEffect(() => {
//     setRecipients([]);
//     setRecipientId('');
//     setAssignmentInfo(null);
//     loadRecipients(true);
//   }, [groupId]); // eslint-disable-line

//   // FIX: debounce socket-triggered reloads — member_added/removed can fire
//   // multiple times in quick succession (e.g. hierarchy expansion adds 5 users).
//   // Old code fired getRecipients on EVERY event, each hitting the CRM DB with
//   // 4-6 serial queries. Debounce to one refetch 1.5 s after the last event.
//   const scheduleReload = useCallback(() => {
//     if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
//     reloadTimerRef.current = setTimeout(() => {
//       delete recipientCacheRef.current[groupId]; // invalidate cache
//       loadRecipients(true);
//     }, 1500);
//   }, [groupId, loadRecipients]);

//   useEffect(() => {
//     const unsubAdded   = on('member_added',   (d) => { if (Number(d.group_id) === groupId) scheduleReload(); });
//     const unsubRemoved = on('member_removed', (d) => { if (Number(d.group_id) === groupId) scheduleReload(); });
//     return () => { unsubAdded(); unsubRemoved(); if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current); };
//   }, [on, groupId, scheduleReload]);

//   // Load assignment info when recipient is selected
//   useEffect(() => {
//     if (recipientId && recipientId !== '') {
//       loadAssignmentInfo(recipientId);
//     } else {
//       setAssignmentInfo(null);
//       setSecondaryRecipientId('');
//       setShowSecondaryOption(false);
//     }
//   }, [recipientId]);

//   const loadAssignmentInfo = async (recipientId) => {
//     try {
//       const info = await messagesAPI.getAssignmentInfo(groupId, recipientId);
//       setAssignmentInfo(info);
//       setShowSecondaryOption(info.isAssigned && info.secondaryUsers.length > 0);
//     } catch (error) {
//       setAssignmentInfo(null);
//       setShowSecondaryOption(false);
//     }
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
    
//     try {
//       // 🔒 CORE RULE: Validate recipient selection
//       if (!recipientId) {
//         alert('Please select a recipient before sending message.');
//         return;
//       }
      
//       if (typeof content === 'undefined') {
//         alert('Please enter a message.');
//         return;
//       }
      
//       if (!content || !content.trim()) {
//         alert('Please enter a message.');
//         return;
//       }


//       setLoading(true);
      
//       const messageData = {
//         content: content.trim(),
//         recipient_id: parseInt(recipientId),
//         secondary_recipient_id: secondaryRecipientId ? parseInt(secondaryRecipientId) : null,
//         reply_to_id: replyTo?.id || null
//       };

//       const response = await messagesAPI.sendMessage(groupId, messageData);
      
//       // 🎯 Reset form
//       setContent('');
//       setRecipientId('');
//       setSecondaryRecipientId('');
//       setShowSecondaryOption(false);
//       setAssignmentInfo(null);
      
//       // 🔄 Notify parent
//       if (onMessageSent) {
//         onMessageSent(response.message);
//       }

//       // 🔄 Cancel reply if active
//       if (onReplyCancel) {
//         onReplyCancel();
//       }

//     } catch (error) {
//       alert(error?.error || 'Failed to send message');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleReplyCancel = () => {
//     if (onReplyCancel) {
//       onReplyCancel();
//     }
//   };

//   // 🆕 Enhanced feature handlers
//   const handleFileSelect = (e) => {
//     const file = e.target.files[0];
//     if (file) {
//       // Validate file size (10MB limit)
//       const maxSize = 10 * 1024 * 1024; // 10MB
//       if (file.size > maxSize) {
//         toast.error('File size must be less than 10MB');
//         return;
//       }

//       // Validate file type
//       const allowedTypes = [
//         'image/jpeg', 'image/png', 'image/gif', 'image/webp',
//         'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg',
//         'video/mp4', 'video/webm', 'video/ogg',
//         'application/pdf', 
//         'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//         'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
//         'application/zip', 'application/x-zip-compressed',
//           'text/csv',                     // ← ADD THIS
//   'application/csv'  
//       ];

//       if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/') && !file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
//         toast.error('File type not supported');
//         return;
//       }

//       setSelectedFile(file);
//       // Auto-send file message
//       handleFileUpload(file);
//     }
    
//     // Reset file input
//     if (fileInputRef.current) {
//       fileInputRef.current.value = '';
//     }
//   };

//   const handleFileUpload = async (file) => {
//     if (!file || !recipientId) {
//       toast.error('Please select a recipient before uploading a file.');
//       return;
//     }

//     const formData = new FormData();
//     formData.append('file', file);
//     formData.append('recipient_id', recipientId);
//     formData.append('secondary_recipient_id', secondaryRecipientId || '');
//     formData.append('caption', file.name); // Use filename as caption

//     try {
//       setLoading(true);
//       toast.loading('Uploading file...', { id: 'file-upload' });
      
//       const response = await messagesAPI.uploadFile(groupId, formData);
      
//       // Reset form
//       setContent('');
//       setRecipientId('');
//       setSecondaryRecipientId('');
//       setSelectedFile(null);
//       setShowSecondaryOption(false);
//       setAssignmentInfo(null);
      
//       // Notify parent
//       if (onMessageSent) {
//         onMessageSent(response.message);
//       }

//       // Cancel reply if active
//       if (replyTo && onReplyCancel) {
//         onReplyCancel();
//       }

//       toast.success(`${file.name} uploaded successfully!`, { id: 'file-upload' });
//     } catch (error) {
//       const errorMessage = error.error || 'Failed to upload file';
//       toast.error(errorMessage, { id: 'file-upload' });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleTaskClick = () => {
//     setShowTaskPopup(true);
//   };

//   const handleTaskCreated = (task) => {
//     setShowTaskPopup(false);
//     // Task message will be sent via socket
//     toast.success('Task created successfully!');
//   };

//   const handleVoiceRecord = () => {
//     if (isRecording) {
//       // Stop recording
//       setIsRecording(false);
//       toast.success('Voice recording stopped!');
//     } else {
//       // Start recording
//       setIsRecording(true);
//       toast.success('Voice recording started...');
//       // TODO: Implement actual voice recording logic
//     }
//   };

//   return (
//     <div className="message-sender">
//       {/* 📝 Reply To Indicator */}
//       {replyTo && (
//         <div className="reply-to-indicator">
//           <div className="reply-info">
//             <span className="reply-label">Replying to</span>
//             <span className="reply-content">{replyTo.content}</span>
//             <span className="reply-author">- {replyTo.sender_name}</span>
//           </div>
//           <button type="button" className="reply-cancel" onClick={handleReplyCancel}>
//             ✕
//           </button>
//         </div>
//       )}

//       <form onSubmit={handleSubmit} className="message-form">
//         {/* � Compact Recipient Selection */}
//         <div className="input-row">
//           <div className="recipient-selector">
//             <select
//               className="recipient-dropdown"
//               value={recipientId}
//               onChange={(e) => setRecipientId(e.target.value)}
//               required
//               disabled={loadingRecipients}
//             >
//               <option value="">To: *</option>
//               {loadingRecipients ? (
//                 <option disabled>Loading...</option>
//               ) : (
//                 recipients.map((recipient) => (
//                   <option key={recipient.user_id} value={recipient.user_id}>
//                     {recipient.full_name}
//                   </option>
//                 ))
//               )}
//             </select>
//           </div>

//           {/* 🔗 Secondary Recipient (Manager) */}
//           {showSecondaryOption && assignmentInfo?.secondaryUsers?.length > 0 && (
//             <div className="secondary-selector">
//               <select
//                 className="secondary-dropdown"
//                 value={secondaryRecipientId}
//                 onChange={(e) => setSecondaryRecipientId(e.target.value)}
//               >
//                 <option value="">CC: Manager</option>
//                 {assignmentInfo.secondaryUsers.map((user) => (
//                   <option key={user.id} value={user.id}>
//                     {user.full_name} ({user.readable_role || user.role})
//                   </option>
//                 ))}
//               </select>
//             </div>
//           )}
//         </div>

//         {/* 📱 Modern Input Row */}
//         <div className="input-row">
//           <div className="input-container">
//             <textarea
//               className="message-input"
//               value={content}
//               onChange={(e) => setContent(e.target.value)}
//               placeholder="Type a message..."
//               rows={1}
//               required
//               onKeyPress={(e) => {
//                 if (e.key === 'Enter' && !e.shiftKey) {
//                   e.preventDefault();
//                   handleSubmit(e);
//                 }
//               }}
//             />
            
//             {/* 🎯 Action Buttons */}
//             <div className="action-buttons">
//               <button type="button" className="action-btn attachment-btn" title="Attach file" onClick={() => fileInputRef.current?.click()}>
//                 📎
//               </button>
//               {/* <button type="button" className={`action-btn voice-btn ${isRecording ? 'recording' : ''}`} title="Voice message" onClick={handleVoiceRecord}>
//                 🎤
//               </button> */}
//               {/* <button type="button" className="action-btn task-btn" title="Create task" onClick={handleTaskClick}>
//                 ✅
//               </button> */}
//             </div>
            
//             {/* Hidden file input */}
//             <input
//               ref={fileInputRef}
//               type="file"
//               style={{ display: 'none' }}
//               onChange={handleFileSelect}
//               accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.csv,.ppt,.pptx"
//             />
//           </div>

//           {/* 🚀 Send Button */}
//           <button
//             type="submit"
//             className="send-btn"
//             disabled={loading || !recipientId || !content.trim()}
//           >
//             {loading ? (
//               <div className="loading-dots">
//                 <span></span>
//                 <span></span>
//                 <span></span>
//               </div>
//             ) : (
//               <span>➤</span>
//             )}
//           </button>
//         </div>
//       </form>
      
//       {/* 📋 Task Popup */}
//       {showTaskPopup && (
//         <TaskQuickPopup
//           group={{ id: groupId }}
//           onClose={() => setShowTaskPopup(false)}
//         />
//       )}
//     </div>
//   );
// };

// export default MessageSender;



import React, { useState, useEffect, useRef, useCallback } from 'react';
import { messagesAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';
import TaskQuickPopup from '../Tasks/TaskQuickPopup';
import './MessageSender.css';

const MessageSender = ({ 
  groupId, 
  onMessageSent, 
  currentUser,
  replyTo = null,
  onReplyCancel = null 
}) => {
  const { user } = useAuth();
  const { on } = useSocket();
  
  const [content, setContent] = useState('');

  // ── NEW: multi-select replaces single recipientId ──────────
  // selectedIds  : number[]  — user_ids currently checked
  // dropdownOpen : bool      — controls the checkbox dropdown
  const [selectedIds, setSelectedIds] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // ── kept for legacy assignment-info panel (CC: Manager) ───
  const [secondaryRecipientId, setSecondaryRecipientId] = useState('');
  const [assignmentInfo, setAssignmentInfo] = useState(null);
  const [showSecondaryOption, setShowSecondaryOption] = useState(false);

  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);
  const dropdownRef  = useRef(null);

  // ── recipient cache / debounce (unchanged from original) ───
  const recipientCacheRef = useRef({});
  const reloadTimerRef    = useRef(null);

  const loadRecipients = useCallback(async (skipCache = false) => {
    if (!groupId) return;
    if (!skipCache && recipientCacheRef.current[groupId]) {
      setRecipients(recipientCacheRef.current[groupId]);
      return;
    }
    setLoadingRecipients(true);
    try {
      const data = await messagesAPI.getRecipients(groupId);
      const list = data.recipients || [];
      recipientCacheRef.current[groupId] = list;
      setRecipients(list);
    } catch (_) {
      // silently fail
    } finally {
      setLoadingRecipients(false);
    }
  }, [groupId]);

  // Reset on group change — always fresh
  useEffect(() => {
    setRecipients([]);
    setSelectedIds([]);
    setSecondaryRecipientId('');
    setAssignmentInfo(null);
    setShowSecondaryOption(false);
    loadRecipients(true);
  }, [groupId]); // eslint-disable-line

  // Debounce socket-triggered reloads
  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      delete recipientCacheRef.current[groupId];
      loadRecipients(true);
    }, 1500);
  }, [groupId, loadRecipients]);

  useEffect(() => {
    const unsubAdded   = on('member_added',   (d) => { if (Number(d.group_id) === groupId) scheduleReload(); });
    const unsubRemoved = on('member_removed', (d) => { if (Number(d.group_id) === groupId) scheduleReload(); });
    return () => {
      unsubAdded();
      unsubRemoved();
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [on, groupId, scheduleReload]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Load assignment info when exactly ONE user selected ─────
  // (keeps the legacy CC: Manager panel working for single-user sends)
  useEffect(() => {
    if (selectedIds.length === 1) {
      loadAssignmentInfo(selectedIds[0]);
    } else {
      setAssignmentInfo(null);
      setSecondaryRecipientId('');
      setShowSecondaryOption(false);
    }
  }, [selectedIds]); // eslint-disable-line

  const loadAssignmentInfo = async (recipientId) => {
    try {
      const info = await messagesAPI.getAssignmentInfo(groupId, recipientId);
      setAssignmentInfo(info);
      setShowSecondaryOption(info.isAssigned && info.secondaryUsers.length > 0);
    } catch (_) {
      setAssignmentInfo(null);
      setShowSecondaryOption(false);
    }
  };

  // ── Multi-select helpers ────────────────────────────────────
  const allSelected = recipients.length > 0 && selectedIds.length === recipients.length;

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : recipients.map(r => r.user_id));
  };

  const toggleUser = (userId) => {
    setSelectedIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Pills shown inside the "To:" bar
  const selectionLabel = () => {
    if (selectedIds.length === 0) return null;
    if (allSelected) return <span className="recipient-tag all-tag">@all</span>;
    return recipients
      .filter(r => selectedIds.includes(r.user_id))
      .map(r => (
        <span key={r.user_id} className="recipient-tag">
          @{r.full_name.split(' ')[0]}
          <button
            type="button"
            className="tag-remove"
            onClick={(e) => { e.stopPropagation(); toggleUser(r.user_id); }}
          >×</button>
        </span>
      ));
  };

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedIds.length === 0) {
      alert('Please select at least one recipient before sending a message.');
      return;
    }
    if (typeof content === 'undefined' || !content || !content.trim()) {
      alert('Please enter a message.');
      return;
    }

    setLoading(true);
    
    try {
      const messageData = {
        content: content.trim(),
        // NEW: send arrays; backend inserts ONE row
        recipient_ids: selectedIds,
        is_broadcast:  allSelected,
        // Legacy CC field — only relevant when exactly 1 primary recipient chosen
        secondary_recipient_id: (selectedIds.length === 1 && secondaryRecipientId)
          ? parseInt(secondaryRecipientId)
          : null,
        reply_to_id: replyTo?.id || null,
      };

      const response = await messagesAPI.sendMessage(groupId, messageData);
      
      // Reset form
      setContent('');
      setSelectedIds([]);
      setSecondaryRecipientId('');
      setShowSecondaryOption(false);
      setAssignmentInfo(null);
      setDropdownOpen(false);
      
      if (onMessageSent) onMessageSent(response.message);
      if (onReplyCancel)  onReplyCancel();

    } catch (error) {
      alert(error?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleReplyCancel = () => {
    if (onReplyCancel) onReplyCancel();
  };

  // ── File handling (unchanged logic, updated recipient fields) ─
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('File size must be less than 10MB');
        return;
      }

      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg',
        'video/mp4', 'video/webm', 'video/ogg',
        'application/pdf', 
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip', 'application/x-zip-compressed',
        'text/csv', 'application/csv',
      ];

      if (
        !allowedTypes.includes(file.type) &&
        !file.type.startsWith('image/') &&
        !file.type.startsWith('audio/') &&
        !file.type.startsWith('video/')
      ) {
        toast.error('File type not supported');
        return;
      }

      setSelectedFile(file);
      handleFileUpload(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = async (file) => {
    if (!file || selectedIds.length === 0) {
      toast.error('Please select a recipient before uploading a file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    // NEW: send arrays instead of single id
    formData.append('recipient_ids', JSON.stringify(selectedIds));
    formData.append('is_broadcast', allSelected ? 'true' : 'false');
    // Legacy fallback — first selected id
    formData.append('recipient_id', selectedIds[0]);
    formData.append('secondary_recipient_id', secondaryRecipientId || '');
    formData.append('caption', file.name);

    try {
      setLoading(true);
      toast.loading('Uploading file...', { id: 'file-upload' });
      
      const response = await messagesAPI.uploadFile(groupId, formData);
      
      setContent('');
      setSelectedIds([]);
      setSecondaryRecipientId('');
      setSelectedFile(null);
      setShowSecondaryOption(false);
      setAssignmentInfo(null);
      
      if (onMessageSent) onMessageSent(response.message);
      if (replyTo && onReplyCancel) onReplyCancel();

      toast.success(`${file.name} uploaded successfully!`, { id: 'file-upload' });
    } catch (error) {
      const errorMessage = error.error || 'Failed to upload file';
      toast.error(errorMessage, { id: 'file-upload' });
    } finally {
      setLoading(false);
    }
  };

  // ── Unchanged original handlers ─────────────────────────────
  const handleTaskClick = () => {
    setShowTaskPopup(true);
  };

  const handleTaskCreated = (task) => {
    setShowTaskPopup(false);
    toast.success('Task created successfully!');
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      toast.success('Voice recording stopped!');
    } else {
      setIsRecording(true);
      toast.success('Voice recording started...');
    }
  };

  // Send button active only when recipients + content ready
  const canSend = selectedIds.length > 0 && content.trim().length > 0 && !loading;
const [search, setSearch] = useState("");
  return (
    <div className="message-sender">
      {/* Reply To Indicator — unchanged */}
      {replyTo && (
        <div className="reply-to-indicator">
          <div className="reply-info">
            <span className="reply-label">Replying to</span>
            <span className="reply-content">{replyTo.content}</span>
            <span className="reply-author">- {replyTo.sender_name}</span>
          </div>
          <button type="button" className="reply-cancel" onClick={handleReplyCancel}>
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="message-form">

        {/* ── NEW: Multi-select recipient row ── */}
        <div className="input-row recipient-row" ref={dropdownRef}>
          <div
            className={`recipient-selector multi${dropdownOpen ? ' open' : ''}`}
            onClick={() => setDropdownOpen(o => !o)}
          >
            <span className="to-label">To:</span>
            <div className="recipient-tags-area">
              {selectedIds.length === 0
                ? <span className="placeholder-text">
                    {loadingRecipients ? 'Loading…' : 'Select recipients *'}
                  </span>
                : selectionLabel()
              }
            </div>
            <span className="chevron">{dropdownOpen ? '▲' : '▼'}</span>
          </div>
{dropdownOpen && (
  <div
    className=""
    style={{
      position: "absolute",
      top: "calc(100% + 4px)",
      left: 0,
      right: 0,
      zIndex: 9999,
      background: "#1e1e2e",
      border: "1px solid #333",
      borderRadius: "10px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.45)",

      /* 🔥 FORCE SCROLL */
      maxHeight: "150px",
      overflowY: "auto",

      display: "block"   // ✅ IMPORTANT (overrides flex issues)
    }}
  >
    {/* 🔍 Search Input */}
    <div className="dropdown-search">
      <input
        type="text"
        placeholder="Search users..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
    </div>

    {/* @all option */}
    <label className={`recipient-option all-option${allSelected ? ' selected' : ''}`}>
      <input
        type="checkbox"
        checked={allSelected}
        onChange={toggleAll}
        onClick={e => e.stopPropagation()}
      />
      <span className="option-name">@all — Everyone</span>
      <span className="option-count">{recipients.length} members</span>
    </label>

    <div className="dropdown-divider" />

    {/* 👇 SCROLL AREA */}
    {/* <div className="dropdown-scroll"> */}
      {loadingRecipients ? (
        <div className="dropdown-loading">Loading recipients…</div>
      ) : (
        recipients
          .filter(r =>
            r.full_name.toLowerCase().includes(search.toLowerCase())
          )
          .map(r => (
            <label
              key={r.user_id}
              className={`recipient-option${selectedIds.includes(r.user_id) ? ' selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(r.user_id)}
                onChange={() => toggleUser(r.user_id)}
                onClick={e => e.stopPropagation()}
              />
              <span className="option-name">{r.full_name}</span>
              {r.role && <span className="option-role">{r.role}</span>}
            </label>
          ))
      )}
    {/* </div> */}
  </div>
)}
          {/* {dropdownOpen && (
            <div className="recipient-dropdown-list">
              <label className={`recipient-option all-option${allSelected ? ' selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  onClick={e => e.stopPropagation()}
                />
                <span className="option-name">@all — Everyone</span>
                <span className="option-count">{recipients.length} members</span>
              </label>

              <div className="dropdown-divider" />

              {loadingRecipients ? (
                <div className="dropdown-loading">Loading recipients…</div>
              ) : (
                recipients.map(r => (
                  <label
                    key={r.user_id}
                    className={`recipient-option${selectedIds.includes(r.user_id) ? ' selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(r.user_id)}
                      onChange={() => toggleUser(r.user_id)}
                      onClick={e => e.stopPropagation()}
                    />
                    <span className="option-name">{r.full_name}</span>
                    {r.role && <span className="option-role">{r.role}</span>}
                  </label>
                ))
              )}
            </div>
          )} */}
        </div>

        {/* ── Legacy CC: Manager row (shown only for single-user selections) ── */}
        {showSecondaryOption && assignmentInfo?.secondaryUsers?.length > 0 && selectedIds.length === 1 && (
          <div className="input-row">
            <div className="secondary-selector">
              <select
                className="secondary-dropdown"
                value={secondaryRecipientId}
                onChange={(e) => setSecondaryRecipientId(e.target.value)}
              >
                <option value="">CC: Manager</option>
                {assignmentInfo.secondaryUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.readable_role || u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Message input row (unchanged) ── */}
        <div className="input-row">
          <div className="input-container">
            <textarea
              className="message-input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type a message..."
              rows={1}
              required
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            
            {/* Action Buttons — unchanged */}
            <div className="action-buttons">
              <button
                type="button"
                className="action-btn attachment-btn"
                title="Attach file"
                onClick={() => fileInputRef.current?.click()}
              >
                📎
              </button>
              {/* Voice + Task buttons kept commented exactly as original */}
              {/* <button type="button" className={`action-btn voice-btn ${isRecording ? 'recording' : ''}`} title="Voice message" onClick={handleVoiceRecord}>
                🎤
              </button> */}
              {/* <button type="button" className="action-btn task-btn" title="Create task" onClick={handleTaskClick}>
                ✅
              </button> */}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.csv,.ppt,.pptx"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            className="send-btn"
            disabled={!canSend}
          >
            {loading ? (
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : (
              <span>➤</span>
            )}
          </button>
        </div>
      </form>
      
      {/* Task Popup — unchanged */}
      {showTaskPopup && (
        <TaskQuickPopup
          group={{ id: groupId }}
          onClose={() => setShowTaskPopup(false)}
        />
      )}
    </div>
  );
};

export default MessageSender;