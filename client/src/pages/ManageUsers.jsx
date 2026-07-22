import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { Plus, MoreHorizontal, Mail, X, Trash2, AlertTriangle } from 'lucide-react';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function avatarColor(name) {
  const colors = ['#F0A500', '#3a5a99', '#7c5cbf', '#c2593f', '#3f9e6d', '#c23f6f'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function UserCard({ u, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div className="uc-card">
      <div className="uc-top">
        <div className="uc-avatar" style={{ background: avatarColor(u.full_name) }}>
          {initials(u.full_name)}
          <span className={`uc-status-dot ${u.is_first_login ? 'pending' : 'active'}`} />
        </div>
        <div className="uc-name-block">
          <p className="uc-name">{u.full_name}</p>
          <p className="uc-role">{u.role}</p>
        </div>
        <div className="uc-menu-wrap" ref={menuRef}>
          <button className="uc-menu-btn" onClick={() => setMenuOpen(m => !m)}>
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="uc-menu-dropdown">
              <button className="uc-menu-item danger" onClick={() => { setMenuOpen(false); onDelete(u.id, u.full_name); }}>
                <Trash2 size={14} /> Remove
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="uc-meta-row">
        <div>
          <p className="uc-meta-label">Username</p>
          <p className="uc-meta-value">{u.username}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="uc-meta-label">Date Added</p>
          <p className="uc-meta-value">{formatDate(u.created_at)}</p>
        </div>
      </div>

      <div className="uc-divider" />

      <div className="uc-detail-row">
        <Mail size={13} />
        <span>{u.email || 'No email on file'}</span>
      </div>
      <div className="uc-detail-row">
        <span className={`uc-status-text ${u.is_first_login ? 'pending' : 'active'}`}>
          {u.is_first_login ? 'Password not set' : 'Active'}
        </span>
      </div>
    </div>
  );
}

export default function ManageUsers() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('agent');
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  function showToast(msg, type = 'success') {
    const id = ++toastIdRef.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id));
    }, 2500);
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch (err) {
      setError('Failed to load users.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setCreatedInfo(null);

    // Client-side required-field check first
    const newFieldErrors = {};
    if (!username.trim()) newFieldErrors.username = true;
    if (!fullName.trim()) newFieldErrors.fullName = true;
    if (!email.trim()) newFieldErrors.email = true;
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setError('Please fill in all required fields.');
      return;
    }

    setCreating(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ username, full_name: fullName, email, role })
      });
      const data = await res.json();

      if (!data.success) {
        const rawMsg = data.error || 'Failed to create user.';
        const friendlyMsg = /violates|constraint|relation|column/i.test(rawMsg)
          ? 'Something went wrong. Please check the form and try again.'
          : rawMsg;
        setError(friendlyMsg);

        // Highlight the specific field the backend flagged, if we can tell
        if (/username/i.test(rawMsg)) setFieldErrors({ username: true });
        else if (/email/i.test(rawMsg)) setFieldErrors({ email: true });
        else if (/full name/i.test(rawMsg)) setFieldErrors({ fullName: true });

        setCreating(false);
        return;
      }

