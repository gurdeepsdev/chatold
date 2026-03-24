import React, { useState, useEffect, useCallback } from 'react';
import { groupsAPI, campaignsAPI } from '../utils/api';
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
  const { on, connected } = useSocket();
  const [groups, setGroups] = useState([]);
  const [threads, setThreads] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedThreads, setExpandedThreads] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    try {
      const data = await groupsAPI.getAll();
      setGroups(data.groups || []);
      setThreads(data.threads || []);
      // Expand first thread by default
      if (data.threads?.length) {
        setExpandedThreads(prev => ({ [data.threads[0].package_id]: true, ...prev }));
      }
    } catch (err) {
      console.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  useEffect(() => {
    const unsub = on('new_message', (msg) => {
      setGroups(prev => prev.map(g => g.id === msg.group_id ? { ...g, last_message_at: msg.sent_at } : g));
    });
    return unsub;
  }, [on]);

  const toggleThread = (key) => {
    setExpandedThreads(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredGroups = search
    ? groups.filter(g => g.group_name?.toLowerCase().includes(search.toLowerCase()) || g.campaign_name?.toLowerCase().includes(search.toLowerCase()))
    : null;

  const renderGroup = (group) => (
    <div
      key={group.id}
      className={`group-item ${selectedGroupId === group.id ? 'active' : ''}`}
      onClick={() => onSelectGroup(group)}
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
        {group.pending_tasks > 0 && (
          <span className="group-badge" style={{ background: 'var(--warning)' }}>{group.pending_tasks}</span>
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
          <button className="btn-icon tooltip" onClick={() => setShowCreateModal(true)} title="New Group">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span className="tooltip-text">New Group</span>
          </button>
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
        ) : filteredGroups ? (
          filteredGroups.length ? filteredGroups.map(renderGroup) : (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No results</div>
          )
        ) : (
          threads.map(thread => (
            <div key={thread.package_id} className="thread-section">
              {thread.package_id && !thread.package_id.startsWith('custom_') && (
                <div className="thread-header" onClick={() => toggleThread(thread.package_id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {thread.package_id.replace(/^com\./, '')}
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
              {(expandedThreads[thread.package_id] || thread.package_id?.startsWith('custom_')) && (
                <div>
                  {thread.groups.map(renderGroup)}
                </div>
              )}
            </div>
          ))
        )}

        {!loading && groups.length === 0 && !search && (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">🗂️</div>
            <p>No groups yet.<br/>Create one from a campaign.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
              Create Group
            </button>
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
