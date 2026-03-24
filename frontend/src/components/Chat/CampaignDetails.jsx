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
  const [selectedUser, setSelectedUser] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!group) return;
    groupsAPI.getById(group.id).then(d => setMembers(d.members || []));
    authAPI.getUsers().then(d => setAllUsers(d.users || []));
  }, [group?.id]);

  const addMember = async () => {
    if (!selectedUser) return;
    setAdding(true);
    try {
      await groupsAPI.addMember(group.id, parseInt(selectedUser));
      const data = await groupsAPI.getById(group.id);
      setMembers(data.members || []);
      setSelectedUser('');
      setShowAddMember(false);
      toast.success('Member added!');
    } catch { toast.error('Failed to add member'); }
    setAdding(false);
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
          <span className="card-title">👥 Members ({members.length})</span>
          <button className="btn-icon" style={{ fontSize: 16 }} onClick={() => setShowAddMember(!showAddMember)} title="Add member">+</button>
        </div>

        {showAddMember && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <select className="form-control" style={{ flex: 1, fontSize: 12 }} value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
              <option value="">Select user...</option>
              {addableUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
            </select>
            <button className="btn btn-primary btn-xs" onClick={addMember} disabled={adding || !selectedUser}>
              {adding ? '...' : 'Add'}
            </button>
          </div>
        )}

        {members.map(member => (
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
      </div>
    </div>
  );
}