setCreatedInfo({ username: data.data.username, password: data.defaultPassword, emailSent: data.emailSent });
      showToast(
        data.emailSent
          ? "Account created! Login credentials were sent to the user's email."
          : 'Account created! Email could not be sent — check the credentials below.'
      );      setUsername('');
      setFullName('');
      setEmail('');
      setRole('agent');
      setFieldErrors({});
      setCreating(false);
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      setError('Network error. Please try again.');
      setCreating(false);
    }
  };

  const handleDelete = (id, name) => {
    setConfirmDelete({ id, name });
  };

  const confirmDeleteUser = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${confirmDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) fetchUsers();
      else setError(data.error || 'Failed to delete user.');
    } catch (err) {
      setError('Network error. Please try again.');
    }
    setDeleting(false);
    setConfirmDelete(null);
  };

  if (!user) return null;

  return (
    <>
      <style>{`
        .mu-body {
          min-height: 100vh;
          background: radial-gradient(circle at 50% 0%, #142d6e 0%, #050e1d 60%);
          display: flex;
          font-family: 'Inter', Arial, sans-serif;
        }
        .mu-main { flex: 1; min-width: 0; padding: 30px 32px 60px; }
        .mu-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; flex-wrap: wrap; gap: 12px; }
        .mu-header h2 { margin: 0; color: #fff; font-size: 21px; letter-spacing: 0.3px; }

        .mu-btn-primary {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 18px;
          background: #F0A500;
          color: #0b1f4d;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13.5px;
        }
        .mu-btn-primary:hover { background: #ffb800; }

        .mu-alert-error {
          background: rgba(138,31,31,0.2);
          border: 1px solid rgba(138,31,31,0.5);
          color: #ff8a8a;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 18px;
          font-size: 13.5px;
        }
        .mu-alert-success {
          background: rgba(30,122,60,0.18);
          border: 1px solid rgba(30,122,60,0.5);
          color: #8fe0a8;
          padding: 14px 16px;
          border-radius: 8px;
          margin-bottom: 18px;
          font-size: 13.5px;
        }
        .mu-alert-success strong { color: #b9f2cb; }
        .mu-cred-box {
          margin-top: 10px;
          font-family: monospace;
          font-size: 14px;
          color: #fff;
          background: rgba(0,0,0,0.2);
          padding: 10px 12px;
          border-radius: 6px;
        }

        /* ---- Modal form ---- */
        .mu-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center; z-index: 100;
          padding: 20px;
        }
        .mu-modal {
          background: #0d234f;
          border: 1px solid rgba(240,165,0,0.25);
          border-radius: 12px;
          padding: 26px;
          width: 420px;
          max-width: 100%;
        }
        .mu-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
        .mu-modal .mu-alert-error { margin-bottom: 16px; }
        .mu-modal-header h3 { margin: 0; color: #fff; font-size: 17px; }
        .mu-modal-close { background: none; border: none; color: #8092b8; cursor: pointer; }
        .mu-form-grid { display: flex; flex-direction: column; gap: 14px; margin-bottom: 18px; }
        .mu-form-grid label span { display: block; color: #c9d4ec; font-size: 12px; margin-bottom: 6px; letter-spacing: 0.4px; }
        .mu-input, .mu-select {
          width: 100%;
          padding: 10px 12px;
          box-sizing: border-box;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(240,165,0,0.3);
          border-radius: 6px;
          color: #fff;
          font-size: 13.5px;
          outline: none;
        }
        .mu-select option { background: #0b1f4d; color: #fff; }
.mu-input.error, .mu-select.error { border-color: #e04b4b; background: rgba(224,75,75,0.08); }
        .mu-field-error { margin: 6px 0 0 0; color: #ff8a8a; font-size: 11.5px; }        /* ---- Card grid ---- */
        .uc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        .uc-card {
          background: #0d234f;
          border: 1px solid rgba(240,165,0,0.18);
          border-radius: 14px;
          padding: 18px;
        }
        .uc-top { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
        .uc-avatar {
          position: relative;
          width: 42px; height: 42px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #0b1f4d; font-weight: 800; font-size: 14px;
          flex-shrink: 0;
        }
        .uc-status-dot {
          position: absolute; bottom: -1px; right: -1px;
          width: 11px; height: 11px; border-radius: 50%;
          border: 2px solid #0d234f;
        }
        .uc-status-dot.active { background: #4ade80; }
        .uc-status-dot.pending { background: #f0b000; }
        .uc-name-block { flex: 1; min-width: 0; }
        .uc-name { margin: 0; color: #fff; font-size: 14.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .uc-role { margin: 2px 0 0 0; color: #F0A500; font-size: 10.5px; letter-spacing: 0.6px; text-transform: uppercase; font-weight: 600; }

        .uc-menu-wrap { position: relative; }
        .uc-menu-btn { background: none; border: none; color: #8092b8; cursor: pointer; padding: 4px; border-radius: 5px; }
        .uc-menu-btn:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .uc-menu-dropdown {
          position: absolute; right: 0; top: 28px; z-index: 10;
          background: #142d6e; border: 1px solid rgba(240,165,0,0.25); border-radius: 8px;
          min-width: 130px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4);
        }
        .uc-menu-item {
          display: flex; align-items: center; gap: 8px; width: 100%;
          padding: 9px 12px; background: none; border: none; color: #ff8a8a; font-size: 12.5px; cursor: pointer; text-align: left;
        }
        .uc-menu-item:hover { background: rgba(138,31,31,0.2); }

        .uc-meta-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .uc-meta-label { margin: 0; color: #5c6f94; font-size: 10px; letter-spacing: 0.4px; text-transform: uppercase; }
        .uc-meta-value { margin: 2px 0 0 0; color: #e6ecf7; font-size: 13px; font-weight: 600; }

        .uc-divider { height: 1px; background: rgba(255,255,255,0.08); margin-bottom: 12px; }

        .uc-detail-row { display: flex; align-items: center; gap: 8px; color: #c9d4ec; font-size: 12.5px; margin-bottom: 6px; }
        .uc-detail-row:last-child { margin-bottom: 0; }
        .uc-status-text.active { color: #4ade80; font-weight: 600; }
        .uc-status-text.pending { color: #f0b000; font-weight: 600; }

.uc-empty { color: #8092b8; font-size: 13.5px; padding: 40px; text-align: center; grid-column: 1 / -1; }

        /* ---- Confirm delete modal ---- */
        .mu-confirm-modal {
          background: #0d234f;
          border: 1px solid rgba(224,75,75,0.35);
          border-radius: 12px;
          padding: 26px;
          width: 380px;
          max-width: 100%;
          text-align: center;
        }
        .mu-confirm-icon {
          width: 46px; height: 46px; border-radius: 50%;
          background: rgba(224,75,75,0.15);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          color: #ff8a8a;
        }
        .mu-confirm-modal h3 { margin: 0 0 8px 0; color: #fff; font-size: 16px; }
        .mu-confirm-modal p { margin: 0 0 22px 0; color: #a9b6d6; font-size: 13px; line-height: 1.5; }
        .mu-confirm-modal p strong { color: #e6ecf7; }
        .mu-confirm-actions { display: flex; gap: 10px; }
        .mu-btn-cancel {
          flex: 1; padding: 10px 16px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #c9d4ec;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
        }
        .mu-btn-cancel:hover { background: rgba(255,255,255,0.1); }
        .mu-btn-danger {
          flex: 1; padding: 10px 16px;
          background: #c23f3f;
          border: none;
          color: #fff;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
        }
        .mu-btn-danger:hover { background: #d94848; }
        .mu-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 700px) {
          .mu-main { padding: 20px 16px 40px; }
          .uc-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="mu-body">
        <Sidebar
          user={user}
          activePath={location.pathname}
          onNavigate={navigate}
          onLogout={handleLogout}
        />

        <main className="mu-main">
          <div className="mu-header">
            <h2>Manage User Accounts</h2>
            <button className="mu-btn-primary" onClick={() => { setShowForm(true); setCreatedInfo(null); setError(''); setFieldErrors({}); }}>              <Plus size={16} />
              Add Agent / Admin
            </button>
          </div>

          {!showForm && error && <div className="mu-alert-error">{error}</div>}

          {createdInfo && !createdInfo.emailSent && (
            <div className="mu-alert-error" style={{ background: 'rgba(240,165,0,0.12)', borderColor: 'rgba(240,165,0,0.4)', color: '#f0c674' }}>
              Email could not be sent — give these credentials to the user manually:
              <div className="mu-cred-box">
                Username: <strong>{createdInfo.username}</strong><br />
                Default Password: <strong>{createdInfo.password}</strong>
              </div>
            </div>
          )}

          <div className="uc-grid">
            {loading ? (
              <div className="uc-empty">Loading...</div>
            ) : users.length === 0 ? (
              <div className="uc-empty">No accounts yet.</div>
            ) : (
              users.map(u => (
                <UserCard key={u.id} u={u} onDelete={handleDelete} />
              ))
            )}
          </div>
        </main>
      </div>

{confirmDelete && (
        <div className="mu-modal-overlay" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="mu-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="mu-confirm-icon">
              <AlertTriangle size={22} />
            </div>
            <h3>Remove Account</h3>
            <p>Are you sure you want to remove the account for <strong>{confirmDelete.name}</strong>? This action cannot be undone.</p>
            <div className="mu-confirm-actions">
              <button className="mu-btn-cancel" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</button>
              <button className="mu-btn-danger" onClick={confirmDeleteUser} disabled={deleting}>{deleting ? 'Removing...' : 'Remove'}</button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5, 14, 29, 0.6)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'none'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, pointerEvents: 'auto' }}>
            {toasts.map(t => (
              <div key={t.id} style={{
                width: 380,
                background: '#0d234f',
                border: '1px solid rgba(30,122,60,0.5)',
                borderRadius: 20,
                padding: '40px 32px 32px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'rgba(30,122,60,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <span style={{ fontSize: '2.5rem', color: '#4ade80', fontWeight: 700, lineHeight: 1 }}>✓</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#e6ecf7', lineHeight: 1.5 }}>
                  {t.msg}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5, 14, 29, 0.6)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'none'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, pointerEvents: 'auto' }}>
            {toasts.map(t => (
              <div key={t.id} style={{
                width: 380,
                background: '#0d234f',
                border: '1px solid rgba(30,122,60,0.5)',
                borderRadius: 20,
                padding: '40px 32px 32px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'rgba(30,122,60,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <span style={{ fontSize: '2.5rem', color: '#4ade80', fontWeight: 700, lineHeight: 1 }}>✓</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#e6ecf7', lineHeight: 1.5 }}>
                  {t.msg}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5, 14, 29, 0.6)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'none'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, pointerEvents: 'auto' }}>
            {toasts.map(t => (
              <div key={t.id} style={{
                width: 380,
                background: '#0d234f',
                border: '1px solid rgba(30,122,60,0.5)',
                borderRadius: 20,
                padding: '40px 32px 32px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'rgba(30,122,60,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <span style={{ fontSize: '2.5rem', color: '#4ade80', fontWeight: 700, lineHeight: 1 }}>✓</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#e6ecf7', lineHeight: 1.5 }}>
                  {t.msg}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5, 14, 29, 0.6)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'none'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, pointerEvents: 'auto' }}>
            {toasts.map(t => (
              <div key={t.id} style={{
                width: 380,
                background: '#0d234f',
                border: '1px solid rgba(30,122,60,0.5)',
                borderRadius: 20,
                padding: '40px 32px 32px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'rgba(30,122,60,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <span style={{ fontSize: '2.5rem', color: '#4ade80', fontWeight: 700, lineHeight: 1 }}>✓</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#e6ecf7', lineHeight: 1.5 }}>
                  {t.msg}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="mu-modal-overlay" onClick={() => { setShowForm(false); setError(''); setFieldErrors({}); }}>
          <div className="mu-modal" onClick={e => e.stopPropagation()}>
            <div className="mu-modal-header">
              <h3>Add Agent / Admin</h3>
            <button className="mu-modal-close" onClick={() => { setShowForm(false); setError(''); setFieldErrors({}); }}><X size={18} /></button>            </div>
            <form onSubmit={handleCreate} noValidate>
                  <div className="mu-form-grid">
                <label>
                  <span>Username *</span>
                  <input type="text" className={`mu-input ${fieldErrors.username ? 'error' : ''}`} value={username} onChange={(e) => setUsername(e.target.value.trim())} autoFocus />
                  {fieldErrors.username && <p className="mu-field-error">Please enter a username</p>}
                </label>
                <label>
                  <span>Full Name *</span>
                  <input type="text" className={`mu-input ${fieldErrors.fullName ? 'error' : ''}`} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  {fieldErrors.fullName && <p className="mu-field-error">Please enter a full name</p>}
                </label>
                <label>
                  <span>Email *</span>
                  <input type="email" className={`mu-input ${fieldErrors.email ? 'error' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)} />
                  {fieldErrors.email && <p className="mu-field-error">Please enter a valid email</p>}
                </label>
                <label>
                  <span>Role *</span>
                  <select className="mu-select" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>
              <button type="submit" className="mu-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={creating}>
                {creating ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}