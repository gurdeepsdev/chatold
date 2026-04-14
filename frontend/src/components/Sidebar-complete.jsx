import React, { useState, useEffect, useCallback } from 'react';
import { groupsAPI, campaignsAPI, messagesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CreateGroupModal from './Groups/CreateGroupModal';
import toast from 'react-hot-toast';
import { formatTimeIST } from '../utils/timezone';

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
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

  // Load groups
  const loadGroups = useCallback(async () => {
    try {
      const data = await groupsAPI.getAll();
      setGroups(data.groups || []);
      setThreads(data.threads || []);
      
      // Join all group rooms for real-time updates
      if (data.groups && data.groups.length > 0) {
        data.groups.forEach(group => {
          if (group.id) {
            joinGroup(group.id);
          }
        });
      }
    } catch (error) {
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [joinGroup]);

  // Load unread counts
  const loadUnreadCounts = useCallback(async () => {
    try {
      const data = await messagesAPI.getUnreadCounts();
      setUnreadCounts(data.unreadCounts || {});
    } catch (error) {
      console.error('Failed to load unread counts:', error);
    }
  }, []);

  // Load pinned groups from localStorage
  const loadPinnedGroups = useCallback(() => {
    try {
      const pinned = localStorage.getItem(`pinned_groups_${user?.id}`);
      if (pinned) {
        setPinnedGroups(JSON.parse(pinned));
      }
    } catch (error) {
      console.error('Failed to load pinned groups:', error);
    }
  }, [user?.id]);

  // Save pinned groups to localStorage
  const savePinnedGroups = useCallback((pinned) => {
    try {
      localStorage.setItem(`pinned_groups_${user?.id}`, JSON.stringify(pinned));
      setPinnedGroups(pinned);
    } catch (error) {
      console.error('Failed to save pinned groups:', error);
    }
  }, [user?.id]);

  // Check if group is pinned
  const isGroupPinned = useCallback((groupId) => {
    return pinnedGroups.includes(groupId);
  }, [pinnedGroups]);

  // Toggle pin for a group
  const togglePinGroup = useCallback((groupId) => {
    const isPinned = isGroupPinned(groupId);
    let newPinned;
    
    if (isPinned) {
      // Unpin group
      newPinned = pinnedGroups.filter(id => id !== groupId);
      toast.success('Group unpinned');
    } else {
      // Pin group
      newPinned = [...pinnedGroups, groupId];
      toast.success('Group pinned');
    }
    
    savePinnedGroups(newPinned);
  }, [isGroupPinned, pinnedGroups, savePinnedGroups]);

  // Toggle thread expansion
  const toggleThread = (key) => {
    setExpandedThreads(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter groups by search
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

  // Render individual group
  const renderGroup = (group, isThreadGroup = false) => (
    <div
      key={group.id}
      className={`group-item ${selectedGroupId === group.id ? 'active' : ''}`}
      onClick={() => handleGroupSelect(group)}
    >
      <div
        className={`group-avatar ${group.group_type}`}
        style={{ 
          background: `${avatarColor(group.group_name)}22`, 
          color: avatarColor(group.group_name), 
          border: `1px solid ${avatarColor(group.group_name)}44` 
        }}
      >
        {getInitials(group.group_name)}
      </div>
      <div className="group-info">
        <div className="group-name">{group.group_name}</div>
        <div className="group-meta">
          {group.campaign_status && (
            <span className={`badge badge-${group.campaign_status === 'active' ? 'live' : 'paused'}`} style={{ marginRight: 4 }}>
              {group.campaign_status}
            </span>
          )}
          {group.geo && <span>{group.geo.split(',')[0]} · </span>}
          {group.payout && <span>${group.payout}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {formatTimeIST(group.last_message_at)}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Message count (total messages for this user) */}
          {group.message_count > 0 && (
            <span 
              className="group-badge" 
              style={{ 
                background: 'var(--bg-secondary)', 
                color: 'var(--text-muted)',
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)'
              }}
              title={`Total messages for you: ${group.message_count}`}
            >
              {group.message_count}
            </span>
          )}
          {/* Unread count */}
          {unreadCounts[group.id] > 0 && (
            <span 
              className="group-badge" 
              style={{ background: 'var(--accent)' }}
              title={`Unread messages: ${unreadCounts[group.id]}`}
            >
              {unreadCounts[group.id]}
            </span>
          )}
        </div>
        {/* Pin button - only for groups NOT inside threads */}
        {!isThreadGroup && (
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
            {isGroupPinned(group.id) ? 'Pinned' : 'Pin'}
          </button>
        )}
      </div>
    </div>
  );

  // Handle group selection
  const handleGroupSelect = (group) => {
    onSelectGroup(group);
    // Clear unread count for selected group
    setUnreadCounts(prev => ({ ...prev, [group.id]: 0 }));
  };

  // Initialize data
  useEffect(() => {
    loadGroups();
    loadUnreadCounts();
    loadPinnedGroups();
  }, [loadGroups, loadUnreadCounts, loadPinnedGroups]);

  // Real-time updates
  useEffect(() => {
    if (!connected) return;

    const unsubNewMessage = on('new_message', () => {
      loadGroups();
      loadUnreadCounts();
    });

    const unsubGroupCreated = on('group_created', () => {
      loadGroups();
    });

    const unsubCampaignCreated = on('campaign_created', () => {
      loadGroups();
    });

    return () => {
      unsubNewMessage();
      unsubGroupCreated();
      unsubCampaignCreated();
    };
  }, [on, connected, loadGroups, loadUnreadCounts]);

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">Chat Groups</div>
        <div className="sidebar-actions">
          <button
            className="btn-icon"
            onClick={() => setShowCreateModal(true)}
            title="Create group"
          >
            +
          </button>
          <button
            className="btn-icon"
            onClick={logout}
            title="Logout"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Groups List */}
      <div className="sidebar-content">
        {loading ? (
          <div className="sidebar-loading">Loading groups...</div>
        ) : (
          <>
            {/* Pinned Groups Section */}
            {pinnedGroups.length > 0 && (
              <div className="sidebar-section">
                <div className="sidebar-section-title">
                  <span>Pin</span>
                  <button
                    className="btn-icon"
                    onClick={() => savePinnedGroups([])}
                    title="Clear all pins"
                  >
                    Clear
                  </button>
                </div>
                {groupsToRender
                  .filter(group => pinnedGroups.includes(group.id))
                  .map(group => renderGroup(group, false))}
              </div>
            )}

            {/* Threaded Groups */}
            {threads.map(thread => (
              <div key={thread.package_id} className="sidebar-section">
                <div
                  className="sidebar-section-header"
                  onClick={() => toggleThread(thread.package_id)}
                >
                  <span className="sidebar-section-title">
                    {expandedThreads[thread.package_id] ? 'v' : '>'} {thread.package_id}
                  </span>
                  <span className="sidebar-section-count">
                    {thread.groups.length}
                  </span>
                </div>
                {expandedThreads[thread.package_id] && (
                  <div className="sidebar-section-content">
                    {thread.groups.map(group => renderGroup(group, true))}
                  </div>
                )}
              </div>
            ))}

            {/* Regular Groups (not in threads) */}
            {groups.filter(group => 
              !threads.some(thread => thread.groups.some(g => g.id === group.id))
            ).length > 0 && (
              <div className="sidebar-section">
                <div className="sidebar-section-title">Groups</div>
                {groupsToRender
                  .filter(group => 
                    !threads.some(thread => thread.groups.some(g => g.id === group.id)) &&
                    !pinnedGroups.includes(group.id)
                  )
                  .map(group => renderGroup(group, false))}
              </div>
            )}

            {/* Empty state */}
            {groups.length === 0 && (
              <div className="sidebar-empty">
                <div className="sidebar-empty-icon">No groups</div>
                <p>No groups found</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create Group
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadGroups();
          }}
        />
      )}
    </div>
  );
}
