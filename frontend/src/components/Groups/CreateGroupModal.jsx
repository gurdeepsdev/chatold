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
  const [selectedSubId, setSelectedSubId] = useState('');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [campaignType, setCampaignType] = useState('agency'); // 'agency' | 'direct'
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter campaigns based on search
  const filteredCampaigns = campaignData.sub_ids.filter(row => 
    row.sub_id.toLowerCase().includes(campaignSearch.toLowerCase()) ||
    row.campaign_name.toLowerCase().includes(campaignSearch.toLowerCase())
  );

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    u.id !== user.id && (
      u.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(memberSearch.toLowerCase())
    )
  );

  useEffect(() => {
    const fetchCampaignData = async () => {
      try {
        const data = await campaignsAPI.getCampaignData();
        setCampaignData(data);
        
        // Auto-select first sub_id when data loads
        // if (data.sub_ids && data.sub_ids.length > 0) {
        //   setSelectedSubId(data.sub_ids[0].sub_id);
        //   setCampaignSearch(`${data.sub_ids[0].sub_id} - ${data.sub_ids[0].campaign_name}`);
        // }
      } catch (error) {
        toast.error('Failed to fetch campaign data');
      }
    };
    fetchCampaignData();
    authAPI.getUsers().then(d => setUsers(d.users || []));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.campaign-search-container')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const toggleMember = (id) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      let group;
      if (mode === 'campaign') {
        if (!selectedSubId) { toast.error('Select campaign sub ID'); setLoading(false); return; }
        
        const data = await groupsAPI.createFromCampaignData({
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
            {(user?.role === 'admin' || user?.role === 'advertiser_manager' || user?.role === 'advertiser') && (
              <button className={`btn ${mode === 'campaign' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('campaign')} style={{ flex: 1 }}>📊 From Campaign</button>
            )}
            {user?.role === 'admin' && (
              <button className={`btn ${mode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('custom')} style={{ flex: 1 }}>✏️ Custom Group</button>
            )}
            {!['admin', 'advertiser_manager', 'advertiser'].includes(user?.role) && (
              <div style={{ 
                textAlign: 'center', 
                color: 'var(--text-muted)', 
                padding: '20px',
                background: 'var(--bg-secondary)',
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Group Creation Restricted</div>
                <div style={{ fontSize: 12 }}>Only administrators, advertiser managers, and advertisers can create campaign groups</div>
                <div style={{ fontSize: 12 }}>Only administrators can create custom groups</div>
              </div>
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

              {/* Campaign Sub ID Selector */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Campaign Sub ID</label>
                <div className="campaign-search-container" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={campaignSearch}
                    onChange={(e) => {
                      setCampaignSearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search campaign sub ID or name..."
                    className="form-control"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      borderRadius: 8, 
                      border: '1px solid var(--border)',
                      paddingRight: '30px'
                    }}
                  />
                  {selectedSubId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubId('');
                        setCampaignSearch('');
                      }}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '16px'
                      }}
                    >
                      ✕
                    </button>
                  )}
                  
                  {/* Dropdown */}
                  {showDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      marginTop: 4,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: 'var(--shadow-md)'
                    }}>
                      {filteredCampaigns.length === 0 ? (
                        <div style={{ padding: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                          No campaigns found
                        </div>
                      ) : (
                        filteredCampaigns.map((row, index) => (
                          <div
                            key={`sub_${row.sub_id}_${index}`}
                            onClick={() => {
                              setSelectedSubId(row.sub_id);
                              setCampaignSearch(`${row.sub_id} - ${row.campaign_name}`);
                              setShowDropdown(false);
                            }}
                            style={{
                              padding: '10px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border)',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--bg-secondary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                              {row.sub_id}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {row.campaign_name}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
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
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search by name, email, or role..."
              className="form-control"
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                borderRadius: 8, 
                border: '1px solid var(--border)',
                marginBottom: 8
              }}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {filteredUsers.length === 0 ? (
                <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {memberSearch ? 'No users found matching your search' : 'No additional users available'}
                </div>
              ) : (
                filteredUsers.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', background: selectedMembers.includes(u.id) ? 'var(--accent-dim)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onClick={() => toggleMember(u.id)}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedMembers.includes(u.id) ? 'var(--accent)' : 'var(--border)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{u.full_name}</div>
                      <div style={{ fontSize: 11, color: ROLE_COLORS[u.role] || 'var(--text-muted)' }}>{u.role} · {u.email}</div>
                    </div>
                  </div>
                ))
              )}
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
