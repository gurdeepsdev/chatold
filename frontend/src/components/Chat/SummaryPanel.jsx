import React, { useState, useEffect } from 'react';
import { groupsAPI } from '../../utils/api';
import { format } from 'date-fns';

const EVENT_ICONS = {
  group_created: '🚀',
  member_added: '👤',
  message_sent: '💬',
  task_created: '📋',
  task_status_changed: '✅',
  pid_live: '🟢',
  pid_paused: '🔴',
};

const EVENT_LABELS = {
  group_created: 'Group Created',
  member_added: 'Member Added',
  message_sent: 'Message Sent',
  task_created: 'Task Created',
  task_status_changed: 'Task Updated',
  pid_live: 'PID Set Live',
  pid_paused: 'PID Paused',
};

export default function SummaryPanel({ group }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!group) return;
    groupsAPI.getSummary(group.id)
      .then(d => { setEvents(d.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [group?.id]);

  // Filter out repetitive message events, show unique event types with counts
  const significantEvents = events.reduce((acc, event) => {
    if (event.event_type === 'message_sent') {
      const last = acc[acc.length - 1];
      if (last?.event_type === 'message_sent') {
        last.count = (last.count || 1) + 1;
        return acc;
      }
    }
    return [...acc, { ...event, count: 1 }];
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>WORKFLOW SUMMARY</span>
      </div>

      {/* Group info card */}
      {group && (
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <div className="card" style={{ margin: 0, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{group.group_name}</div>
            {group.sub_id && <div className="campaign-detail-row"><span className="campaign-detail-label">Sub ID</span><span className="campaign-detail-value tag">{group.sub_id}</span></div>}
            {group.package_id && <div className="campaign-detail-row"><span className="campaign-detail-label">Package ID</span><span className="campaign-detail-value tag">{group.package_id}</span></div>}
            <div className="campaign-detail-row">
              <span className="campaign-detail-label">Created</span>
              <span className="campaign-detail-value">{format(new Date(group.created_at || Date.now()), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Loading timeline...</div>
        ) : significantEvents.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div style={{ fontSize: 32 }}>📅</div>
            <p>No activity yet</p>
          </div>
        ) : (
          significantEvents.map((event, i) => (
            <div key={event.id} className="timeline-item">
              <div className="timeline-dot" style={{
                background: event.event_type.includes('paused') ? 'var(--danger-dim)' :
                            event.event_type.includes('live') ? 'var(--success-dim)' :
                            event.event_type === 'task_created' ? 'var(--warning-dim)' : 'var(--accent-dim)',
                borderColor: event.event_type.includes('paused') ? 'var(--danger)' :
                             event.event_type.includes('live') ? 'var(--success)' :
                             event.event_type === 'task_created' ? 'var(--warning)' : 'var(--accent)'
              }} />
              <div className="timeline-content">
                <div className="timeline-event">
                  {EVENT_ICONS[event.event_type] || '⚡'}{' '}
                  {EVENT_LABELS[event.event_type] || event.event_type}
                  {event.count > 1 && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>×{event.count}</span>}
                  {event.event_data && (() => {
                    try {
                      const data = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
                      if (data.task_type) return <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>({data.title})</span>;
                      if (data.pub_id) return <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>(PID: {data.pid})</span>;
                    } catch {}
                    return null;
                  })()}
                </div>
                <div className="timeline-time">
                  {event.triggered_by_name && <span>{event.triggered_by_name} · </span>}
                  {format(new Date(event.created_at), 'MMM d, HH:mm')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
