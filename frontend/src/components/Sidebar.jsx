

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const { on, connected, joinGroup, leaveGroup } = useSocket();
  const [groups, setGroups] = useState([]);
  const [threads, setThreads] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedThreads, setExpandedThreads] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pinnedGroups, setPinnedGroups] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [groupLastUnreadTime, setGroupLastUnreadTime] = useState({});

  // FIX 1: Stable position ref — only updated when a NEW message arrives,
  // never when a message is read. This prevents re-ordering on read.
  const stablePositionRef = useRef({});

  const isFirstRender = useRef(true);

  const loadGroups = useCallback(async () => {
    try {
      const data = await groupsAPI.getAll();
      setGroups(data.groups || []);
      setThreads(data.threads || []);

      if (data.groups && data.groups.length > 0) {
        data.groups.forEach(group => {
          if (group.id) joinGroup(group.id);
        });
      }

      loadUnreadCounts();
    } catch (error) {
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [joinGroup]);

  // FIX 2: loadUnreadCounts now detects count INCREASES (new message)
  // vs decreases (read). Only increases update stablePositionRef.
  const loadUnreadCounts = useCallback(async () => {
    try {
      const data = await messagesAPI.getUnreadCounts();
      const newUnreadCounts = data.unreadCounts || {};

      setUnreadCounts(prev => {
        Object.keys(newUnreadCounts).forEach(groupId => {
          const prevCount = prev[groupId] || 0;
          const newCount = newUnreadCounts[groupId] || 0;
          // Only stamp if count went UP — a new message arrived
          if (newCount > prevCount) {
            stablePositionRef.current[groupId] = Date.now();
          }
          // Reading (count goes down) does NOT update stablePositionRef
        });
        return newUnreadCounts;
      });

      setGroupLastUnreadTime(prev => {
        const updated = { ...prev };
        Object.keys(newUnreadCounts).forEach(groupId => {
          if (newUnreadCounts[groupId] > 0) {
            updated[groupId] = Date.now();
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Failed to load unread counts:', error);
    }
  }, []);

  const markGroupAsRead = useCallback(async (groupId) => {
    try {
      await messagesAPI.getMessages(groupId);
      // Only clear unread count locally — do NOT touch stablePositionRef here
      setUnreadCounts(prev => ({ ...prev, [groupId]: 0 }));
      await loadUnreadCounts();
    } catch (error) {
      console.error('Failed to mark group as read:', error);
    }
  }, []);

  const handleGroupSelect = useCallback((group) => {
    onSelectGroup(group);
    if (group && group.id) markGroupAsRead(group.id);
  }, [onSelectGroup, markGroupAsRead]);

  useEffect(() => {
    const storageKey = `pinned_groups_${user?.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { setPinnedGroups(JSON.parse(saved)); } catch (e) { console.error(e); }
    } else {
      setPinnedGroups([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && !isFirstRender.current) {
      localStorage.setItem(`pinned_groups_${user.id}`, JSON.stringify(pinnedGroups));
    } else if (isFirstRender.current) {
      isFirstRender.current = false;
    }
  }, [pinnedGroups]);

  const togglePinGroup = useCallback((groupId) => {
    setPinnedGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  }, []);

  const isGroupPinned = useCallback((groupId) => {
    return pinnedGroups.includes(groupId);
  }, [pinnedGroups]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  useEffect(() => {
    const unsub = on('new_message', (msg) => {
      console.log('📩 NEW MESSAGE RECEIVED', msg);
      console.log('[NEW_MESSAGE CHECK]', {
  msg,
  currentUser: user?.id,
  condition: msg.recipient_id === user?.id
});
      // FIX 3: Stamp stablePositionRef FIRST, before setGroups or loadGroups.
      // This ensures by the time the sort re-runs, the ref has the correct
      // timestamp and the fallback to last_message_at is never used.
      if (msg?.group_id) {
        stablePositionRef.current[msg.group_id] = Date.now();
      }

      // Update group's last_message_at in local state (no API call needed)
      setGroups(prev => prev.map(g =>
        g.id === msg.group_id ? { ...g, last_message_at: msg.sent_at } : g
      ));

      // FIX 4: Removed loadGroups() call here.
      // loadGroups() was fetching backend data which returns ORDER BY last_message_at DESC,
      // which overwrote the frontend state and bypassed stablePositionRef entirely.
      // The local setGroups above is enough to keep last_message_at current.

      // Update unread count for recipient only
      // if (
      //   msg.group_id &&
      //   msg.sender_id !== user?.id &&
      //   (msg.recipient_id === user?.id || msg.secondary_recipient_id === user?.id)
      // ) 
      if (
  msg.group_id &&
  msg.sender_id !== user?.id &&
  (
    msg.recipient_id === user?.id || 
    msg.secondary_recipient_id === user?.id ||
    msg.message_type === 'task_notification' // ✅ fallback safety
  )
)
      {
        setUnreadCounts(prev => ({
          ...prev,
          [msg.group_id]: (prev[msg.group_id] || 0) + 1
        }));
      }
    });

    const unsubTaskAssigned = on('task_assigned', (data) => {
  console.log('[SOCKET task_assigned RECEIVED]', data);

  const { task, group_id, assigned_to } = data;

  // ✅ 1. PERSONALIZATION (IMPORTANT)
  if (Number(assigned_to) !== Number(user?.id)) {
    console.log('❌ Task not for this user, ignoring');
    return;
  }

  // ✅ 2. FIX WRONG GROUP ISSUE
  if (group_id) {
    stablePositionRef.current[group_id] = Date.now();
  }

  // ✅ 3. UPDATE GROUP LAST ACTIVITY
  setGroups(prev =>
    prev.map(g =>
      g.id === group_id
        ? { ...g, last_message_at: new Date().toISOString() }
        : g
    )
  );

  // ✅ 4. INCREASE UNREAD COUNT
  setUnreadCounts(prev => ({
    ...prev,
    [group_id]: (prev[group_id] || 0) + 1
  }));
});
//add
const unsubTaskUpdate = on('task_update', (data) => {
  console.log('[SOCKET task_update RECEIVED]', data);

  const { group_id, updated_by } = data;

  // ❌ Ignore if current user updated it
  if (Number(updated_by) === Number(user?.id)) return;

  if (group_id) {
    stablePositionRef.current[group_id] = Date.now();

    setUnreadCounts(prev => ({
      ...prev,
      [group_id]: (prev[group_id] || 0) + 1
    }));
  }
});

    const unsubGroupCreated = on('group_created', (data) => {
      console.log("📢 group_created event:", data);
      if (data.group && data.group.member_ids?.includes(user?.id)) {
        setGroups(prev => {
          const existingIndex = prev.findIndex(g => g.id === data.group.id);
          if (existingIndex >= 0) {
            return prev.map((g, i) => i === existingIndex ? { ...g, ...data.group } : g);
          }
          return [data.group, ...prev];
        });
        loadGroups();
        loadUnreadCounts();
      }
    });

    const unsubCampaignCreated = on('campaign_created', (data) => {
      if (data.message) toast.success(data.message);
      joinGroup(data.campaign.group_id);
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

    const unsubMemberAdded = on('member_added', (data) => {
      if (Number(data.user_id) === user?.id) {
        if (data.group_id) joinGroup(data.group_id);
        loadGroups();
        toast.success(`You were added to a group by ${data.added_by_name}`);
      }
    });

    const unsubMemberRemoved = on('member_removed', (data) => {
      if (Number(data.user_id) === user?.id) {
        leaveGroup(data.group_id);
        setGroups(prev => prev.filter(g => g.id !== Number(data.group_id)));
        toast.success(`You were removed from a group by ${data.removed_by_name}`);
      }
    });

    return () => {
      unsub();
      unsubGroupCreated();
      unsubCampaignCreated();
      unsubMemberAdded();
      unsubMemberRemoved();
      unsubTaskAssigned(); //add
      unsubTaskUpdate(); //add
    };
  }, [on, user?.id, loadGroups, loadUnreadCounts, joinGroup, leaveGroup]);

  const toggleThread = (key) => {
    setExpandedThreads(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredGroups = search
    ? groups.filter(g =>
        g.group_name?.toLowerCase().includes(search.toLowerCase()) ||
        g.campaign_name?.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const sortedGroups = filteredGroups || groups;

  // FIX 5: groupsToRender no longer does its own sort by last_message_at.
  // Sorting is handled entirely by getUnifiedSortedItems using stableSortTime.
  const groupsToRender = sortedGroups ? [...sortedGroups] : sortedGroups;

  const validThreads = threads.filter(thread => (thread.groups || []).length > 1);
  const threadGroupIds = new Set(validThreads.flatMap(t => t.groups.map(g => g.id)));

  // FIX 6: Unified sort — groups and threads treated identically.
  // Both use stableSortTime so:
  //   - New message → stablePositionRef stamped → item moves to top
  //   - Read message → stablePositionRef unchanged → item stays in place
  const getUnifiedSortedItems = useCallback(() => {
    if (search) {
      return groupsToRender.map(group => ({
        type: 'group',
        item: group,
        priority: 0,
        unreadCount: unreadCounts[group.id] || 0,
        lastMessageAt: new Date(group.last_message_at || 0),
        isPinned: isGroupPinned(group.id)
      }));
    }

    const allItems = [];

    // Pinned groups
    // const pinnedGroupItems = groups
    //   .filter(g => pinnedGroups.includes(g.id))
    //   .map(group => ({
    //     type: 'group',
    //     item: group,
    //     priority: 1,
    //     unreadCount: unreadCounts[group.id] || 0,
    //     lastMessageAt: new Date(group.last_message_at || 0),
    //     stableSortTime: stablePositionRef.current[group.id] || new Date(group.last_message_at || 0).getTime(),
    //     isPinned: true
    //   }));

    const pinnedGroupItems = pinnedGroups
  .map(id => groups.find(g => g.id === id))
  .filter(Boolean)
  .map(group => ({
    type: 'group',
    item: group,
    priority: 1,
    unreadCount: unreadCounts[group.id] || 0,
    lastMessageAt: new Date(group.last_message_at || 0),
    stableSortTime: stablePositionRef.current[group.id] || new Date(group.last_message_at || 0).getTime(),
    isPinned: true
  }));
    // Threads — same logic as groups, no priority difference
    const threadItems = threads
      .filter(thread => (thread.groups || []).length > 1)
      .map(thread => {
        const threadGroups = thread.groups || [];
        const totalUnreadCount = threadGroups.reduce((sum, group) =>
          sum + (unreadCounts[group.id] || 0), 0
        );
        const latestMessageAt = threadGroups.reduce((latest, group) => {
          const groupTime = new Date(group.last_message_at || 0);
          return groupTime > latest ? groupTime : latest;
        }, new Date(0));
        // Use the most recent stableSortTime across all groups in this thread
        const threadStableTime = threadGroups.reduce((latest, group) => {
          const t = stablePositionRef.current[group.id] || new Date(group.last_message_at || 0).getTime();
          return t > latest ? t : latest;
        }, 0);
        return {
          type: 'thread',
          item: thread,
          priority: 0,  // Same priority as groups — no bias
          unreadCount: totalUnreadCount,
          lastMessageAt: latestMessageAt,
          stableSortTime: threadStableTime,
          isPinned: false,
          groups: threadGroups
        };
      });

    // Unpinned groups not in threads
    const unpinnedGroupItems = groups
      .filter(g => !pinnedGroups.includes(g.id) && !threadGroupIds.has(g.id))
      .map(group => ({
        type: 'group',
        item: group,
        priority: 0,
        unreadCount: unreadCounts[group.id] || 0,
        lastMessageAt: new Date(group.last_message_at || 0),
        stableSortTime: stablePositionRef.current[group.id] || new Date(group.last_message_at || 0).getTime(),
        isPinned: false
      }));

    allItems.push(...pinnedGroupItems, ...threadItems, ...unpinnedGroupItems);

    return allItems.sort((a, b) => {
      // 1. Pinned first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

  // 2. If BOTH are pinned → KEEP ORIGINAL ORDER (do NOT sort)
  if (a.isPinned && b.isPinned) return 0;

      // 2. Unread before read
      // const aHasUnread = a.unreadCount > 0;
      // const bHasUnread = b.unreadCount > 0;
      // if (aHasUnread && !bHasUnread) return -1;
      // if (!aHasUnread && bHasUnread) return 1;

      // 3. stableSortTime — position freezes on read, moves only on new message
      return b.stableSortTime - a.stableSortTime;
    });
  }, [search, groupsToRender, groups, threads, pinnedGroups, unreadCounts, threadGroupIds, isGroupPinned]);

  const renderUnifiedItem = (itemData) => {
    const { type, item, unreadCount } = itemData;

    if (type === 'thread') {
      const threadName = (() => {
        const firstGroup = item.groups?.[0];
        if (firstGroup?.crm_campaign_data) {
          try {
            const crmData = typeof firstGroup.crm_campaign_data === 'string'
              ? JSON.parse(firstGroup.crm_campaign_data)
              : firstGroup.crm_campaign_data;
            if (crmData?.campaign_name) return crmData.campaign_name;
          } catch {}
        }
        return item.package_id.replace(/^com\./, '');
      })();

      return (
        <div key={item.package_id}>
          <div
            className="group-item"
            onClick={() => toggleThread(item.package_id)}
            style={{ cursor: 'pointer', background: 'var(--bg-secondary)' }}
          >
            <div
              className="group-avatar"
              style={{
                background: `${avatarColor(threadName)}22`,
                color: avatarColor(threadName),
                border: `1px solid ${avatarColor(threadName)}44`
              }}
            >
              {getInitials(threadName)}
            </div>
            <div className="group-info">
              <div className="group-name">{threadName}</div>
              <div className="group-meta">
                <span>{item.groups.length} campaigns</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {unreadCount > 0 && (
                <span className="group-badge" style={{ background: 'var(--accent)' }}>
                  {unreadCount}
                </span>
              )}
              <span style={{ fontSize: 12 }}>
                {expandedThreads[item.package_id] ? '▲' : '▼'}
              </span>
            </div>
          </div>
          {expandedThreads[item.package_id] && item.groups.map(group => renderGroup(group, true))}
        </div>
      );
    }

    return renderGroup(item, false);
  };

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
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(group.last_message_at)}</span>
        {(unreadCounts[group.id] || 0) > 0 && (
          <span className="group-badge" style={{ background: 'var(--accent)' }}>
            {unreadCounts[group.id]}
          </span>
        )}
        <button
          className={`btn-icon ${isGroupPinned(group.id) ? 'pinned' : ''}`}
          onClick={(e) => { e.stopPropagation(); togglePinGroup(group.id); }}
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
      </div>
    </div>
  );

  return (
    <div className="sidebar">
      <div style={{fontSize:10, background:'#111', color:'#0f0', padding:6}}>
  <div>UnreadCounts: {JSON.stringify(unreadCounts)}</div>
  <div>StableRef: {JSON.stringify(stablePositionRef.current)}</div>
</div>
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span>💬</span>
          <span>CRM Chat</span>
          <span style={{ marginLeft: 4 }} className={`status-dot ${connected ? 'online' : 'offline'}`} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(user?.role === 'admin' || user?.role === 'advertiser_manager' || user?.role === 'advertiser') && (
            <button className="btn-icon tooltip" onClick={() => setShowCreateModal(true)} title="New Group">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span className="tooltip-text">New Group</span>
            </button>
          )}
          <button className="btn-icon tooltip" onClick={logout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            <span className="tooltip-text">Logout</span>
          </button>
        </div>
      </div>

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

      <div className="sidebar-search">
        <input
          type="text"
          className="search-input"
          placeholder="Search groups..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-groups">
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading groups...</div>
        ) : (
          <>
            {getUnifiedSortedItems().length > 0 ? (
              getUnifiedSortedItems().map(renderUnifiedItem)
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {search ? 'No results' : 'No groups yet. Create one from a campaign.'}
              </div>
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
          </>
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
