import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { Eye, EyeOff, Sun, Moon, Volume2 } from 'lucide-react';
import Sidebar from '../components/Sidebar';

export default function Profile() {
  const { user, token, logout, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  // --- TV Display Voice Settings ---
  const [voiceOptions, setVoiceOptions] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [voiceMsg, setVoiceMsg] = useState('');

  // --- Avatar Style ---
const [avatarStyles, setAvatarStyles] = useState([]);

  // --- Avatar Face (always avataaars style, different seeds = different faces) ---
  function randomSeed() {
    return Math.random().toString(36).slice(2, 10);
  }

  const [avatarSeed, setAvatarSeed] = useState(user?.avatar_seed || user.full_name);
  const [pendingSeed, setPendingSeed] = useState(user?.avatar_seed || user.full_name);
  const [seedOptions, setSeedOptions] = useState(() =>
    Array.from({ length: 8 }, () => randomSeed())
  );
  const [avatarMsg, setAvatarMsg] = useState('');
  const [avatarSaving, setAvatarSaving] = useState(false);

  function regenerateOptions() {
    setSeedOptions(Array.from({ length: 8 }, () => randomSeed()));
  }

  async function saveAvatarSeed() {
    setAvatarSaving(true);
    try {
      const res = await fetch('/api/auth/avatar-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarSeed: pendingSeed })
      });
      const data = await res.json();
      if (data.success) {
        setAvatarSeed(pendingSeed);
        updateUser({ avatar_seed: pendingSeed });
        setAvatarMsg('Avatar updated.');
      } else {
        setAvatarMsg(data.error || 'Failed to update avatar.');
      }
    } catch (err) {
      setAvatarMsg('Network error. Please try again.');
    }
    setAvatarSaving(false);
    setTimeout(() => setAvatarMsg(''), 2500);
  }

  useEffect(() => {
    if (!socket) return;
    function onVoicesUpdate(voices) {
      setVoiceOptions(voices || []);
    }
    function onVoiceSettingsUpdate(settings) {
      if (settings.voiceURI) setSelectedVoiceURI(settings.voiceURI);
    }
    socket.on('available_voices_update', onVoicesUpdate);
    socket.on('voice_settings_update', onVoiceSettingsUpdate);
    return () => {
      socket.off('available_voices_update', onVoicesUpdate);
      socket.off('voice_settings_update', onVoiceSettingsUpdate);
    };
  }, [socket]);

  function saveVoiceSetting() {
    socket?.emit('update_voice_settings', { voiceURI: selectedVoiceURI });
    setVoiceMsg('Voice settings updated for TV Display.');
    setTimeout(() => setVoiceMsg(''), 2500);
  }

  function testVoiceDisplay() {
    socket?.emit('trigger_test_voice');
    setVoiceMsg('Test announcement triggered on TV Display.');
    setTimeout(() => setVoiceMsg(''), 2500);
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
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
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to change password.');
        setLoading(false);
        return;
      }

      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setLoading(false);

      if (user?.is_first_login) {
        updateUser({ is_first_login: false });
        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  if (!user) return null;

  if (user.is_first_login) {
    return (
      <>
        <style>{`
          .fl-body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg-color);
            padding: 20px;
            font-family: 'Inter', Arial, sans-serif;
          }
          .fl-card {
            width: 420px;
            max-width: 100%;
            background: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 28px 26px;
          }
                    .fl-title { margin: 0 0 6px 0; color: var(--text-main); font-size: 19px; font-weight: 800; }
          .fl-sub { margin: 0 0 18px 0; color: var(--text-muted); font-size: 12.5px; line-height: 1.5; }

          .pf-alert-error {
            background: rgba(220,38,38,0.1);
            border: 1px solid rgba(220,38,38,0.4);
            color: var(--red);
            padding: 11px 14px;
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 13px;
          }
          .pf-alert-success {
            background: rgba(30,142,90,0.12);
            border: 1px solid rgba(30,142,90,0.4);
            color: #1e8e5a;
            padding: 11px 14px;
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 13px;
          }
          .pf-field { display: block; margin-bottom: 10px; }
          .pf-field-label { display: block; color: var(--text-main); font-size: 12px; margin-bottom: 6px; letter-spacing: 0.4px; }
          .pf-input-wrap { position: relative; }
          .pf-input {
            width: 100%;
            padding: 10px 40px 10px 12px;
            box-sizing: border-box;
            background: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            color: var(--text-main);
            font-size: 13.5px;
            outline: none;
          }
          .pf-eye-btn {
            position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
            background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;
            display: flex; align-items: center;
          }
          .pf-eye-btn:hover { color: var(--text-main); }
          .pf-btn-primary {
            width: 100%; padding: 11px; background: #F0A500; color: #0b1f4d;
            border: none; border-radius: 8px; cursor: pointer; font-weight: 700;
            font-size: 13.5px; margin-bottom: 12px;
          }
          .pf-btn-primary:hover { background: #ffb800; }
          .pf-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
          .pf-btn-logout {
            width: 100%; padding: 11px; background: transparent; color: var(--red);
            border: 1px solid rgba(220,38,38,0.4); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13.5px;
          }
          .pf-btn-logout:hover { background: rgba(220,38,38,0.1); }
        `}</style>
        <div className="fl-body">
          <div className="fl-card">
            <h2 className="fl-title">Set a New Password</h2>
            <p className="fl-sub">This is your first login. You must set a new password before you can access the system.</p>

            {error && <div className="pf-alert-error">{error}</div>}
            {success && <div className="pf-alert-success">{success}</div>}

            <form onSubmit={handleChangePassword}>
              <label className="pf-field">
                <span className="pf-field-label">Current Password</span>
                <div className="pf-input-wrap">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="pf-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <button type="button" className="pf-eye-btn" onClick={() => setShowCurrentPassword(s => !s)} tabIndex={-1}>
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

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

              <button type="submit" className="pf-btn-primary" disabled={loading} style={{ marginTop: 6 }}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <button type="button" className="pf-btn-logout" onClick={handleLogout} style={{ marginTop: 0 }}>
              Log Out
            </button>
          </div>
        </div>
      </>
    );
  }

return (
    <>
      <style>{`
        .pf-body {
          min-height: 100vh;
          background: var(--bg-color);
          padding: 20px 16px;
          font-family: 'Inter', Arial, sans-serif;
        }
        .pf-card {
          max-width: 860px;
          margin: 0 auto;
          background: var(--panel-bg);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 22px 26px;
        }
        .pf-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          align-items: start;
        }
        .pf-col-divider {
          border-left: 1px solid var(--border-color);
          padding-left: 32px;
        }
        @media (max-width: 768px) {
          .pf-card { max-width: 100%; padding: 24px 20px; }
          .pf-columns { grid-template-columns: 1fr; gap: 0; }
          .pf-col-divider { border-left: none; padding-left: 0; border-top: 1px solid var(--border-color); padding-top: 22px; margin-top: 4px; }
        }
        .pf-title { margin: 0 0 14px 0; color: var(--text-main); font-size: 18px; letter-spacing: 0.3px; }
        .pf-info-block { margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid var(--border-color); }
        .pf-label { margin: 0 0 4px 0; color: var(--text-muted); font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; }
        .pf-value { margin: 0 0 14px 0; color: var(--text-main); font-size: 14.5px; font-weight: 600; }
        .pf-role-badge {
          display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
          padding: 4px 10px; border-radius: 5px; text-transform: uppercase;
        }
        .pf-warning {
          background: rgba(240,165,0,0.12);
          border-left: 4px solid #f0a500;
          color: #b7860b;
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 20px;
          font-size: 13px;
          line-height: 1.5;
        }
                .pf-subtitle { font-size: 14px; color: var(--text-main); margin: 0 0 8px 0; }
        .pf-alert-error {
          background: rgba(220,38,38,0.1);
          border: 1px solid rgba(220,38,38,0.4);
          color: var(--red);
          padding: 11px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .pf-alert-success {
          background: rgba(30,142,90,0.12);
          border: 1px solid rgba(30,142,90,0.4);
          color: #1e8e5a;
          padding: 11px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .pf-field { display: block; margin-bottom: 10px; }
        .pf-field-label { display: block; color: var(--text-main); font-size: 12px; margin-bottom: 6px; letter-spacing: 0.4px; }
        .pf-input-wrap { position: relative; }
        .pf-input {
          width: 100%;
          padding: 10px 40px 10px 12px;
          box-sizing: border-box;
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-main);
          font-size: 13.5px;
          outline: none;
        }
        .pf-eye-btn {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;
          display: flex; align-items: center;
        }
        .pf-eye-btn:hover { color: var(--text-main); }
        .pf-btn-primary {
          width: 100%; padding: 11px; background: #F0A500; color: #0b1f4d;
          border: none; border-radius: 8px; cursor: pointer; font-weight: 700;
          font-size: 13.5px; margin-bottom: 12px;
        }
        .pf-btn-primary:hover { background: #ffb800; }
        .pf-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .pf-btn-logout {
          width: 100%; padding: 11px; background: transparent; color: var(--red);
          border: 1px solid rgba(220,38,38,0.4); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13.5px;
        }
        .pf-btn-logout:hover { background: rgba(220,38,38,0.1); }
        .pf-theme-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px; border-radius: 8px; background: var(--bg-color);
          border: 1px solid var(--border-color); margin-bottom: 4px;
        }
        .pf-theme-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 6px; font-size: 12.5px; font-weight: 600;
          cursor: pointer; border: 1px solid var(--border-color); background: var(--panel-bg); color: var(--text-muted);
        }
        .pf-theme-btn.active { background: #F0A500; color: #0b1f4d; border-color: #F0A500; }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar
          user={user}
          activePath={location.pathname}
          onNavigate={navigate}
          onLogout={handleLogout}
        />
        <div className="pf-body" style={{ flex: 1, minWidth: 0 }}>
        <div className="pf-card">
          <h2 className="pf-title">My Profile</h2>

          {/* User Info Section */}
          <div className="pf-info-block" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <img
                            src={`https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`}
              alt={user.full_name}
              style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--border-color)', flexShrink: 0 }}
            />
            <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <p className="pf-label" style={{ margin: 0 }}>Full Name</p>
              <span className="pf-role-badge" style={{ fontSize: 9.5, padding: '2px 8px', background: user.role === 'admin' ? '#f0a500' : '#1e3a6e', color: user.role === 'admin' ? '#1a1a1a' : '#c9d4ec' }}>
                {user.role}
              </span>
            </div>
            <p className="pf-value">{user.full_name}</p>

            <p className="pf-label">Email</p>
            <p className="pf-value" style={{ marginBottom: 0 }}>{user.email}</p>
            </div>
          </div>

          {/* First Login Warning */}
          {user.is_first_login && (
            <div className="pf-warning">
              This is your first login. Please set a new password before continuing.
            </div>
          )}

          <div className="pf-columns">
            {/* LEFT COLUMN: Appearance + TV Display Sound */}
            <div>
              <h3 className="pf-subtitle">Appearance</h3>
              <div className="pf-theme-row" style={{ marginBottom: 10, padding: '6px 14px' }}>
                <span className="pf-field-label" style={{ margin: 0 }}>Theme</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={`pf-theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>
                    <Sun size={14} /> Light
                  </button>
                  <button type="button" className={`pf-theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>
                    <Moon size={14} /> Dark
                  </button>
                </div>
              </div>

              <h3 className="pf-subtitle" style={{ marginBottom: 10 }}>Choose Your Avatar</h3>
              {avatarMsg && <div className="pf-alert-success">{avatarMsg}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {seedOptions.map(seed => (
                  <div
                    key={seed}
                    onClick={() => setPendingSeed(seed)}
                    style={{
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 8,
                      border: pendingSeed === seed ? '2px solid #F0A500' : '1px solid var(--border-color)',
                      background: 'var(--bg-color)'
                    }}
                  >
                    <img
                      src={`https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(seed)}`}
                      alt="Avatar option"
                      style={{ width: 34, height: 34, borderRadius: '50%', display: 'block' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button type="button" className="pf-theme-btn" onClick={regenerateOptions}>
                  Regenerate
                </button>
                <button
                  type="button"
                  className="pf-btn-primary"
                  style={{ margin: 0, flex: 1 }}
                  disabled={avatarSaving || pendingSeed === avatarSeed}
                  onClick={saveAvatarSeed}
                >
                  {avatarSaving ? 'Saving...' : 'Save Avatar'}
                </button>
              </div>

              <h3 className="pf-subtitle">TV Display Sound</h3>
              {voiceMsg && <div className="pf-alert-success">{voiceMsg}</div>}
              <div>
                <label className="pf-field" style={{ marginBottom: 10 }}>
                  <span className="pf-field-label">Selected Voice</span>
                  <select className="pf-input" style={{ paddingRight: 12 }} value={selectedVoiceURI} onChange={e => setSelectedVoiceURI(e.target.value)}>
                    <option value="">{voiceOptions.length === 0 ? 'Waiting for TV Display to connect...' : '-- Let System Decide --'}</option>
                    {voiceOptions.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                  </select>
                </label>
                <p style={{ margin: '0 0 8px 0', fontSize: 10.5, color: 'var(--text-muted)' }}>
                  These voices come from the browser running the TV Display. If the list is empty, open the TV Display tab and refresh it. For human-like neural voices, run the TV Display on Microsoft Edge.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="pf-theme-btn" onClick={testVoiceDisplay}>
                    <Volume2 size={14} /> Test Sound
                  </button>
                  <button type="button" className="pf-btn-primary" style={{ margin: 0, flex: 1 }} onClick={saveVoiceSetting}>
                    Save Voice
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Change Password */}
            <div className="pf-col-divider">
              <h3 className="pf-subtitle">Change Password</h3>

              {error && <div className="pf-alert-error">{error}</div>}
              {success && <div className="pf-alert-success">{success}</div>}

              <form onSubmit={handleChangePassword}>
                <label className="pf-field">
                  <span className="pf-field-label">Current Password</span>
                  <div className="pf-input-wrap">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      className="pf-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="pf-eye-btn" onClick={() => setShowCurrentPassword(s => !s)} tabIndex={-1}>
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

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
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}