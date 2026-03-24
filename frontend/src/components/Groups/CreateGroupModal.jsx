import React, { useState, useEffect } from 'react';
import { groupsAPI, campaignsAPI, authAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const ROLE_COLORS = {
  admin: '#a855f7', advertiser_manager: '#4f7dff', publisher_manager: '#06b6d4',
  advertiser: '#22c55e', publisher: '#f59e0b', am: '#4f7dff'
};

export default function CreateGroupModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const [mode, setMode] = useState('campaign'); // 'campaign' | 'custom'
  const [campaignData, setCampaignData] = useState({ advertisers: [], sub_ids: [] });
  const [users, setUsers] = useState([]);
  const [selectedAdvName, setSelectedAdvName] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [campaignType, setCampaignType] = useState('agency'); // 'agency' | 'direct'
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load campaign data (advertisers and sub_ids)
    campaignsAPI.getCampaignData().then(d => setCampaignData(d || { advertisers: [], sub_ids: [] }));
    authAPI.getUsers().then(d => setUsers(d.users || []));
  }, []);

  const toggleMember = (id) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      let group;
      if (mode === 'campaign') {
        if (!selectedAdvName) { toast.error('Select advertiser name'); setLoading(false); return; }
        if (!selectedSubId) { toast.error('Select campaign sub ID'); setLoading(false); return; }
        
        const data = await groupsAPI.createFromCampaignData({
          adv_name: selectedAdvName,
          campaign_subid: selectedSubId,
          campaign_type: campaignType,
          additional_members: selectedMembers
        });
        
        toast.success(data.message || 'Campaign groups created successfully');
        if (onCreated) onCreated();
        onClose();
      } else {
        if (!groupName.trim()) { toast.error('Enter a group name'); setLoading(false); return; }
        const data = await groupsAPI.createCustom({
          group_name: groupName.trim(),
          member_ids: selectedMembers
        });
        toast.success(data.message || 'Group created successfully');
        if (onCreated) onCreated();
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.error || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  // What defaults will be added
  const defaultLabel = campaignType === 'direct'
    ? 'Akshat + Ipsita added automatically'
    : 'No additional users (only creator + advertiser + admins)';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">Create Chat Group</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button className={`btn ${mode === 'campaign' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('campaign')} style={{ flex: 1 }}>📊 From Campaign</button>
            {(user?.role === 'admin' || user?.role === 'advertiser_manager') && (
              <button className={`btn ${mode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('custom')} style={{ flex: 1 }}>✏️ Custom Group</button>
            )}
          </div>

          {mode === 'campaign' && (
            <>
              {/* Campaign Type selector */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Campaign Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['agency', 'direct'].map(t => (
                    <button key={t} onClick={() => setCampaignType(t)}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 8, fontWeight: 600, fontSize: 13,
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        background: campaignType === t ? (t === 'agency' ? '#4f7dff' : '#22c55e') : 'var(--bg-tertiary)',
                        color: campaignType === t ? 'white' : 'var(--text-secondary)',
                        border: `1px solid ${campaignType === t ? (t === 'agency' ? '#4f7dff' : '#22c55e') : 'var(--border)'}`,
                      }}>
                      {t === 'agency' ? '🏢 Agency' : '⚡ Direct'}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
                  {defaultLabel}
                </div>
              </div>

              {/* Advertiser Name Selector */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Advertiser Name</label>
                <select
                  value={selectedAdvName}
                  onChange={(e) => setSelectedAdvName(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}
                >
                  <option value="">Select advertiser...</option>
                  {campaignData.advertisers.map((adv, index) => (
                    <option key={`adv_${adv.username}_${index}`} value={adv.username}>{adv.username}</option>
                  ))}
                </select>
              </div>

              {/* Campaign Sub ID Selector */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Campaign Sub ID</label>
                <select
                  value={selectedSubId}
                  onChange={(e) => setSelectedSubId(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}
                >
                  <option value="">Select campaign sub ID...</option>
                  {campaignData.sub_ids.map((row, index) => (
                    <option key={`sub_${row.sub_id}_${index}`} value={row.sub_id}>
                      {row.sub_id} - {row.campaign_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  💡 <strong>Info:</strong> This will create two separate groups for iOS and Android platforms.
                  <br />
                  Group naming format: <code>{`{campaign_name}_{advertiser_name}_{ios/android}`}</code>
                </div>
              </div>
            </>
          )}

          {mode === 'custom' && (
            <div className="form-group">
              <label className="form-label">Group Name</label>
              <input className="form-control" placeholder="e.g. Team Discussion" value={groupName} onChange={e => setGroupName(e.target.value)} />
            </div>
          )}

          {/* Member picker */}
          <div className="form-group">
            <label className="form-label">
              Add Additional Members
              {selectedMembers.length > 0 && (
                <span style={{ marginLeft: 6, background: '#4f7dff', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{selectedMembers.length}</span>
              )}
            </label>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {users.filter(u => u.id !== user.id).map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', background: selectedMembers.includes(u.id) ? 'var(--accent-dim)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                  onClick={() => toggleMember(u.id)}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedMembers.includes(u.id) ? 'var(--accent)' : 'var(--border)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{u.full_name}</div>
                    <div style={{ fontSize: 11, color: ROLE_COLORS[u.role] || 'var(--text-muted)' }}>{u.role} · {u.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? '⏳ Creating...' : '✓ Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
