import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export default function Profile() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to change password.');
        setLoading(false);
        return;
      }

      setSuccess('Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
      setLoading(false);

      if (user?.is_first_login) {
        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

return (
    <>
      <style>{`
        .pf-body {
          min-height: 100vh;
          background: radial-gradient(circle at 50% 0%, #142d6e 0%, #050e1d 60%);
          padding: 50px 16px;
          font-family: 'Inter', Arial, sans-serif;
        }
        .pf-card {
          max-width: 460px;
          margin: 0 auto;
          background: #0d234f;
          border: 1px solid rgba(240,165,0,0.18);
          border-radius: 14px;
          padding: 34px 30px;
        }
        .pf-title { margin: 0 0 22px 0; color: #fff; font-size: 20px; letter-spacing: 0.3px; }
        .pf-info-block { margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .pf-label { margin: 0 0 4px 0; color: #5c6f94; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; }
        .pf-value { margin: 0 0 14px 0; color: #e6ecf7; font-size: 14.5px; font-weight: 600; }
        .pf-role-badge {
          display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
          padding: 4px 10px; border-radius: 5px; text-transform: uppercase;
        }
        .pf-warning {
          background: rgba(240,165,0,0.12);
          border-left: 4px solid #f0a500;
          color: #f0c674;
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 20px;
          font-size: 13px;
          line-height: 1.5;
        }
        .pf-subtitle { font-size: 15px; color: #fff; margin: 0 0 16px 0; }
        .pf-alert-error {
          background: rgba(138,31,31,0.2);
          border: 1px solid rgba(138,31,31,0.5);
          color: #ff8a8a;
          padding: 11px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .pf-alert-success {
          background: rgba(30,122,60,0.18);
          border: 1px solid rgba(30,122,60,0.5);
          color: #8fe0a8;
          padding: 11px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .pf-field { display: block; margin-bottom: 16px; }
        .pf-field-label { display: block; color: #c9d4ec; font-size: 12px; margin-bottom: 6px; letter-spacing: 0.4px; }
        .pf-input-wrap { position: relative; }
        .pf-input {
          width: 100%;
          padding: 10px 40px 10px 12px;
          box-sizing: border-box;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(240,165,0,0.3);
          border-radius: 6px;
          color: #fff;
          font-size: 13.5px;
          outline: none;
        }
        .pf-eye-btn {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: #8092b8; cursor: pointer; padding: 2px;
          display: flex; align-items: center;
        }
        .pf-eye-btn:hover { color: #fff; }
        .pf-btn-primary {
          width: 100%; padding: 11px; background: #F0A500; color: #0b1f4d;
          border: none; border-radius: 8px; cursor: pointer; font-weight: 700;
          font-size: 13.5px; margin-bottom: 12px;
        }
        .pf-btn-primary:hover { background: #ffb800; }
        .pf-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .pf-btn-logout {
          width: 100%; padding: 11px; background: transparent; color: #ff8a8a;
          border: 1px solid rgba(224,75,75,0.4); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13.5px;
        }
        .pf-btn-logout:hover { background: rgba(224,75,75,0.1); }
      `}</style>

      <div className="pf-body">
        <div className="pf-card">
          <h2 className="pf-title">My Profile</h2>

          {/* User Info Section */}
          <div className="pf-info-block">
            <p className="pf-label">Full Name</p>
            <p className="pf-value">{user.full_name}</p>

            <p className="pf-label">Email</p>
            <p className="pf-value">{user.email}</p>

            <p className="pf-label" style={{ marginBottom: 6 }}>Role</p>
            <span className="pf-role-badge" style={{ background: user.role === 'admin' ? '#f0a500' : '#1e3a6e', color: user.role === 'admin' ? '#1a1a1a' : '#c9d4ec' }}>
              {user.role}
            </span>
          </div>

          {/* First Login Warning */}
          {user.is_first_login && (
            <div className="pf-warning">
              This is your first login. Please set a new password before continuing.
            </div>
          )}

          {/* Change Password Form */}
          <h3 className="pf-subtitle">Change Password</h3>

          {error && <div className="pf-alert-error">{error}</div>}
          {success && <div className="pf-alert-success">{success}</div>}

          <form onSubmit={handleChangePassword}>
            <label className="pf-field">
              <span className="pf-field-label">New Password</span>
              <div className="pf-input-wrap">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="pf-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button type="button" className="pf-eye-btn" onClick={() => setShowNewPassword(s => !s)} tabIndex={-1}>
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="pf-field">
              <span className="pf-field-label">Confirm New Password</span>
              <div className="pf-input-wrap">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="pf-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button type="button" className="pf-eye-btn" onClick={() => setShowConfirmPassword(s => !s)} tabIndex={-1}>
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <button type="submit" className="pf-btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <button onClick={handleLogout} className="pf-btn-logout">
            Logout
          </button>
        </div>
      </div>
    </>
  );
}