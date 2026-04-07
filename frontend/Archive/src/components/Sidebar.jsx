import React, { useState, useEffect, useCallback } from 'react';
import { groupsAPI, campaignsAPI, messagesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CreateGroupModal from './Groups/CreateGroupModal';
import toast from 'react-hot-toast';
import { format, isToday, isYesterday } from 'date-fns';

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

const AVATAR_COLORS = ['#4f7dff','#a855f7','#22c55e','#f59e0b','#ef4444','#06b6d4'];
function avatarColor(name = '') {
  let hash = 0;
  for (let c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function Sidebar({ selectedGroupId, onSelectGroup }) {
  const { user, logout } = useAuth();
  const { on, connected, joinGroup } = useSocket();
  const [groups, setGroups] = useState([]);
  const [threads, setThreads] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedThreads, setExpandedThreads] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pinnedGroups, setPinnedGroups] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});

  const loadGroups = useCallback(async () => {
    try {
      const data = await groupsAPI.getAll();
      setGroups(data.groups || []);
      setThreads(data.threads || []);
      
      // Join all group rooms for real-time updates
      if (data.groups && data.groups.length > 0) {
        console.log('[Sidebar] Joining group rooms:', data.groups.map(g => g.id));
        data.groups.forEach(group => {
          if (group.id) {
            joinGroup(group.id);
          }
        });
      }
      
      // Load unread message counts
      loadUnreadCounts();
    } catch (error) {
      console.error('Failed to load groups:', error);
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [joinGroup]);

  const loadUnreadCounts = useCallback(async () => {
    try {
      const data = await messagesAPI.getUnreadCounts();
      setUnreadCounts(data.unreadCounts || {});
    } catch (error) {
      console.error('Failed to load unread counts:', error);
    }
  }, []);

  const markGroupAsRead = useCallback(async (groupId) => {
    try {
      // Mark messages as seen by calling the messages API
      await messagesAPI.getMessages(groupId); // This automatically marks messages as seen
      
      // Update unread counts locally
      setUnreadCounts(prev => ({
        ...prev,
        [groupId]: 0
      }));
    } catch (error) {
      console.error('Failed to mark group as read:', error);
    }
  }, []);

  // Handle group selection and mark as read
  const handleGroupSelect = useCallback((group) => {
    onSelectGroup(group);
    if (group && group.id) {
      markGroupAsRead(group.id);
    }
  }, [onSelectGroup, markGroupAsRead]);

  // Load pinned groups from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pinnedGroups');
    if (saved) {
      try {
        setPinnedGroups(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load pinned groups:', e);
      }
    }
  }, []);
  
  // Save pinned groups to localStorage whenever they change
  useEffect(() => {
    if (pinnedGroups.length > 0) {
      localStorage.setItem('pinnedGroups', JSON.stringify(pinnedGroups));
    }
  }, [pinnedGroups]);

  // Pin/unpin group functionality
  const togglePinGroup = useCallback((groupId) => {
    setPinnedGroups(prev => {
      const isPinned = prev.includes(groupId);
      if (isPinned) {
        // Remove from pinned groups
        return prev.filter(id => id !== groupId);
      } else {
        // Add to pinned groups
        return [...prev, groupId];
      }
    });
  }, []);

  // Check if a group is pinned
  const isGroupPinned = useCallback((groupId) => {
    return pinnedGroups.includes(groupId);
  }, [pinnedGroups]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  useEffect(() => {
    const unsub = on('new_message', (msg) => {
      setGroups(prev => prev.map(g => g.id === msg.group_id ? { ...g, last_message_at: msg.sent_at } : g));
    });

    const unsubGroupCreated = on('group_created', (data) => {
      // Only add the group if the current user is a member
      if (data.group && (data.group.created_by === user?.full_name || data.group.member_ids?.includes(user?.id))) {
        setGroups(prev => {
          // Check if group already exists to avoid duplicates
          const existingIndex = prev.findIndex(g => g.id === data.group.id);
          if (existingIndex >= 0) {
            // Update existing group
            return prev.map((g, index) => 
              index === existingIndex ? { ...g, ...data.group } : g
            );
          } else {
            // Add new group at the beginning
            return [data.group, ...prev];
          }
        });
        
        // Refresh groups list to get latest data
        loadGroups();
      }
    });

const unsubCampaignCreated = on('campaign_created', (data) => {
  console.log('🔥 Campaign received:', data);

  if (data.message) {
    toast.success(data.message);
  }

  // 🔥 JOIN NEW GROUP (IMPORTANT)
  joinGroup(data.campaign.group_id);

  // 🔥 UPDATE UI
  setGroups(prev => {
    const exists = prev.find(g => g.id === data.campaign.group_id);
    if (exists) return prev;

    return [{
      id: data.campaign.group_id,
      group_name: data.campaign.group_name,
      campaign_name: data.campaign.campaign_name
    }, ...prev];
  });
});

    const unsubNewMessage = on('new_message', (message) => {
      console.log('[Sidebar] New message received:', message);
      
      // Update unread counts when a new message arrives
      if (message.group_id && message.sender_id !== user?.id) {
        setUnreadCounts(prev => ({
          ...prev,
          [message.group_id]: (prev[message.group_id] || 0) + 1
        }));
      }
    });

    return () => {
      unsub();
      unsubGroupCreated();
      unsubCampaignCreated();
      unsubNewMessage();
    };
  }, [on, user?.full_name, user?.id, loadGroups, user?.id]);

  const toggleThread = (key) => {
    setExpandedThreads(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredGroups = search
    ? groups.filter(g => g.group_name?.toLowerCase().includes(search.toLowerCase()) || g.campaign_name?.toLowerCase().includes(search.toLowerCase()))
    : null;

  // Sort groups: pinned groups first, then by last message time
  const sortedGroups = filteredGroups || groups;
  const groupsToRender = sortedGroups ? 
    [...sortedGroups].sort((a, b) => {
      // Pinned groups come first
      const aPinned = isGroupPinned(a.id);
      const bPinned = isGroupPinned(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      // If both pinned or both not pinned, sort by last message time
      return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
    }) : sortedGroups;

  const renderGroup = (group, isThreadGroup = false) => (
    <div
      key={group.id}
      className={`group-item ${selectedGroupId === group.id ? 'active' : ''}`}
      onClick={() => handleGroupSelect(group)}
    >
      <div
        className={`group-avatar ${group.group_type}`}
        style={{ background: `${avatarColor(group.group_name)}22`, color: avatarColor(group.group_name), border: `1px solid ${avatarColor(group.group_name)}44` }}
      >
        {getInitials(group.group_name)}
      </div>
      <div className="group-info">
        <div className="group-name">{group.group_name}</div>
        <div className="group-meta">
          {group.campaign_status && <span className={`badge badge-${group.campaign_status === 'active' ? 'live' : 'paused'}`} style={{ marginRight: 4 }}>{group.campaign_status}</span>}
          {group.geo && <span>{group.geo.split(',')[0]} · </span>}
          {group.payout && <span>${group.payout}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(group.last_message_at)}</span>
        {unreadCounts[group.id] > 0 && (
          <span className="group-badge" style={{ background: 'var(--accent)' }}>{unreadCounts[group.id]}</span>
        )}
        {/* Pin button - only for groups NOT inside threads */}
   {(
  <button
    className={`btn-icon ${isGroupPinned(group.id) ? 'pinned' : ''}`}
    onClick={(e) => {
      e.stopPropagation();
      togglePinGroup(group.id);
    }}
    style={{
      fontSize: 10,
      padding: 2,
      opacity: isGroupPinned(group.id) ? 1 : 0.5,
      color: isGroupPinned(group.id) ? 'var(--warning)' : 'var(--text-muted)'
    }}
    title={isGroupPinned(group.id) ? 'Unpin group' : 'Pin group'}
  >
    📌
  </button>
)}
      </div>
    </div>
  );

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span>💬</span>
          <span>CRM Chat</span>
          <span style={{ marginLeft: 4 }} className={`status-dot ${connected ? 'online' : 'offline'}`} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(user?.role === 'admin' || user?.role === 'advertiser_manager' || user?.role === 'advertiser') && (
            <button className="btn-icon tooltip" onClick={() => setShowCreateModal(true)} title="New Group">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span className="tooltip-text">New Group</span>
            </button>
          )}
          <button className="btn-icon tooltip" onClick={logout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            <span className="tooltip-text">Logout</span>
          </button>
        </div>
      </div>

      {/* User info */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${avatarColor(user?.full_name)}33`, color: avatarColor(user?.full_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
          {getInitials(user?.full_name)}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.full_name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role}</div>
        </div>
        <span className="status-dot online" style={{ marginLeft: 'auto' }} />
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <input
          type="text"
          className="search-input"
          placeholder="Search groups..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Groups */}
      <div className="sidebar-groups">
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading groups...</div>
        ) : (
          <>
            {/* Pinned Groups Section - Always at Top */}
            {!search && pinnedGroups.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ 
                  fontSize: 11, 
                  fontWeight: 600, 
                  color: 'var(--text-muted)', 
                  marginBottom: 8,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  📌 Pinned Groups ({pinnedGroups.length})
                </div>
                {groups
                  .filter(g => pinnedGroups.includes(g.id))
                  .sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0))
                  .map(group => renderGroup(group, false))}
              </div>
            )}

            {search ? (
              // Show filtered groups when searching
              groupsToRender.length ? groupsToRender.map(renderGroup) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No results</div>
              )
            ) : (
              // Show threads and remaining individual groups when not searching
              <>
                {threads.map(thread => (
                  <div key={thread.package_id} className="thread-section">
                    {thread.package_id && !thread.package_id.startsWith('custom_') && (
                      <div className="thread-header" onClick={() => toggleThread(thread.package_id)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                        </svg>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(() => {
                            // Extract campaign name from crm_campaign_data JSON field
                            const firstGroup = thread.groups?.[0];
                            if (firstGroup?.crm_campaign_data) {
                              try {
                                const crmData = typeof firstGroup.crm_campaign_data === 'string' 
                                  ? JSON.parse(firstGroup.crm_campaign_data) 
                                  : firstGroup.crm_campaign_data;
                                if (crmData?.campaign_name) {
                                  return crmData.campaign_name;
                                }
                              } catch (e) {
                                console.error('Failed to parse crm_campaign_data:', e);
                              }
                            }
                            // Fallback to package_id if no campaign name found
                            return thread.package_id.replace(/^com\./, '');
                          })()}
                        </span>
                        <span style={{ fontSize: 10, background: 'var(--bg-active)', padding: '1px 5px', borderRadius: 4 }}>
                          {thread.groups.length}
                        </span>
                        <svg
                          className={`thread-chevron ${expandedThreads[thread.package_id] ? 'open' : ''}`}
                          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        >
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                    )}
                    {expandedThreads[thread.package_id] && thread.groups.map(group => renderGroup(group, true))}
                  </div>
                ))}
                
                {/* Show ALL individual groups with pin buttons (excluding pinned ones to avoid duplication) */}
                {groupsToRender.filter(g => !pinnedGroups.includes(g.id)).map(renderGroup)}
              </>
            )}
          </>
        )}

        {!loading && groups.length === 0 && !search && (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">🗂️</div>
            <p>No groups yet.<br/>Create one from a campaign.</p>
            {(user?.role === 'admin' || user?.role === 'advertiser_manager' || user?.role === 'advertiser') && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
                Create Group
              </button>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(group) => {
            loadGroups();
            setShowCreateModal(false);
            onSelectGroup(group);
            toast.success('Group created!');
          }}
        />
      )}
    </div>
  );
}
