import React, { useState, useEffect, useRef } from 'react';
import { messagesAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
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
  console.log('🔍 MessageSender props:', { groupId, onMessageSent, currentUser, replyTo });
  
  const [content, setContent] = useState('');
  const [recipientId, setRecipientId] = useState(''); // 🔄 Back to single recipient
  const [secondaryRecipientId, setSecondaryRecipientId] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [assignmentInfo, setAssignmentInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [showSecondaryOption, setShowSecondaryOption] = useState(false);
  
  // 🆕 Existing feature states
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);

  // 📋 Load available recipients
  useEffect(() => {
    if (groupId) {
      loadRecipients();
    }
  }, [groupId]);

  // 🔍 Load assignment info when recipient is selected
  useEffect(() => {
    if (recipientId && recipientId !== '') {
      loadAssignmentInfo(recipientId);
    } else {
      setAssignmentInfo(null);
      setSecondaryRecipientId('');
      setShowSecondaryOption(false);
    }
  }, [recipientId]);

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const data = await messagesAPI.getRecipients(groupId);
      setRecipients(data.recipients || []);
    } catch (error) {
      console.error('Failed to load recipients:', error);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const loadAssignmentInfo = async (recipientId) => {
    try {
      const info = await messagesAPI.getAssignmentInfo(groupId, recipientId);
      setAssignmentInfo(info);
      setShowSecondaryOption(info.isAssigned && info.secondaryUsers.length > 0);
    } catch (error) {
      console.error('Failed to load assignment info:', error);
      setAssignmentInfo(null);
      setShowSecondaryOption(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // 🔒 CORE RULE: Validate recipient selection
      if (!recipientId) {
        alert('Please select a recipient before sending message.');
        return;
      }
      
      if (typeof content === 'undefined') {
        console.error('❌ content is undefined');
        alert('Please enter a message.');
        return;
      }
      
      if (!content || !content.trim()) {
        alert('Please enter a message.');
        return;
      }

      console.log('📤 Sending message:', { recipientId, secondaryRecipientId, content: content.trim() });

      setLoading(true);
      
      const messageData = {
        content: content.trim(),
        recipient_id: parseInt(recipientId),
        secondary_recipient_id: secondaryRecipientId ? parseInt(secondaryRecipientId) : null,
        reply_to_id: replyTo?.id || null
      };

      const response = await messagesAPI.sendMessage(groupId, messageData);
      
      // 🎯 Reset form
      setContent('');
      setRecipientId('');
      setSecondaryRecipientId('');
      setShowSecondaryOption(false);
      setAssignmentInfo(null);
      
      // 🔄 Notify parent
      if (onMessageSent) {
        onMessageSent(response.message);
      }

      // 🔄 Cancel reply if active
      if (onReplyCancel) {
        onReplyCancel();
      }

    } catch (error) {
      console.error('❌ Message send error:', error);
      alert(error?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleReplyCancel = () => {
    if (onReplyCancel) {
      onReplyCancel();
    }
  };

  // 🆕 Enhanced feature handlers
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error('File size must be less than 10MB');
        return;
      }

      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg',
        'video/mp4', 'video/webm', 'video/ogg',
        'application/pdf', 
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip', 'application/x-zip-compressed'
      ];

      if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/') && !file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
        toast.error('File type not supported');
        return;
      }

      setSelectedFile(file);
      // Auto-send file message
      handleFileUpload(file);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (file) => {
    if (!file || !recipientId) {
      toast.error('Please select a recipient before uploading a file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('recipient_id', recipientId);
    formData.append('secondary_recipient_id', secondaryRecipientId || '');
    formData.append('caption', file.name); // Use filename as caption

    try {
      setLoading(true);
      toast.loading('Uploading file...', { id: 'file-upload' });
      
      const response = await messagesAPI.uploadFile(groupId, formData);
      
      // Reset form
      setContent('');
      setRecipientId('');
      setSecondaryRecipientId('');
      setSelectedFile(null);
      setShowSecondaryOption(false);
      setAssignmentInfo(null);
      
      // Notify parent
      if (onMessageSent) {
        onMessageSent(response.message);
      }

      // Cancel reply if active
      if (replyTo && onReplyCancel) {
        onReplyCancel();
      }

      toast.success(`${file.name} uploaded successfully!`, { id: 'file-upload' });
    } catch (error) {
      console.error('File upload error:', error);
      const errorMessage = error.error || 'Failed to upload file';
      toast.error(errorMessage, { id: 'file-upload' });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = () => {
    console.log('Task button clicked, opening popup...');
    setShowTaskPopup(true);
  };

  const handleTaskCreated = (task) => {
    setShowTaskPopup(false);
    // Task message will be sent via socket
    toast.success('Task created successfully!');
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      toast.success('Voice recording stopped!');
    } else {
      // Start recording
      setIsRecording(true);
      toast.success('Voice recording started...');
      // TODO: Implement actual voice recording logic
    }
  };

  return (
    <div className="message-sender">
      {/* 📝 Reply To Indicator */}
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
        {/* � Compact Recipient Selection */}
        <div className="input-row">
          <div className="recipient-selector">
            <select
              className="recipient-dropdown"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              required
              disabled={loadingRecipients}
            >
              <option value="">To: *</option>
              {loadingRecipients ? (
                <option disabled>Loading...</option>
              ) : (
                recipients.map((recipient) => (
                  <option key={recipient.user_id} value={recipient.user_id}>
                    {recipient.full_name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 🔗 Secondary Recipient (Manager) */}
          {showSecondaryOption && assignmentInfo?.secondaryUsers?.length > 0 && (
            <div className="secondary-selector">
              <select
                className="secondary-dropdown"
                value={secondaryRecipientId}
                onChange={(e) => setSecondaryRecipientId(e.target.value)}
              >
                <option value="">CC: Manager</option>
                {assignmentInfo.secondaryUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.readable_role || user.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 📱 Modern Input Row */}
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
            
            {/* 🎯 Action Buttons */}
            <div className="action-buttons">
              <button type="button" className="action-btn attachment-btn" title="Attach file" onClick={() => fileInputRef.current?.click()}>
                📎
              </button>
              <button type="button" className={`action-btn voice-btn ${isRecording ? 'recording' : ''}`} title="Voice message" onClick={handleVoiceRecord}>
                🎤
              </button>
              <button type="button" className="action-btn task-btn" title="Create task" onClick={handleTaskClick}>
                ✅
              </button>
            </div>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.csv,.ppt,.pptx"
            />
          </div>

          {/* 🚀 Send Button */}
          <button
            type="submit"
            className="send-btn"
            disabled={loading || !recipientId || !content.trim()}
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
      
      {/* 📋 Task Popup */}
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
