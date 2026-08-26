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

function UserRow({ u, onDeactivate, onReactivate, onEdit }) {
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
    <tr className={`${!isActive ? 'ur-inactive' : ''} ${u.is_locked ? 'ur-locked' : ''}`}>
      <td>
        <div className="ur-user-cell">
          <img
            className="ur-avatar"
            src={`https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(u.avatar_seed || u.full_name || u.username)}`}
            alt={u.full_name || u.username}
          />
          <div className="ur-name-block">
            <p className="ur-name">{u.username}</p>
            <p className="ur-role">{u.role}{u.is_locked ? ' · LOCKED' : ''}</p>
          </div>
        </div>
      </td>
      <td>{u.full_name}</td>
      <td>
        <div className="ur-email-cell">
          <Mail size={13} />
          <span>{u.email || 'No email on file'}</span>
        </div>
      </td>
      <td>{formatDate(u.created_at)}</td>
      <td>
        {isActive ? (
          <span className="ur-status-text active">
            {u.is_first_login ? 'Password not set' : 'Active'}
          </span>
        ) : (
          <span className="ur-status-text inactive">
            Deactivated {daysDeactivated}d ago · auto-deletes in {daysLeft}d
          </span>
        )}
      </td>
      <td style={{ textAlign: 'center' }}>
        <div className="ur-menu-wrap" ref={menuRef}>
          <button className="ur-menu-btn" onClick={() => setMenuOpen(m => !m)}>
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="ur-menu-dropdown">
              <button className="ur-menu-item" onClick={() => { setMenuOpen(false); onEdit(u); }}>
                <User size={14} /> Edit Username
              </button>
              {isActive ? (
                <button className="ur-menu-item danger" onClick={() => { setMenuOpen(false); onDeactivate(u.id, u.username); }}>
                  <UserX size={14} /> Deactivate
                </button>
              ) : (
                <button className="ur-menu-item" onClick={() => { setMenuOpen(false); onReactivate(u.id, u.username); }}>
                  <UserCheck size={14} /> Reactivate
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function ManageUsers() {
  const { user, token, logout, updateUser } = useAuth();
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
  const usersPerPage = 8;
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

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

 const filteredUsers = users.filter(u => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });
  const sortedUsers = [...filteredUsers].sort((a, b) => (b.is_locked ? 1 : 0) - (a.is_locked ? 1 : 0));
  const totalPages = Math.ceil(sortedUsers.length / usersPerPage);
  const paginatedUsers = sortedUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter]);
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

      setCreatedInfo({ username: data.data.username, password: data.defaultPassword, role });
      showToast('Account created! Share these credentials with the user directly.');
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
        }
        .mu-btn-primary:hover { background: #ffb800; }

        .mu-page-nav {
          display: flex;
          align-items: center;
          gap: 4px;
          background: var(--panel-bg);
          border: 1px solid var(--border-color);
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

        .mu-page-number {
          min-width: 28px; height: 28px;
          padding: 0 6px;
          display: flex; align-items: center; justify-content: center;
          background: transparent;
          border: none;
          border-radius: 5px;
          color: var(--text-muted);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .mu-page-number:hover { background: rgba(240,165,0,0.15); color: #F0A500; }
        .mu-page-number[data-active="true"] { background: #F0A500; color: #0b1f4d; }
        .mu-alert-error {
          background: rgba(220,38,38,0.1);
          border: 1px solid rgba(220,38,38,0.4);
          color: var(--red);
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
        }
        .mu-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
        .mu-modal .mu-alert-error { margin-bottom: 16px; }
        .mu-modal-header h3 { margin: 0; color: var(--text-main); font-size: 17px; }
        .mu-modal-close { background: none; border: none; color: var(--text-muted); cursor: pointer; }
        .mu-form-grid { display: flex; flex-direction: column; gap: 14px; margin-bottom: 18px; }
        .mu-form-grid label span { display: block; color: var(--text-main); font-size: 12px; margin-bottom: 6px; letter-spacing: 0.4px; }
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
        .mu-input.error, .mu-select.error { border-color: var(--red); background: rgba(220,38,38,0.08); }
        .mu-field-error { margin: 6px 0 0 0; color: var(--red); font-size: 11.5px; }

        /* ---- User table ---- */
        .mu-table-wrap {
          background: var(--panel-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          overflow: hidden;
        }
        .mu-table-scroll { overflow-x: auto; }
        .ur-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
        }
        .ur-table thead th {
          text-align: left;
          padding: 12px 16px;
          font-size: 11px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-color);
          white-space: nowrap;
        }
        .ur-table tbody td {
          padding: 12px 16px;
          font-size: 13px;
          color: var(--text-main);
          border-bottom: 1px solid var(--border-color);
          vertical-align: middle;
        }
        .ur-table tbody tr:last-child td { border-bottom: none; }
        .ur-table tbody tr:hover td { background: var(--table-hover); }
        .ur-table tbody tr.ur-inactive td { opacity: 0.65; }
        .ur-table tbody tr.ur-locked td:first-child { box-shadow: inset 3px 0 0 rgba(240,165,0,0.7); }

        .ur-user-cell { display: flex; align-items: center; gap: 10px; }
        .ur-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          object-fit: cover;
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .ur-name-block { min-width: 0; }
        .ur-name { margin: 0; color: var(--text-main); font-size: 13.5px; font-weight: 700; white-space: nowrap; }
        .ur-role { margin: 2px 0 0 0; color: #F0A500; font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase; font-weight: 600; }

        .ur-email-cell { display: flex; align-items: center; gap: 7px; color: var(--text-main); white-space: nowrap; }

        .ur-status-text.active { color: #16a34a; font-weight: 600; white-space: nowrap; }
        .ur-status-text.inactive { color: var(--red); font-weight: 600; white-space: nowrap; }

        .ur-menu-wrap { position: relative; display: inline-block; }
        .ur-menu-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 5px; }
        .ur-menu-btn:hover { background: var(--table-hover); color: var(--text-main); }
        .ur-menu-dropdown {
          position: absolute; right: 0; top: 28px; z-index: 10;
          background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 8px;
          min-width: 140px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.25);
        }
        .ur-menu-item {
          display: flex; align-items: center; gap: 8px; width: 100%;
          padding: 9px 12px; background: none; border: none; color: var(--text-main); font-size: 12.5px; cursor: pointer; text-align: left;
        }
        .ur-menu-item.danger { color: var(--red); }
        .ur-menu-item:hover { background: var(--table-hover); }
        .ur-menu-item.danger:hover { background: rgba(220,38,38,0.12); }

        .uc-empty { color: var(--text-muted); font-size: 13.5px; padding: 40px; text-align: center; }

        /* ---- Confirm modal ---- */
        .mu-confirm-modal {
          background: var(--panel-bg);
          border: 1px solid rgba(220,38,38,0.35);
          border-radius: 12px;
          padding: 26px;
          width: 380px;
          max-width: 100%;
          text-align: center;
        }
        .mu-confirm-icon {
          width: 46px; height: 46px; border-radius: 50%;
          background: rgba(220,38,38,0.12);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          color: var(--red);
        }
        .mu-confirm-modal h3 { margin: 0 0 8px 0; color: var(--text-main); font-size: 16px; }
        .mu-confirm-modal p { margin: 0 0 22px 0; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
        .mu-confirm-modal p strong { color: var(--text-main); }
        .mu-confirm-actions { display: flex; gap: 10px; }
        .mu-btn-cancel {
          flex: 1; padding: 10px 16px;
          background: var(--btn-bg);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
        }
        .mu-btn-cancel:hover { background: var(--table-hover); }
        .mu-btn-danger {
          flex: 1; padding: 10px 16px;
          background: var(--red);
          border: none;
          color: #fff;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
        }
        .mu-btn-danger:hover { opacity: 0.9; }
        .mu-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 700px) {
          .mu-main { padding: 20px 16px 40px; }
        }

       @media (max-width: 480px) {
          .mu-main { padding: 16px 12px 32px; }
          .mu-header { flex-direction: column; align-items: flex-start; gap: 10px; }
          .mu-header h2 { font-size: 18px; }
          .mu-btn-primary { width: 100%; justify-content: center; font-size: 13px; padding: 10px; }
          .mu-page-nav { align-self: flex-end; }
          .mu-modal { padding: 18px; }
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
                  <div key={r.id} style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <p style={{ margin: 0, color: 'var(--text-main)', fontWeight: 600, fontSize: 13.5 }}>
                        {r.users?.full_name} ({r.users?.username})
                      </p>
                      <p style={{ margin: '3px 0 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
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

          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              type="text"
              className="mu-input"
              placeholder="Search by username, full name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              maxLength={30}
              style={{ flex: 1, minWidth: 200, color: 'var(--text-main)', background: 'var(--panel-bg)' }}
            />
            <select
              className="mu-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ width: 140 }}
            >

              <option value="all">All Roles</option>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="mu-table-wrap" style={{ minHeight: 8 * 57 + 45 }}>
            <div className="mu-table-scroll">
              <table className="ur-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Date Added</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="uc-empty">Loading...</td></tr>
                  ) : sortedUsers.length === 0 ? (
                    <tr><td colSpan={6} className="uc-empty">{users.length === 0 ? 'No accounts yet.' : 'No accounts match your search/filter.'}</td></tr>
                  ) : (
                    paginatedUsers.map(u => (
                      <UserRow key={u.id} u={u} onDeactivate={handleDeactivate} onReactivate={handleReactivate} onEdit={openEditModal} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, minHeight: 44 }}>
            {!loading && totalPages > 1 && (
              <div className="mu-page-nav">
                <button
                  className="mu-page-arrow"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                  <button
                    key={pageNum}
                    className="mu-page-number"
                    data-active={pageNum === currentPage}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  className="mu-page-arrow"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
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
            <p style={{ color: 'var(--text-main)', fontSize: 13, margin: '0 0 16px 0' }}>
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
      
      {createdInfo && (
        <div className="mu-modal-overlay" onClick={() => setCreatedInfo(null)}>
          <div className="mu-modal" onClick={e => e.stopPropagation()} style={{ width: 380 }}>
            <div className="mu-modal-header">
              <h3>Account Created</h3>
              <button className="mu-modal-close" onClick={() => setCreatedInfo(null)}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--text-main)', fontSize: 13, margin: '0 0 14px 0' }}>
              Give these credentials to the user directly (no email needed):
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