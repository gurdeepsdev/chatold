import React, { useState, useEffect } from 'react';
import { groupsAPI, authAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const AVATAR_COLORS = ['#4f7dff','#a855f7','#22c55e','#f59e0b','#ef4444','#06b6d4'];
function avatarColor(name = '') {
  let hash = 0;
  for (let c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function CampaignDetails({ group }) {
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    if (!group) return;
    groupsAPI.getById(group.id).then(d => setMembers(d.members || []));
    authAPI.getUsers().then(d => setAllUsers(d.users || []));
  }, [group?.id]);

  const addMembers = async () => {
    if (selectedUsers.length === 0) return;
    setAdding(true);
    try {
      // Add all selected users in parallel
      await Promise.all(selectedUsers.map(userId => groupsAPI.addMember(group.id, parseInt(userId))));
      
      // Refresh members list
      const data = await groupsAPI.getById(group.id);
      setMembers(data.members || []);
      
      // Reset form
      setSelectedUsers([]);
      setShowAddMember(false);
      toast.success(`Added ${selectedUsers.length} member${selectedUsers.length > 1 ? 's' : ''}!`);
    } catch { 
      toast.error('Failed to add member(s)'); 
    }
    setAdding(false);
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const removeMember = async (userId) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      await groupsAPI.removeMember(group.id, userId);
      setMembers(prev => prev.filter(m => m.id !== userId));
      toast.success('Member removed');
    } catch { toast.error('Failed to remove member'); }
  };

  if (!group) return null;

  const existingIds = new Set(members.map(m => m.id));
  const addableUsers = allUsers.filter(u => !existingIds.has(u.id));

  // Filter members based on search
  const filteredMembers = members.filter(member => 
    member.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    member.role?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    member.group_role?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // Show limited members initially, expand to show all
  const displayMembers = showAllMembers ? filteredMembers : filteredMembers.slice(0, 3);
  const hasMoreMembers = filteredMembers.length > 3;

  return (
    <div style={{ padding: 12 }}>
      {/* Campaign info */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📊 Campaign Details</span>
          {group.campaign_status && (
            <span className={`badge badge-${group.campaign_status === 'active' ? 'live' : 'paused'}`}>
              {group.campaign_status}
            </span>
          )}
        </div>
        <div className="campaign-detail-row"><span className="campaign-detail-label">Group</span><span className="campaign-detail-value" style={{ fontWeight: 600 }}>{group.group_name}</span></div>
        {group.campaign_name && <div className="campaign-detail-row"><span className="campaign-detail-label">Campaign</span><span className="campaign-detail-value">{group.campaign_name}</span></div>}
        {group.sub_id && <div className="campaign-detail-row"><span className="campaign-detail-label">Sub ID</span><span className="campaign-detail-value"><span className="tag">{group.sub_id}</span></span></div>}
        {group.package_id && <div className="campaign-detail-row"><span className="campaign-detail-label">Package</span><span className="campaign-detail-value"><span className="tag">{group.package_id}</span></span></div>}
        {group.geo && <div className="campaign-detail-row"><span className="campaign-detail-label">GEO</span><span className="campaign-detail-value">{group.geo}</span></div>}
        {group.payout && <div className="campaign-detail-row"><span className="campaign-detail-label">Payout</span><span className="campaign-detail-value" style={{ color: 'var(--success)', fontWeight: 600 }}>${group.payout}</span></div>}
        {group.payable_event && <div className="campaign-detail-row"><span className="campaign-detail-label">Event</span><span className="campaign-detail-value">{group.payable_event}</span></div>}
        {group.kpi && <div className="campaign-detail-row"><span className="campaign-detail-label">KPI</span><span className="campaign-detail-value">{group.kpi}</span></div>}
        {group.mmp_tracker && <div className="campaign-detail-row"><span className="campaign-detail-label">MMP</span><span className="campaign-detail-value">{group.mmp_tracker}</span></div>}
        {group.preview_url && (
          <div className="campaign-detail-row">
            <span className="campaign-detail-label">Preview</span>
            <a href={group.preview_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 12, flex: 1, wordBreak: 'break-all' }}>
              Open ↗
            </a>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">👥 Members ({filteredMembers.length})</span>
          <button className="btn-icon" style={{ fontSize: 16 }} onClick={() => setShowAddMember(!showAddMember)} title="Add member">+</button>
        </div>

        {/* Member Search Bar */}
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            className="form-control"
            style={{ fontSize: 12, padding: '6px 10px' }}
            placeholder="Search members..."
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
          />
        </div>

        {showAddMember && (
          <div style={{ marginBottom: 10 }}>
            {/* User List with Checkboxes */}
            <div style={{ 
              maxHeight: 200, 
              overflowY: 'auto', 
              border: '1px solid var(--border)', 
              borderRadius: 6, 
              marginBottom: 8,
              background: 'var(--bg-secondary)'
            }}>
              {addableUsers.length > 0 ? (
                addableUsers.map(u => (
                  <div 
                    key={u.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      transition: 'background-color 0.15s',
                      background: selectedUsers.includes(u.id) ? 'var(--bg-active)' : 'transparent'
                    }}
                    onClick={() => toggleUserSelection(u.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={() => toggleUserSelection(u.id)}
                      style={{ marginRight: 10 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{u.full_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{u.role}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No users available to add
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                {selectedUsers.length > 0 && `${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''} selected`}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button 
                  className="btn btn-secondary btn-xs" 
                  onClick={() => {
                    setSelectedUsers([]);
                    setShowAddMember(false);
                  }}
                  style={{ fontSize: 11 }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary btn-xs" 
                  onClick={addMembers} 
                  disabled={adding || selectedUsers.length === 0}
                  style={{ fontSize: 11 }}
                >
                  {adding ? '...' : `Add ${selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {displayMembers.map(member => (
          <div key={member.id} className="member-item">
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${avatarColor(member.full_name)}33`, color: avatarColor(member.full_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
              {getInitials(member.full_name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{member.full_name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{member.role} · {member.group_role}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={`status-dot ${member.is_online ? 'online' : 'offline'}`} />
              {member.group_role !== 'admin' && (
                <button
                  className="btn-icon"
                  style={{ padding: 4, fontSize: 12, color: 'var(--danger)', opacity: 0.6 }}
                  onClick={() => removeMember(member.id)}
                >✕</button>
              )}
            </div>
          </div>
        ))}

        {/* Show All/Hide Members Button */}
        {hasMoreMembers && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button
              className="btn btn-secondary btn-xs"
              style={{ fontSize: 11, padding: '4px 12px' }}
              onClick={() => setShowAllMembers(!showAllMembers)}
            >
              {showAllMembers ? `Hide ${filteredMembers.length - 3} members` : `Show all ${filteredMembers.length} members`}
            </button>
          </div>
        )}

        {/* No members found message */}
        {filteredMembers.length === 0 && memberSearch && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
            No members found matching "{memberSearch}"
          </div>
        )}
      </div>
    </div>
  );
}
