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

// Same palette/initials logic as the avatar circles in ChatMessages.jsx, kept local
// since that file doesn't export them.
const MENTION_COLORS = ['#4f7dff','#a855f7','#22c55e','#f59e0b','#ef4444','#06b6d4'];
function ac(n=''){let h=0;for(const c of n)h=c.charCodeAt(0)+((h<<5)-h);return MENTION_COLORS[Math.abs(h)%MENTION_COLORS.length];}
function ini(n=''){return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}

// Pulls {name, uid} pairs out of any "@[Name](uid:123)" tokens already present in a string
// (e.g. a draft saved before this fix) and returns the display-safe text alongside them.
function extractMentions(text) {
  const mentions = [];
  const stripped = (text || '').replace(/@\[([^\]]+)\]\(uid:(\d+)\)/g, (_, name, uid) => {
    mentions.push({ name, uid });
    return `@${name}`;
  });
  return { stripped, mentions };
}

// Reverses extractMentions: restores the uid token for any mention name still present
// (in order) in the given text, so the id is only ever added back right before sending.
function rehydrateMentions(text, mentions) {
  let result = text;
  let searchFrom = 0;
  for (const { name, uid } of (mentions || [])) {
    const plain = `@${name}`;
    const idx = result.indexOf(plain, searchFrom);
    if (idx === -1) continue; // user deleted this mention while typing
    const token = `@[${name}](uid:${uid})`;
    result = result.slice(0, idx) + token + result.slice(idx + plain.length);
    searchFrom = idx + token.length;
  }
  return result;
}

