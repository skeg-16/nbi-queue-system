import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { Plus, MoreHorizontal, Mail, X, UserX, UserCheck, AlertTriangle, User, ChevronLeft, ChevronRight } from 'lucide-react';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function UserCard({ u, onDeactivate, onReactivate, onEdit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const isActive = u.is_active !== false;
  const daysDeactivated = !isActive ? daysSince(u.deactivated_at) : 0;
  const daysLeft = Math.max(0, 30 - daysDeactivated);

 return (
    <div className={`uc-card ${!isActive ? 'uc-card-inactive' : ''} ${u.is_locked ? 'uc-card-locked' : ''}`}>
      <div className="uc-top">
        <div className="uc-avatar">
          <User size={20} strokeWidth={2.2} />
        </div>
         <div className="uc-name-block">
          <p className="uc-name">{u.username}</p>
          <p className="uc-role">{u.role}{u.is_locked ? ' · LOCKED' : ''}</p>
        </div>
        <div className="uc-menu-wrap" ref={menuRef}>
          <button className="uc-menu-btn" onClick={() => setMenuOpen(m => !m)}>
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="uc-menu-dropdown">
              <button className="uc-menu-item" onClick={() => { setMenuOpen(false); onEdit(u); }}>
                <User size={14} /> Edit Username
              </button>
              {isActive ? (
                <button className="uc-menu-item danger" onClick={() => { setMenuOpen(false); onDeactivate(u.id, u.username); }}>
                  <UserX size={14} /> Deactivate
                </button>
              ) : (
                <button className="uc-menu-item" onClick={() => { setMenuOpen(false); onReactivate(u.id, u.username); }}>
                  <UserCheck size={14} /> Reactivate
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="uc-meta-row">
        <div>
          <p className="uc-meta-label">Full Name</p>
          <p className="uc-meta-value">{u.full_name}</p>
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
        {isActive ? (
          <span className="uc-status-text active">
            {u.is_first_login ? 'Password not set' : 'Active'}
          </span>
        ) : (
          <span className="uc-status-text inactive">
            Deactivated {daysDeactivated}d ago · auto-deletes in {daysLeft}d
          </span>
        )}
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
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 12;

  const [requests, setRequests] = useState([]);
  const [acceptingRequest, setAcceptingRequest] = useState(null);
  const [acceptEmail, setAcceptEmail] = useState('');
  const [accepting, setAccepting] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/account-requests', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setRequests(data.data);
    } catch (err) { /* ignore */ }
  };

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
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedUsers = [...users].sort((a, b) => (b.is_locked ? 1 : 0) - (a.is_locked ? 1 : 0));
  const totalPages = Math.ceil(sortedUsers.length / usersPerPage);
  const paginatedUsers = sortedUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);
  const openAcceptModal = (r) => {
    setAcceptingRequest(r);
    setAcceptEmail(r.users?.email || '');
  };

  const submitAccept = async () => {
    if (!acceptingRequest) return;
    if (acceptingRequest.type === 'forgot_password' && !acceptEmail.trim()) {
      showToast("Please enter the agent's email.");
      return;
    }
    setAccepting(true);
    try {
      const res = await fetch(`/api/account-requests/${acceptingRequest.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: acceptEmail })
      });
     const data = await res.json();
      if (data.success) {
        showToast(acceptingRequest.type === 'forgot_password' ? 'Reset code sent to agent.' : 'Account unlocked.');
        setAcceptingRequest(null);
        setAcceptEmail('');
        fetchRequests();
      } else {
        showToast(data.error || 'Failed to process request.');
      }
    } catch (err) {
      showToast('Network error.');
    }
    setAccepting(false);
  };
  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setCreatedInfo(null);

    const newFieldErrors = {};
    if (!username.trim()) newFieldErrors.username = true;
    if (!fullName.trim()) newFieldErrors.fullName = true;
    if (role === 'admin' && !email.trim()) newFieldErrors.email = true;
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

        if (/username/i.test(rawMsg)) setFieldErrors({ username: true });
        else if (/email/i.test(rawMsg)) setFieldErrors({ email: true });
        else if (/full name/i.test(rawMsg)) setFieldErrors({ fullName: true });

        setCreating(false);
        return;
      }

      setCreatedInfo({ username: data.data.username, password: data.defaultPassword, emailSent: data.emailSent, role });
      showToast(
        data.emailSent
          ? "Account created! Login credentials were sent to the user's email."
          : role === 'admin'
            ? 'Account created! Email could not be sent — check the credentials below.'
            : 'Account created! Share these credentials with the agent directly.'
      );
      setUsername('');
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

  const handleDeactivate = (id, name) => {
    setConfirmDeactivate({ id, name });
  };

  const confirmDeactivateUser = async () => {
    if (!confirmDeactivate) return;
    setDeactivating(true);
    try {
      const res = await fetch(`/api/users/${confirmDeactivate.id}/deactivate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showToast('Account deactivated. It will be permanently deleted after 30 days.');
        fetchUsers();
      } else {
        setError(data.error || 'Failed to deactivate user.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
    setDeactivating(false);
    setConfirmDeactivate(null);
  };

  const handleReactivate = async (id, name) => {
    try {
      const res = await fetch(`/api/users/${id}/reactivate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${name} has been reactivated.`);
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to reactivate user.');
      }
    } catch (err) {
      showToast('Network error.');
    }
  };


  const openEditModal = (u) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditError('');
  };

  const submitEditUsername = async () => {
    if (!editUsername.trim()) {
      setEditError('Please enter a username.');
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      const res = await fetch(`/api/users/${editingUser.id}/username`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: editUsername.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Username updated.');
        setEditingUser(null);
        fetchUsers();
      } else {
        setEditError(data.error || 'Failed to update username.');
      }
    } catch (err) {
      setEditError('Network error.');
    }
    setSavingEdit(false);
  };

  if (!user) return null;

  return (
    <>
      <style>{`
        .mu-body {
          min-height: 100vh;
          background: var(--bg-color);
          display: flex;
          font-family: 'Inter', Arial, sans-serif;
        }
        .mu-main { flex: 1; min-width: 0; padding: 30px 32px 60px; }
        .mu-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; flex-wrap: wrap; gap: 12px; }
        .mu-header h2 { margin: 0; color: var(--text-main); font-size: 21px; letter-spacing: 0.3px; }

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
          white-space: nowrap;
        }
        .mu-btn-primary:hover { background: #ffb800; }

        .mu-page-nav {
          display: flex;
          align-items: center;
          gap: 4px;
          background: var(--panel-bg);
          border: 1px solid rgba(240,165,0,0.25);
          border-radius: 8px;
          padding: 4px;
        }
        .mu-page-arrow {
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          background: transparent;
          border: none;
          border-radius: 5px;
          color: var(--text-muted);
          cursor: pointer;
        }
        .mu-page-arrow:hover:not(:disabled) { background: rgba(240,165,0,0.15); color: #F0A500; }
        .mu-page-arrow:disabled { opacity: 0.3; cursor: not-allowed; }

        .mu-alert-error {
          background: rgba(194,63,63,0.12);
          border: 1px solid rgba(194,63,63,0.4);
          color: #c23f3f;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 18px;
          font-size: 13.5px;
        }
        .mu-cred-box {
          margin-top: 10px;
          font-family: monospace;
          font-size: 14px;
          color: var(--text-main);
          background: var(--bg-color);
          border: 1px solid var(--border-color);
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
          background: var(--panel-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 26px;
          width: 420px;
          max-width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }
        .mu-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
        .mu-modal .mu-alert-error { margin-bottom: 16px; }
        .mu-modal-header h3 { margin: 0; color: var(--text-main); font-size: 17px; }
        .mu-modal-close { background: none; border: none; color: var(--text-muted); cursor: pointer; }
        .mu-form-grid { display: flex; flex-direction: column; gap: 14px; margin-bottom: 18px; }
        .mu-form-grid label span { display: block; color: var(--text-muted); font-size: 12px; margin-bottom: 6px; letter-spacing: 0.4px; }
        .mu-input, .mu-select {
          width: 100%;
          padding: 10px 12px;
          box-sizing: border-box;
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-main);
          font-size: 13.5px;
          outline: none;
        }
        .mu-select option { background: var(--panel-bg); color: var(--text-main); }
        .mu-input.error, .mu-select.error { border-color: #e04b4b; background: rgba(224,75,75,0.08); }
        .mu-field-error { margin: 6px 0 0 0; color: #e04b4b; font-size: 11.5px; }

        /* ---- Card grid ---- */
        .uc-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .uc-card {
          background: var(--panel-bg);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 18px;
        }
        .uc-card-inactive {
          border-color: rgba(194,63,63,0.4);
          opacity: 0.75;
        }
        .uc-card-locked {
          border-color: rgba(240,165,0,0.6);
          box-shadow: 0 0 0 1px rgba(240,165,0,0.3);
        }
        .uc-top { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
        .uc-avatar {
          position: relative;
          width: 42px; height: 42px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #0b1f4d; background: #F0A500;
          flex-shrink: 0;
        }
        .uc-name-block { flex: 1; min-width: 0; }
        .uc-name { margin: 0; color: var(--text-main); font-size: 15.5px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .uc-role { margin: 2px 0 0 0; color: #F0A500; font-size: 10.5px; letter-spacing: 0.6px; text-transform: uppercase; font-weight: 600; }

        .uc-menu-wrap { position: relative; }
        .uc-menu-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 5px; }
        .uc-menu-btn:hover { background: rgba(240,165,0,0.12); color: var(--text-main); }
        .uc-menu-dropdown {
          position: absolute; right: 0; top: 28px; z-index: 10;
          background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 8px;
          min-width: 140px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.25);
        }
        .uc-menu-item {
          display: flex; align-items: center; gap: 8px; width: 100%;
          padding: 9px 12px; background: none; border: none; color: var(--text-muted); font-size: 12.5px; cursor: pointer; text-align: left;
        }
        .uc-menu-item.danger { color: #e04b4b; }
        .uc-menu-item:hover { background: rgba(240,165,0,0.1); color: var(--text-main); }
        .uc-menu-item.danger:hover { background: rgba(194,63,63,0.15); }

        .uc-meta-row { display: flex; justify-content: space-between; margin-bottom: 10px; gap: 10px; }
        .uc-meta-label { margin: 0; color: var(--text-muted); font-size: 10px; letter-spacing: 0.4px; text-transform: uppercase; }
        .uc-meta-value { margin: 2px 0 0 0; color: var(--text-main); font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .uc-divider { height: 1px; background: var(--border-color); margin-bottom: 12px; }

        .uc-detail-row { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 12.5px; margin-bottom: 6px; }
        .uc-detail-row:last-child { margin-bottom: 0; }
        .uc-status-text.active { color: #3fa860; font-weight: 600; }
        .uc-status-text.inactive { color: #e04b4b; font-weight: 600; }

        .uc-empty { color: var(--text-muted); font-size: 13.5px; padding: 40px; text-align: center; grid-column: 1 / -1; }

        /* ---- Confirm modal ---- */
        .mu-confirm-modal {
          background: var(--panel-bg);
          border: 1px solid rgba(194,63,63,0.4);
          border-radius: 12px;
          padding: 26px;
          width: 380px;
          max-width: 100%;
          text-align: center;
        }
        .mu-confirm-icon {
          width: 46px; height: 46px; border-radius: 50%;
          background: rgba(194,63,63,0.15);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          color: #e04b4b;
        }
        .mu-confirm-modal h3 { margin: 0 0 8px 0; color: var(--text-main); font-size: 16px; }
        .mu-confirm-modal p { margin: 0 0 22px 0; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
        .mu-confirm-modal p strong { color: var(--text-main); }
        .mu-confirm-actions { display: flex; gap: 10px; }
        .mu-btn-cancel {
          flex: 1; padding: 10px 16px;
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
        }
        .mu-btn-cancel:hover { background: rgba(240,165,0,0.08); }
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

        /* ---- Pending requests ---- */
        .mu-req-card {
          background: var(--panel-bg);
          border: 1px solid rgba(240,165,0,0.25);
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }
        .mu-req-name { margin: 0; color: var(--text-main); font-weight: 600; font-size: 13.5px; }
        .mu-req-sub { margin: 3px 0 0 0; color: var(--text-muted); font-size: 12px; }

        /* ---- Toast ---- */
        .mu-toast-overlay {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          pointer-events: none;
          padding: 20px;
        }
        .mu-toast-card {
          width: 380px;
          max-width: 100%;
          background: var(--panel-bg);
          border: 1px solid rgba(63,168,96,0.5);
          border-radius: 20px;
          padding: 40px 32px 32px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.45);
          display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px;
        }
        .mu-toast-icon-wrap {
          width: 80px; height: 80px; border-radius: 50%;
          background: rgba(63,168,96,0.16);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .mu-toast-icon { font-size: 2.5rem; color: #3fa860; font-weight: 700; line-height: 1; }
        .mu-toast-msg { font-size: 1.05rem; font-weight: 600; color: var(--text-main); line-height: 1.5; }

        /* ---------- Responsive ---------- */
        @media (max-width: 1100px) {
          .uc-grid { grid-template-columns: repeat(3, 1fr); }
        }

        @media (max-width: 900px) {
          .mu-main { padding: 20px 16px 40px; }
          .mu-header h2 { font-size: 18px; }
          .uc-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .uc-card { padding: 15px; border-radius: 12px; }
        }

        @media (max-width: 640px) {
          .mu-header { gap: 10px; }
          .mu-header > div { width: 100%; justify-content: space-between; }
          .mu-btn-primary { flex: 1; justify-content: center; padding: 10px 14px; font-size: 13px; }
          .mu-page-nav { flex-shrink: 0; }

          .mu-req-card { padding: 12px 14px; }
          .mu-req-card > .mu-btn-primary { flex: none; width: 100%; }

          .mu-modal { padding: 20px; border-radius: 10px; }
          .mu-modal-header h3 { font-size: 15.5px; }

          .mu-toast-card { padding: 32px 20px 26px; border-radius: 16px; gap: 16px; }
          .mu-toast-icon-wrap { width: 64px; height: 64px; }
          .mu-toast-icon { font-size: 2rem; }
          .mu-toast-msg { font-size: 0.95rem; }
        }

        @media (max-width: 480px) {
          .mu-main { padding: 16px 12px 32px; }
          .uc-grid { grid-template-columns: 1fr; gap: 10px; }
          .uc-card { padding: 14px; }
          .uc-name { font-size: 14.5px; }
          .uc-avatar { width: 36px; height: 36px; }

          .mu-confirm-modal { padding: 20px; }
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {!loading && totalPages > 1 && (
                <div className="mu-page-nav">
                  <button
                    className="mu-page-arrow"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="mu-page-arrow"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
              <button className="mu-btn-primary" onClick={() => { setShowForm(true); setCreatedInfo(null); setError(''); setFieldErrors({}); }}>
                <Plus size={16} />
                Add Agent / Admin
              </button>
            </div>
          </div>

          {!showForm && error && <div className="mu-alert-error">{error}</div>}

          {requests.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ color: 'var(--text-main)', fontSize: 15, marginBottom: 10 }}>Pending Requests ({requests.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {requests.map(r => (
                  <div key={r.id} className="mu-req-card">
                    <div>
                      <p className="mu-req-name">
                        {r.users?.full_name} ({r.users?.username})
                      </p>
                      <p className="mu-req-sub">
                        {r.type === 'forgot_password' ? 'Requested a password reset' : 'Account locked after 3 failed login attempts'}
                      </p>
                    </div>
                    <button className="mu-btn-primary" onClick={() => openAcceptModal(r)}>
                      {r.type === 'forgot_password' ? 'Send Reset Link' : 'Unlock Account'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="uc-grid">
            {loading ? (
              <div className="uc-empty">Loading...</div>
            ) : users.length === 0 ? (
              <div className="uc-empty">No accounts yet.</div>
            ) : (
              paginatedUsers.map(u => (
                <UserCard key={u.id} u={u} onDeactivate={handleDeactivate} onReactivate={handleReactivate} onEdit={openEditModal} />
              ))
            )}
          </div>
        
          </main>
      </div>

      {acceptingRequest && (
        <div className="mu-modal-overlay" onClick={() => !accepting && setAcceptingRequest(null)}>
          <div className="mu-modal" onClick={e => e.stopPropagation()}>
            <div className="mu-modal-header">
              <h3>{acceptingRequest.type === 'forgot_password' ? 'Send Reset Code' : 'Unlock Account'}</h3>
              <button className="mu-modal-close" onClick={() => setAcceptingRequest(null)}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px 0' }}>
              {acceptingRequest.type === 'forgot_password'
                ? `Enter the email of ${acceptingRequest.users?.full_name} (${acceptingRequest.users?.username}) to send the reset code.`
                : `Unlock the account of ${acceptingRequest.users?.full_name} (${acceptingRequest.users?.username})?`}
            </p>
            {acceptingRequest.type === 'forgot_password' && (
              <div className="mu-form-grid">
                <label>
                  <span>Agent's Email *</span>
                  <input type="email" className="mu-input" value={acceptEmail} onChange={(e) => setAcceptEmail(e.target.value)} autoFocus />
                </label>
              </div>
            )}
            <button className="mu-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submitAccept} disabled={accepting}>
              {accepting ? 'Processing...' : (acceptingRequest.type === 'forgot_password' ? 'Send Reset Code' : 'Unlock Account')}
            </button>
          </div>
        </div>
      )}

{editingUser && (
        <div className="mu-modal-overlay" onClick={() => !savingEdit && setEditingUser(null)}>
          <div className="mu-modal" onClick={e => e.stopPropagation()} style={{ width: 380 }}>
            <div className="mu-modal-header">
              <h3>Edit Username</h3>
              <button className="mu-modal-close" onClick={() => setEditingUser(null)}><X size={18} /></button>
            </div>
            {editError && <div className="mu-alert-error">{editError}</div>}
            <div className="mu-form-grid">
              <label>
                <span>Username</span>
                <input
                  type="text"
                  className="mu-input"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  autoFocus
                  maxLength={30}
                />
              </label>
            </div>
            <button className="mu-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submitEditUsername} disabled={savingEdit}>
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {confirmDeactivate && (
        <div className="mu-modal-overlay" onClick={() => !deactivating && setConfirmDeactivate(null)}>
          <div className="mu-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="mu-confirm-icon">
              <AlertTriangle size={22} />
            </div>
            <h3>Deactivate Account</h3>
            <p>Are you sure you want to deactivate <strong>{confirmDeactivate.name}</strong>? They won't be able to log in. The account will be permanently deleted after 30 days unless reactivated.</p>
            <div className="mu-confirm-actions">
              <button className="mu-btn-cancel" onClick={() => setConfirmDeactivate(null)} disabled={deactivating}>Cancel</button>
              <button className="mu-btn-danger" onClick={confirmDeactivateUser} disabled={deactivating}>{deactivating ? 'Deactivating...' : 'Deactivate'}</button>
            </div>
          </div>
        </div>
      )}
      
      {createdInfo && !createdInfo.emailSent && (
        <div className="mu-modal-overlay" onClick={() => setCreatedInfo(null)}>
          <div className="mu-modal" onClick={e => e.stopPropagation()} style={{ width: 380 }}>
            <div className="mu-modal-header">
              <h3>Account Created</h3>
              <button className="mu-modal-close" onClick={() => setCreatedInfo(null)}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 14px 0' }}>
              {createdInfo.role === 'admin'
                ? 'Email could not be sent — give these credentials to the user manually:'
                : 'Give these credentials to the agent directly (no email needed):'}
            </p>
            <div className="mu-cred-box">
              Username: <strong>{createdInfo.username}</strong><br />
              Default Password: <strong>{createdInfo.password}</strong>
            </div>
            <button className="mu-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={() => setCreatedInfo(null)}>
              Got it
            </button>
          </div>
        </div>
      )}


      {toasts.length > 0 && (
        <div className="mu-toast-overlay">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, pointerEvents: 'auto' }}>
            {toasts.map(t => (
              <div key={t.id} className="mu-toast-card">
                <div className="mu-toast-icon-wrap">
                  <span className="mu-toast-icon">✓</span>
                </div>
                <div className="mu-toast-msg">
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
              <button className="mu-modal-close" onClick={() => { setShowForm(false); setError(''); setFieldErrors({}); }}><X size={18} /></button>
            </div>
            {error && <div className="mu-alert-error">{error}</div>}
            <form onSubmit={handleCreate} noValidate>
              <div className="mu-form-grid">
                <label>
                  <span>Username *</span>
                  <input type="text" className={`mu-input ${fieldErrors.username ? 'error' : ''}`} value={username} onChange={(e) => setUsername(e.target.value.trim())} autoFocus maxLength={30} />
                  {fieldErrors.username && <p className="mu-field-error">Please enter a username</p>}
                </label>
                <label>
                  <span>Full Name *</span>
                  <input type="text" className={`mu-input ${fieldErrors.fullName ? 'error' : ''}`} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={30} />
                  {fieldErrors.fullName && <p className="mu-field-error">Please enter a full name</p>}
                </label>
                {role === 'admin' && (
                  <label>
                    <span>Email *</span>
                    <input type="email" className={`mu-input ${fieldErrors.email ? 'error' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={50} />
                    {fieldErrors.email && <p className="mu-field-error">Please enter a valid email</p>}
                  </label>
                )}
                <label>
                  <span>Role *</span>
                    <select className="mu-select" value={role} onChange={(e) => { setRole(e.target.value); if (e.target.value === 'agent') setEmail(''); }}>
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