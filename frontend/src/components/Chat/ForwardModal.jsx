import React, { useState, useEffect } from 'react';
import { groupsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function ForwardModal({ message, onClose, onForward }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await groupsAPI.getAll();
        setGroups(data.groups || []);
      } catch (error) {
        toast.error('Failed to fetch groups');
      }
    };
    fetchGroups();
  }, []);

  const toggleGroupSelection = (groupId) => {
    setSelectedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleForward = async () => {
    if (selectedGroups.length === 0) {
      toast.error('Please select at least one group');
      return;
    }

    setLoading(true);
    try {
      // Forward to all selected groups
      await Promise.all(
        selectedGroups.map(groupId => 
          onForward(groupId, message)
        )
      );
      
      toast.success(`Message forwarded to ${selectedGroups.length} group${selectedGroups.length > 1 ? 's' : ''}`);
      onClose();
    } catch (error) {
      toast.error('Failed to forward message');
    }
    setLoading(false);
  };

  const filteredGroups = groups.filter(group => 
    group.group_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.campaign_name && group.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Forward Message
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Select groups to forward this message
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* Message Preview */}
        <div style={{
          padding: '16px 20px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Message to forward:
          </div>
          <div style={{
            background: 'var(--bg-primary)',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: '14px',
            color: 'var(--text-secondary)'
          }}>
            {message.message_type === 'image' && message.file_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img 
                  src={message.file_url} 
                  alt={message.file_name || 'Image'}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    border: '1px solid var(--border)'
                  }}
                />
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    📷 {message.file_name || 'Image'}
                  </div>
                  {message.content && (
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      {message.content}
                    </div>
                  )}
                </div>
              </div>
            ) : message.message_type === 'audio' && message.file_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '8px',
                  background: 'var(--accent-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  🎵
                </div>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    🎵 {message.file_name || 'Audio'}
                  </div>
                  {message.content && (
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      {message.content}
                    </div>
                  )}
                </div>
              </div>
            ) : message.file_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '8px',
                  background: 'var(--bg-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  📎
                </div>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    📎 {message.file_name || 'File'}
                  </div>
                  {message.content && (
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      {message.content}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              message.content || 'No content'
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 20px' }}>
          <input
            type="text"
            placeholder="Search groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '14px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        {/* Groups List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px'
        }}>
          {filteredGroups.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--text-muted)'
            }}>
              {searchTerm ? 'No groups found' : 'No groups available'}
            </div>
          ) : (
            filteredGroups.map(group => (
              <div
                key={group.id}
                onClick={() => toggleGroupSelection(group.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                  background: selectedGroups.includes(group.id) ? 'var(--bg-active)' : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group.id)}
                  onChange={() => toggleGroupSelection(group.id)}
                  style={{ marginRight: '12px' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {group.group_name}
                  </div>
                  {group.campaign_name && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {group.campaign_name}
                    </div>
                  )}
                </div>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: group.group_type === 'campaign' ? '#4f7dff' : '#22c55e',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  {group.group_type === 'campaign' ? '📊' : '💬'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            {selectedGroups.length} group{selectedGroups.length !== 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleForward}
              disabled={loading || selectedGroups.length === 0}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: loading || selectedGroups.length === 0 ? 'var(--bg-hover)' : 'var(--accent)',
                color: 'white',
                fontSize: '14px',
                cursor: loading || selectedGroups.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '...' : `Forward${selectedGroups.length > 0 ? ` (${selectedGroups.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