const MessageSender = ({
  groupId,
  onMessageSent,
  currentUser,
  replyTo = null,
  onReplyCancel = null,
  dropBatch = null
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
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [search, setSearch] = useState('');

  // ── @mention autocomplete ──
  const [mentionQuery, setMentionQuery] = useState(null); // null = inactive; string = text typed after '@'
  const [mentionStart, setMentionStart] = useState(-1);   // index of '@' in `content`
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);

  const fileInputRef  = useRef(null);
  const dropdownRef   = useRef(null);
  const textareaRef   = useRef(null);
  const recipientCacheRef = useRef({});
  const reloadTimerRef    = useRef(null);

  // Always-fresh refs so group-change effect can read current values
  const contentRef     = useRef('');
  const selectedIdsRef = useRef([]);
  contentRef.current     = content;
  selectedIdsRef.current = selectedIds;

  // {name, uid} pairs for mentions currently typed into `content` (which itself only
  // ever holds display-safe "@Name" text — the uid is rehydrated right before sending).
  const mentionsRef = useRef([]);

  const prevGroupIdRef = useRef(null);
  // True once the restoration effect has run for the current group.
  // Prevents the save effect from clobbering localStorage before we've read it.
  const hasRestoredRef = useRef(false);

  // Always-fresh refs for beforeunload handler (closure would capture stale values)
  const userIdRef  = useRef(user?.id);
  const groupIdRef = useRef(groupId);
  userIdRef.current  = user?.id;
  groupIdRef.current = groupId;

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
    } catch (_) {}
    finally {
      setLoadingRecipients(false);
    }
  }, [groupId]);

  // Save draft whenever content or recipients change, but only after restoration
  // has run (hasRestoredRef guards against wiping localStorage on initial mount
  // before the draft has been read back).
  useEffect(() => {
    if (!groupId || !user?.id || !hasRestoredRef.current) return;
    const key = `chat_draft_${user.id}_${groupId}`;
    if (content.trim() || selectedIds.length > 0) {
      localStorage.setItem(key, JSON.stringify({ content, selectedIds, mentions: mentionsRef.current }));
    } else {
      localStorage.removeItem(key);
    }
    window.dispatchEvent(new CustomEvent('chat-draft-changed', { detail: { groupId } }));
  }, [content, selectedIds]); // eslint-disable-line

  // Group change: flush save for old group + reset UI only (no restoration here)
  useEffect(() => {
    hasRestoredRef.current = false; // arm guard for the incoming group
    if (prevGroupIdRef.current && user?.id) {
      const prevKey = `chat_draft_${user.id}_${prevGroupIdRef.current}`;
      // Only save — never delete. The save effect (with hasRestoredRef guard) owns
      // draft cleanup. Deleting here would wipe a valid draft when restoration
      // hasn't run yet (e.g. auth delayed, content still '').
      if (contentRef.current.trim() || selectedIdsRef.current.length > 0) {
        localStorage.setItem(prevKey, JSON.stringify({ content: contentRef.current, selectedIds: selectedIdsRef.current, mentions: mentionsRef.current }));
      }
      window.dispatchEvent(new CustomEvent('chat-draft-changed', { detail: { groupId: prevGroupIdRef.current } }));
    }
    prevGroupIdRef.current = groupId;

    setRecipients([]);
    setSecondaryRecipientId('');
    setAssignmentInfo(null);
    setShowSecondaryOption(false);
    setSearch('');
    setDropdownOpen(false);
    setMentionStart(-1);
    setMentionQuery(null);
    loadRecipients(true);
  }, [groupId]); // eslint-disable-line

  // Single restoration effect — handles both group switch AND hard refresh (auth delay)
  // Runs whenever groupId or user?.id changes, whichever comes last.
  // The cleanup resets hasRestoredRef so React StrictMode's double-invocation
  // can't fire the save effect with stale content before state commits.
  useEffect(() => {
    if (!user?.id || !groupId) return;
    const key = `chat_draft_${user.id}_${groupId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const { content: c, selectedIds: ids, mentions: m } = JSON.parse(raw);
        // Drafts saved before this fix still have the raw "@[Name](uid:1)" token baked
        // into `content` with no separate `mentions` field — extract it on the way in
        // so an old draft never displays a uid, and its mention isn't lost on send.
        const { stripped, mentions: legacyMentions } = extractMentions(c || '');
        setContent(stripped);
        setSelectedIds(Array.isArray(ids) ? ids : []);
        mentionsRef.current = Array.isArray(m) ? m : legacyMentions;
      } catch {
        setContent('');
        setSelectedIds([]);
        mentionsRef.current = [];
      }
    } else {
      setContent('');
      setSelectedIds([]);
      mentionsRef.current = [];
    }
    hasRestoredRef.current = true;
    return () => { hasRestoredRef.current = false; };
  }, [user?.id, groupId]); // eslint-disable-line

  // beforeunload is more reliable than React cleanup for hard-refresh / tab-close.
  // Uses refs so the handler always sees the latest content without re-registering.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!userIdRef.current || !groupIdRef.current) return;
      const key = `chat_draft_${userIdRef.current}_${groupIdRef.current}`;
      if (contentRef.current.trim() || selectedIdsRef.current.length > 0) {
        localStorage.setItem(key, JSON.stringify({
          content: contentRef.current,
          selectedIds: selectedIdsRef.current,
          mentions: mentionsRef.current,
        }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // eslint-disable-line

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

  // Consume files dropped from the parent chat area
  useEffect(() => {
    if (!dropBatch || !dropBatch.files || dropBatch.files.length === 0) return;
    const validFiles = dropBatch.files.filter(validateFile);
    if (validFiles.length > 0) setSelectedFiles(prev => [...prev, ...validFiles]);
  }, [dropBatch]); // eslint-disable-line

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

  const handleContentChange = (e) => {
    const value = e.target.value;
    setContent(value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';

    // Detect an active "@query" right before the cursor to drive mention autocomplete.
    const cursorPos = el.selectionStart;
    const uptoCursor = value.slice(0, cursorPos);
    const atIndex = uptoCursor.lastIndexOf('@');
    if (atIndex !== -1) {
      const between = uptoCursor.slice(atIndex + 1);
      // Bail if it's whitespace-broken (a fresh mention query has no spaces in it yet).
      if (!/\s/.test(between)) {
        setMentionStart(atIndex);
        setMentionQuery(between);
        setMentionActiveIndex(0);
        return;
      }
    }
    setMentionStart(-1);
    setMentionQuery(null);
  };

  const mentionSuggestions = mentionQuery !== null
    ? recipients.filter(r => r.full_name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : [];

  const insertMention = (member) => {
    if (mentionStart === -1) return;
    const cursorPos = textareaRef.current?.selectionStart ?? content.length;
    const before = content.slice(0, mentionStart);
    const after = content.slice(cursorPos);
    const token = `@${member.full_name} `;
    const newContent = before + token + after;
    setContent(newContent);
    mentionsRef.current = [...mentionsRef.current, { name: member.full_name, uid: member.user_id }];
    setMentionStart(-1);
    setMentionQuery(null);
    // @mentioning someone is interchangeable with checking them in the "To" list —
    // it satisfies the recipient requirement the same way, no separate checkbox needed.
    setSelectedIds(prev => prev.includes(member.user_id) ? prev : [...prev, member.user_id]);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = before.length + token.length;
      el.focus();
      el.setSelectionRange(pos, pos);
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    });
  };

  const handleTextareaKeyDown = (e) => {
    // Don't treat Enter as submit/select while an IME (Japanese/Chinese/Korean input)
    // is still composing a character — let it confirm the composition instead.
    if (e.key === 'Enter' && e.nativeEvent.isComposing) return;
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionActiveIndex(i => (i + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionActiveIndex(i => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionSuggestions[mentionActiveIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionStart(-1);
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const validateFile = (file) => {
    if (file.size > 150 * 1024 * 1024) {
      toast.error(`${file.name} exceeds 150MB limit`);
      return false;
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
    if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/') && !file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      toast.error(`${file.name}: file type not supported`);
      return false;
    }
    return true;
  };

  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files);
    const validFiles = newFiles.filter(validateFile);
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const fileItems = items.filter(item => item.kind === 'file');
    if (fileItems.length === 0) {
      const html = e.clipboardData.getData('text/html');
      if (html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const hasValidLink = Array.from(doc.querySelectorAll('a[href]')).some(a => {
          const h = a.getAttribute('href');
          return h && (h.startsWith('http://') || h.startsWith('https://'));
        });
        if (hasValidLink) {
          const blockTags = new Set(['p','div','li','h1','h2','h3','h4','h5','h6','tr','td','th','blockquote']);
          const domToText = (node) => {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent;
            if (node.nodeType !== Node.ELEMENT_NODE) return '';
            const tag = node.tagName.toLowerCase();
            if (tag === 'br') return '\n';
            if (tag === 'a') {
              const href = node.getAttribute('href');
              if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                const label = (node.textContent || '').trim() || href;
                return `[${label}](${href})`;
              }
              return node.textContent;
            }
            const inner = Array.from(node.childNodes).map(domToText).join('');
            return blockTags.has(tag) ? inner + '\n' : inner;
          };
          const insertText = domToText(doc.body).replace(/\n{3,}/g, '\n\n').trim();
          if (insertText) {
            e.preventDefault();
            const ta = textareaRef.current;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const newStr = content.slice(0, start) + insertText + content.slice(end);
            const newCursor = start + insertText.length;
            setContent(newStr);
            requestAnimationFrame(() => {
              ta.setSelectionRange(newCursor, newCursor);
              ta.style.height = 'auto';
              ta.style.height = ta.scrollHeight + 'px';
            });
            return;
          }
        }
      }
      return;
    }
    e.preventDefault();
    const files = fileItems.map(item => {
      const file = item.getAsFile();
      if (!file) return null;
      // Restore original filename if this image was copied from the chat, else name pasted screenshots
      if (!file.name || file.name === 'image.png') {
        const savedName = sessionStorage.getItem('clipboard_image_name');
        sessionStorage.removeItem('clipboard_image_name');
        const fallbackExt = file.type.split('/')[1] || 'png';
        return new File([file], savedName || `pasted-image-${Date.now()}.${fallbackExt}`, { type: file.type });
      }
      return file;
    }).filter(Boolean);
    const validFiles = files.filter(validateFile);
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('audio/')) return '🎵';
    if (type.startsWith('video/')) return '🎬';
    if (type === 'application/pdf') return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet') || type === 'text/csv' || type === 'application/csv') return '📊';
    if (type.includes('zip')) return '🗜️';
    return '📎';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedIds.length === 0) {
      alert('Please select at least one recipient (via "To" or by @mentioning someone) before sending a message.');
      return;
    }

    const hasText = content && content.trim();
    const hasFiles = selectedFiles.length > 0;

    if (!hasText && !hasFiles) {
      alert('Please enter a message or attach a file.');
      return;
    }

    setLoading(true);

    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('recipient_ids', JSON.stringify(selectedIds));
        formData.append('is_broadcast', allSelected ? 'true' : 'false');
        formData.append('recipient_id', selectedIds[0]);
        formData.append('secondary_recipient_id', secondaryRecipientId || '');
        formData.append('caption', file.name);
        const resp = await messagesAPI.uploadFile(groupId, formData);
        if (onMessageSent) onMessageSent(resp.message);
      }

      if (hasText) {
        const messageData = {
          content: rehydrateMentions(content.trim(), mentionsRef.current),
          recipient_ids: selectedIds,
          is_broadcast: allSelected,
          secondary_recipient_id: (selectedIds.length === 1 && secondaryRecipientId)
            ? parseInt(secondaryRecipientId)
            : null,
          reply_to_id: replyTo?.id || null,
        };
        const resp = await messagesAPI.sendMessage(groupId, messageData);
        if (onMessageSent) onMessageSent(resp.message);
      }

      // Clear draft on successful send
      if (user?.id) {
        localStorage.removeItem(`chat_draft_${user.id}_${groupId}`);
        window.dispatchEvent(new CustomEvent('chat-draft-changed', { detail: { groupId } }));
      }

      setContent('');
      mentionsRef.current = [];
      setSelectedIds([]);
      setSelectedFiles([]);
      setSecondaryRecipientId('');
      setShowSecondaryOption(false);
      setAssignmentInfo(null);
      setDropdownOpen(false);
      setSearch('');
      setMentionStart(-1);
      setMentionQuery(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      if (onReplyCancel) onReplyCancel();

    } catch (error) {
      toast.error(error?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleReplyCancel = () => {
    if (onReplyCancel) onReplyCancel();
  };

  const canSend = selectedIds.length > 0 && (content.trim().length > 0 || selectedFiles.length > 0) && !loading;

  return (
    <div className="message-sender">
      {replyTo && (
        <div className="reply-to-indicator">
          <div className="reply-info">
            <span className="reply-label">Replying to</span>
            <span className="reply-content">{replyTo.content?.replace(/@\[([^\]]+)\]\(uid:\d+\)/g, '@$1')}</span>
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
                    {loadingRecipients ? 'Loading…' : 'Select recipients or @mention below *'}
                  </span>
                : selectionLabel()
              }
            </div>
            <span className="chevron">{dropdownOpen ? '▲' : '▼'}</span>
          </div>
          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 4px)",
                top: "auto",
                left: 0,
                right: 0,
                zIndex: 9999,
                background: "var(--bg-primary)",
      /* ✅ THEME SUPPORT */
      // background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text)",

                borderRadius: "10px",
                maxHeight: "150px",
                overflowY: "auto",
                display: "block"
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

        {/* File preview area */}
        {selectedFiles.length > 0 && (
          <div className="file-preview-area">
            {selectedFiles.map((file, index) => (
              <div key={index} className="file-preview-item">
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="file-preview-thumb"
                  />
                ) : (
                  <div className="file-preview-icon">
                    {getFileIcon(file.type)}
                  </div>
                )}
                <span className="file-preview-name">{file.name}</span>
                <button
                  type="button"
                  className="file-preview-remove"
                  onClick={() => removeFile(index)}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Message input row */}
        <div className="input-row">
          <div className="input-container">
            <textarea
              ref={textareaRef}
              className="message-input"
              value={content}
              onChange={handleContentChange}
              placeholder="Type a message... (@ to mention someone)"
              rows={1}
              onKeyDown={handleTextareaKeyDown}
              onPaste={handlePaste}
            />

            {mentionQuery !== null && mentionSuggestions.length > 0 && (
              <div style={{
                position: 'fixed',
                bottom: window.innerHeight - (textareaRef.current?.getBoundingClientRect().top ?? 0) + 6,
                left: textareaRef.current?.getBoundingClientRect().left ?? 0,
                minWidth: 200,
                maxWidth: 280,
                zIndex: 9999,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                overflow: 'hidden',
              }}>
                {mentionSuggestions.map((m, i) => (
                  <div
                    key={m.user_id}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                    onMouseEnter={() => setMentionActiveIndex(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', cursor: 'pointer',
                      background: i === mentionActiveIndex ? 'var(--bg-hover)' : 'transparent',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: ac(m.full_name || ''), color: '#fff',
                      fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {ini(m.full_name || 'U')}
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{m.full_name}</span>
                    {m.role && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{m.role}</span>}
                  </div>
                ))}
              </div>
            )}

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
              multiple
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