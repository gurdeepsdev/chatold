import React from 'react';
import { groupsAPI } from '../../utils/api';
import toast from 'react-hot-toast';

export default function PinnedGroups({ pinnedGroups, onSelectGroup, onUnpinGroup }) {
  const [groups, setGroups] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadPinnedGroups = async () => {
      if (pinnedGroups.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Load all groups for the user
        const data = await groupsAPI.getAll();
        const allGroups = data.groups || [];
        
        // Filter to only pinned groups
        const pinnedGroupData = allGroups.filter(g => pinnedGroups.includes(g.id));
        setGroups(pinnedGroupData);
      } catch (error) {
        toast.error('Failed to load pinned groups');
      } finally {
        setLoading(false);
      }
    };

    loadPinnedGroups();
  }, [pinnedGroups]);

  const handleUnpin = (groupId) => {
    onUnpinGroup(groupId);
  };

  if (pinnedGroups.length === 0) {
    return (
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
          📌 Pinned Groups
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
          No pinned groups yet
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
        📌 Pinned Groups ({groups.length})
      </div>
      
      {loading ? (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
          Loading...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {groups.map(group => (
            <div
              key={group.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                fontSize: '10px'
              }}
              onClick={() => onSelectGroup(group)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '8px',
                flexShrink: 0
              }}>
                {group.group_type === 'campaign' ? '📊' : '💬'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {group.group_name}
                </div>
                {group.campaign_name && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '9px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {group.campaign_name}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnpin(group.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '10px',
                  padding: '2px',
                  borderRadius: '2px',
                  opacity: 0.6,
                  transition: 'opacity 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.color = 'var(--danger)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.6';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
                title="Unpin group"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
