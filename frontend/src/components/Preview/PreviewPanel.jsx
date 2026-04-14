import React, { useState, useEffect } from 'react';
import { campaignsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { formatPIDStatusIST } from '../../utils/timezone';
import toast from 'react-hot-toast';

const PAUSE_SCENARIOS = [
  'Low Quality Traffic', 'Fraud Detected', 'Budget Exhausted',
  'Geo Mismatch', 'KPI Not Met', 'Technical Issue', 'Advertiser Request', 'Other'
];

export default function PreviewPanel({ group }) {
  const { user } = useAuth();
  const [pids, setPids] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ pub_id: '', pid: '', pub_am: '', status: 'live', pause_reason: '', scenario: '', feedback: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!group) return;
    const data = await campaignsAPI.getPidStatus(group.id);
    setPids(data.pids || []);
  };

  useEffect(() => { load(); }, [group?.id]);

  const handleSubmit = async () => {
    if (!form.pub_id || !form.pid) return toast.error('PubID and PID required');
    setSaving(true);
    try {
      await campaignsAPI.updatePidStatus({
        group_id: group.id,
        campaign_id: group.campaign_id,
        ...form
      });
      await load();
      setShowAdd(false);
      setForm({ pub_id: '', pid: '', pub_am: '', status: 'live', pause_reason: '', scenario: '', feedback: '' });
      toast.success('PID status updated!');
    } catch { toast.error('Failed to update'); }
    setSaving(false);
  };

  const toggleStatus = async (pid) => {
    const newStatus = pid.status === 'live' ? 'paused' : 'live';
    const reason = newStatus === 'paused' ? prompt('Pause reason:') : '';
    try {
      await campaignsAPI.updatePidStatus({
        group_id: group.id,
        campaign_id: group.campaign_id,
        pub_id: pid.pub_id,
        pid: pid.pid,
        pub_am: pid.pub_am,
        status: newStatus,
        pause_reason: reason || '',
        scenario: pid.scenario,
        feedback: pid.feedback
      });
      await load();
      toast.success(`PID ${newStatus}`);
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>PID PREVIEW STATUS</span>
        <button className="btn btn-xs btn-primary" onClick={() => setShowAdd(!showAdd)}>+ Add PID</button>
      </div>

      {/* Campaign info */}
      {group?.campaign_name && (
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <div className="card" style={{ margin: 0, padding: 12 }}>
            <div className="campaign-detail-row"><span className="campaign-detail-label">Campaign</span><span className="campaign-detail-value" style={{ fontWeight: 600 }}>{group.campaign_name}</span></div>
            {group.geo && <div className="campaign-detail-row"><span className="campaign-detail-label">GEO</span><span className="campaign-detail-value">{group.geo}</span></div>}
            {group.payout && <div className="campaign-detail-row"><span className="campaign-detail-label">Payout</span><span className="campaign-detail-value">${group.payout}</span></div>}
            {group.payable_event && <div className="campaign-detail-row"><span className="campaign-detail-label">Event</span><span className="campaign-detail-value">{group.payable_event}</span></div>}
            {group.kpi && <div className="campaign-detail-row"><span className="campaign-detail-label">KPI</span><span className="campaign-detail-value">{group.kpi}</span></div>}
            {group.preview_url && (
              <div className="campaign-detail-row">
                <span className="campaign-detail-label">Preview</span>
                <a href={group.preview_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 12, wordBreak: 'break-all' }}>
                  {group.preview_url.slice(0, 40)}...
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><label className="form-label">PubID *</label><input className="form-control" value={form.pub_id} onChange={e => setForm(p => ({ ...p, pub_id: e.target.value }))} placeholder="Publisher ID" /></div>
            <div><label className="form-label">PID *</label><input className="form-control" value={form.pid} onChange={e => setForm(p => ({ ...p, pid: e.target.value }))} placeholder="PID" /></div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label className="form-label">Pub AM</label>
            <input className="form-control" value={form.pub_am} onChange={e => setForm(p => ({ ...p, pub_am: e.target.value }))} placeholder="Account Manager name" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label className="form-label">Status</label>
              <select className="form-control" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                <option value="live">🟢 Live</option>
                <option value="paused">🔴 Paused</option>
              </select>
            </div>
            {form.status === 'paused' && (
              <div>
                <label className="form-label">Scenario</label>
                <select className="form-control" value={form.scenario} onChange={e => setForm(p => ({ ...p, scenario: e.target.value }))}>
                  <option value="">Select...</option>
                  {PAUSE_SCENARIOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
          {form.status === 'paused' && (
            <div style={{ marginBottom: 8 }}>
              <label className="form-label">Pause Reason</label>
              <input className="form-control" value={form.pause_reason} onChange={e => setForm(p => ({ ...p, pause_reason: e.target.value }))} placeholder="Reason for pausing..." />
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <label className="form-label">Feedback</label>
            <textarea className="form-control" style={{ minHeight: 56 }} value={form.feedback} onChange={e => setForm(p => ({ ...p, feedback: e.target.value }))} placeholder="Publisher feedback..." />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save PID'}
            </button>
          </div>
        </div>
      )}

      {/* PID table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {pids.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div style={{ fontSize: 32 }}>📊</div>
            <p>No PIDs tracked yet.<br/>Add a PID to monitor status.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pid-table">
              <thead>
                <tr>
                  <th>PubID</th><th>PID</th><th>AM</th><th>Status</th><th>Updated</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pids.map(pid => (
                  <tr key={pid.id}>
                    <td><code style={{ color: 'var(--accent)', fontSize: 11 }}>{pid.pub_id}</code></td>
                    <td><code style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{pid.pid}</code></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{pid.pub_am || '—'}</td>
                    <td>
                      <span className={`badge badge-${pid.status}`}>{pid.status}</span>
                      {pid.pause_reason && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }} title={pid.pause_reason}>
                          {pid.scenario || pid.pause_reason?.slice(0, 20)}
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                      {formatPIDStatusIST(pid.updated_at)}
                    </td>
                    <td>
                      <button
                        className={`btn btn-xs ${pid.status === 'live' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleStatus(pid)}
                      >
                        {pid.status === 'live' ? '⏸' : '▶'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pids.filter(p => p.feedback).map(pid => (
              <div key={`fb-${pid.id}`} className="card" style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Feedback for PID <code style={{ color: 'var(--accent)' }}>{pid.pid}</code>:
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pid.feedback}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
