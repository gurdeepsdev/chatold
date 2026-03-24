import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Fill in all fields');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(err?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (role) => {
    const creds = {
      admin: { email: 'atique@crm.com', password: 'password123' },
      advertiser: { email: 'john@advertiser.com', password: 'password123' },
      publisher: { email: 'mike@publisher.com', password: 'password123' },
    };
    const c = creds[role];
    setEmail(c.email); setPassword(c.password);
    setLoading(true);
    try {
      await login(c.email, c.password);
    } catch (err) {
      toast.error(err?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box fade-in">
        <div className="login-logo">
          <div className="login-logo-icon">💬</div>
          <h1>CRM Chat</h1>
          <p>Campaign Communication Hub</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '14px', marginTop: 4 }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="divider" style={{ margin: '20px 0 16px' }} />
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
          DEMO ACCOUNTS (password: password123)
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {['admin', 'advertiser', 'publisher'].map(role => (
            <button
              key={role}
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: '11px', padding: '6px', textTransform: 'capitalize' }}
              onClick={() => demoLogin(role)}
              disabled={loading}
            >
              {role}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
