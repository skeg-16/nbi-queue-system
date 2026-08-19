import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot-username' | 'forgot-email' | 'forgot-otp' | 'forgot-newpass'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Forgot password flow state
  const [fpUsername, setFpUsername] = useState('');
  const [fpRole, setFpRole] = useState(null); // 'agent' | 'admin', detected after username step
  const [fpEmail, setFpEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const resetMessages = () => { setError(''); setInfo(''); setLocked(false); };

  useEffect(() => {
    if (mode !== 'forgot-otp' || otpSecondsLeft <= 0) return;
    const timer = setInterval(() => setOtpSecondsLeft(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [mode, otpSecondsLeft]);

  const formatOtpTimer = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Login failed');
        if (data.locked) setLocked(true);
        setPassword('');
        setLoading(false);
        return;
      }

      login(data.token, data.user);

      if (data.user.is_first_login) {
        navigate('/profile');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleForgotUsername = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fpUsername })
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Username not found.');
        setLoading(false);
        return;
      }

      setFpRole(data.role);
      setLoading(false);

      if (data.role === 'admin') {
        // Admin: OTP is sent straight to the registered admin email
        setInfo(data.message || 'A reset code has been sent to your registered email.');
        setOtpSecondsLeft(180);
        setMode('forgot-otp');
      } else {
        // Agent: ask for email first, OTP sent after that step
        setMode('forgot-email');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleForgotEmail = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fpUsername, email: fpEmail })
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Unable to send code to that email.');
        setLoading(false);
        return;
      }

      setInfo(data.message || 'A reset code has been sent to your email.');
      setOtpSecondsLeft(180);
      setMode('forgot-otp');
      setLoading(false);
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    resetMessages();
    setLoading(true);
    try {
      const endpoint = fpRole === 'admin' ? '/api/auth/forgot-password/init' : '/api/auth/forgot-password/send-otp';
      const body = fpRole === 'admin' ? { username: fpUsername } : { username: fpUsername, email: fpEmail };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Unable to resend code.');
        setLoading(false);
        return;
      }

      setOtp('');
      setOtpSecondsLeft(180);
      setInfo(data.message || 'A new code has been sent.');
      setLoading(false);
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fpUsername, otp })
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Invalid or expired code.');
        setLoading(false);
        return;
      }

      setMode('forgot-newpass');
      setLoading(false);
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    resetMessages();

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
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fpUsername, otp, newPassword })
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to reset password.');
        setLoading(false);
        return;
      }

      // Auto-login straight to dashboard after a successful reset
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const backToLogin = () => {
    resetMessages();
    setMode('login');
    setFpUsername('');
    setFpRole(null);
    setFpEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <>
      <style>{`
        .login-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          padding: 24px;
          font-family: 'Inter', Arial, sans-serif;
          background:
            radial-gradient(circle at 15% 15%, rgba(240,165,0,0.10), transparent 55%),
            radial-gradient(circle at 88% 92%, rgba(63,168,150,0.10), transparent 55%),
            var(--bg-color);
        }

        .login-card {
          width: 920px;
          max-width: 100%;
          min-height: 560px;
          background: var(--panel-bg);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.35);
          display: flex;
          overflow: hidden;
        }

        /* ---------- Left visual / branding panel ---------- */
        .login-visual {
          flex: 1 1 46%;
          position: relative;
          min-width: 0;
          padding: 32px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          background:
            radial-gradient(circle at 20% 20%, rgba(255,255,255,0.05), transparent 2px) 0 0/22px 22px,
            linear-gradient(160deg, #0b1f4d 0%, #081533 60%, #050b18 100%);
        }

        .login-visual-brand { display: flex; align-items: center; gap: 12px; z-index: 2; position: relative; }
        .login-visual-brand img { width: 52px; height: 52px; object-fit: contain; flex-shrink: 0; }
        .login-visual-brand-text p { margin: 0; color: #F0A500; font-weight: 800; font-size: 15px; letter-spacing: 0.4px; line-height: 1.3; }
        .login-visual-brand-text span { color: #9fb0d1; font-size: 11px; letter-spacing: 0.5px; }

        .login-visual-seal {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          z-index: 1;
          position: relative;
        }
        .login-visual-seal::before {
          content: '';
          position: absolute;
          width: 280px; height: 280px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(240,165,0,0.14) 0%, transparent 70%);
        }
        .login-visual-seal img { width: 180px; height: 180px; object-fit: contain; position: relative; z-index: 1; filter: drop-shadow(0 8px 24px rgba(0,0,0,0.4)); }

        .login-visual-copy { position: relative; z-index: 2; }
        .login-visual-copy h1 { margin: 0 0 10px 0; color: #fff; font-size: 25px; line-height: 1.3; font-weight: 800; }
        .login-visual-copy h1 span { color: #F0A500; }
        .login-visual-copy p { margin: 0; color: #9fb0d1; font-size: 12.5px; line-height: 1.6; max-width: 320px; }

        /* ---------- Right form panel ---------- */
        .login-form-panel {
          flex: 1 1 54%;
          min-width: 0;
          padding: 40px 44px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .login-form-header { margin-bottom: 22px; }
        .login-form-header h2 { margin: 0; color: var(--text-main); font-size: 23px; font-weight: 800; }
        .login-form-header p { margin: 6px 0 0 0; color: var(--text-muted); font-size: 12.5px; line-height: 1.5; }
        .login-form-header p.uppercase-sub { text-transform: uppercase; letter-spacing: 1px; font-size: 11.5px; }

        .login-alert { padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
        .login-alert.error { background: rgba(194,63,63,0.12); border: 1px solid rgba(194,63,63,0.35); color: #c23f3f; }
        .login-alert.info { background: rgba(63,168,96,0.14); border: 1px solid rgba(63,168,96,0.4); color: #2f8a52; }
        .login-alert .lock-note { margin-top: 6px; font-size: 12px; color: #b8860b; }

        .login-label { display: block; margin-bottom: 14px; }
        .login-label span { display: block; color: var(--text-muted); font-size: 11px; margin-bottom: 6px; letter-spacing: 0.6px; font-weight: 700; }

        .login-input {
          width: 100%; padding: 12px 14px; box-sizing: border-box;
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: var(--text-main);
          font-size: 14px;
          outline: none;
          transition: border-color .15s ease;
        }
        .login-input:focus { border-color: #F0A500; }
        .login-input-wrap { position: relative; }
        .login-eye-btn {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex;
        }
        .login-otp-input { letter-spacing: 6px; text-align: center; font-size: 18px; font-weight: 700; }

        .login-forgot-row { text-align: right; margin-bottom: 18px; }
        .login-link-btn { background: none; border: none; color: #F0A500; font-size: 12.5px; cursor: pointer; padding: 0; font-weight: 700; }

        .login-submit-btn {
          width: 100%; padding: 13px; border: none; border-radius: 10px;
          background: #F0A500; color: #0b1f4d; font-weight: 800; font-size: 14px;
          letter-spacing: 0.4px; cursor: pointer;
        }
        .login-submit-btn:disabled { background: #a37a2a; cursor: default; }
        .login-submit-btn:hover:not(:disabled) { background: #ffb800; }

        .login-secondary-btn {
          width: 100%; padding: 11px; border-radius: 10px; background: transparent;
          border: 1px solid var(--border-color); color: var(--text-muted); font-size: 13px; cursor: pointer; margin-top: 10px;
        }
        .login-secondary-btn:hover { background: rgba(240,165,0,0.06); }

        .login-text-link-center { text-align: center; margin-top: 16px; }
        .login-underline-btn { background: none; border: none; color: var(--text-muted); font-size: 11.5px; cursor: pointer; padding: 0; text-decoration: underline; }

        .login-divider { display: flex; align-items: center; gap: 10px; margin-top: 22px; }
        .login-divider::before, .login-divider::after { content: ''; flex: 1; height: 1px; background: var(--border-color); }
        .login-divider span { color: var(--text-muted); font-size: 9.5px; letter-spacing: 1.5px; text-transform: uppercase; white-space: nowrap; }

        /* ---------- Responsive ---------- */
        @media (max-width: 860px) {
          .login-card { flex-direction: column; min-height: 0; }
          .login-visual { flex: none; min-height: 130px; padding: 22px 24px; }
          .login-visual-seal, .login-visual-copy { display: none; }
          .login-form-panel { padding: 28px 24px 32px; }
        }

        @media (max-width: 480px) {
          .login-page { padding: 12px; }
          .login-card { border-radius: 14px; }
          .login-visual { min-height: 96px; padding: 18px 20px; }
          .login-visual-brand-text p { font-size: 12px; }
          .login-visual-brand-text span { font-size: 9.5px; }
          .login-form-panel { padding: 22px 18px 26px; }
          .login-form-header h2 { font-size: 19px; }
        }
      `}</style>

      <div className="login-page">
        <div className="login-card">
          {/* ---------- Left: branding / visual ---------- */}
          <div className="login-visual">
            <div className="login-visual-brand">
              <img src="/assets/nbi.png" alt="NBI Logo" />
              <div className="login-visual-brand-text">
                <p>National Bureau of Investigation</p>
                <span>CYBERCRIME DIVISION</span>
              </div>
            </div>

            <div className="login-visual-seal">
              <img src="/assets/ccd.png" alt="" />
            </div>

            <div className="login-visual-copy">
              <h1>Nobility. Bravery.<br /><span>Integrity.</span></h1>
              <p>Restricted access portal for NBI Cybercrime Division personnel only. All activity on this system is monitored and logged.</p>
            </div>
          </div>

          {/* ---------- Right: form ---------- */}
          <div className="login-form-panel">
            {error && (
              <div className="login-alert error">
                {error}
                {locked && (
                  <div className="lock-note">
                    A request has been sent to your administrator to unlock this account.
                  </div>
                )}
              </div>
            )}
            {info && <div className="login-alert info">{info}</div>}

            {/* ===== LOGIN MODE ===== */}
            {mode === 'login' && (
              <>
                <div className="login-form-header">
                  <h2>Welcome back</h2>
                  <p className="uppercase-sub">Login Portal</p>
                </div>

                <form onSubmit={handleSubmit}>
                  <label className="login-label">
                    <span>USERNAME</span>
                    <input type="text" className="login-input" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
                  </label>

                  <label className="login-label">
                    <span>PASSWORD</span>
                    <div className="login-input-wrap">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="login-input"
                        style={{ paddingRight: 48 }}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button type="button" className="login-eye-btn" onClick={() => setShowPassword(s => !s)} tabIndex={-1}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  <div className="login-forgot-row">
                    <button type="button" className="login-link-btn" onClick={() => { resetMessages(); setMode('forgot-username'); }}>
                      Forgot Password?
                    </button>
                  </div>

                  <button type="submit" className="login-submit-btn" disabled={loading}>
                    {loading ? 'LOGGING IN...' : 'LOG IN'}
                  </button>

                  <div className="login-divider"><span>Secure Access</span></div>
                </form>
              </>
            )}

            {/* ===== FORGOT PASSWORD — STEP 1: USERNAME ===== */}
            {mode === 'forgot-username' && (
              <>
                <div className="login-form-header">
                  <h2>Reset your password</h2>
                  <p>Enter your username to continue.</p>
                </div>

                <form onSubmit={handleForgotUsername}>
                  <label className="login-label" style={{ marginBottom: 20 }}>
                    <span>USERNAME</span>
                    <input type="text" className="login-input" value={fpUsername} onChange={(e) => setFpUsername(e.target.value)} required autoFocus />
                  </label>

                  <button type="submit" className="login-submit-btn" disabled={loading}>
                    {loading ? 'CHECKING...' : 'CONTINUE'}
                  </button>

                  <button type="button" className="login-secondary-btn" onClick={backToLogin}>
                    Back to Login
                  </button>
                </form>
              </>
            )}

            {/* ===== FORGOT PASSWORD — STEP 2 (AGENT ONLY): EMAIL ===== */}
            {mode === 'forgot-email' && (
              <>
                <div className="login-form-header">
                  <h2>Enter your email</h2>
                  <p>We'll send a reset code to this email address.</p>
                </div>

                <form onSubmit={handleForgotEmail}>
                  <label className="login-label" style={{ marginBottom: 20 }}>
                    <span>EMAIL</span>
                    <input type="email" className="login-input" value={fpEmail} onChange={(e) => setFpEmail(e.target.value)} required autoFocus />
                  </label>

                  <button type="submit" className="login-submit-btn" disabled={loading}>
                    {loading ? 'SENDING CODE...' : 'SEND CODE'}
                  </button>

                  <button type="button" className="login-secondary-btn" onClick={backToLogin}>
                    Back to Login
                  </button>
                </form>
              </>
            )}

            {/* ===== FORGOT PASSWORD — STEP 3: VERIFY OTP ===== */}
            {mode === 'forgot-otp' && (
              <>
                <div className="login-form-header">
                  <h2>Enter reset code</h2>
                  <p>{fpRole === 'admin' ? 'Enter the code sent to your registered email.' : 'Enter the code sent to your email.'}</p>
                </div>

                <form onSubmit={handleVerifyOtp}>
                  <label className="login-label">
                    <span>RESET CODE</span>
                    <input
                      type="text"
                      className="login-input login-otp-input"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      maxLength={6}
                      autoFocus
                    />
                  </label>

                  <div style={{ textAlign: 'center', marginBottom: 20, fontSize: 12.5 }}>
                    {otpSecondsLeft > 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>
                        Code expires in {formatOtpTimer(otpSecondsLeft)}
                      </span>
                    ) : (
                      <span style={{ color: '#c23f3f' }}>Code expired</span>
                    )}
                    {' · '}
                    <button
                      type="button"
                      className="login-link-btn"
                      onClick={handleResendOtp}
                      disabled={loading || otpSecondsLeft > 0}
                      style={otpSecondsLeft > 0 ? { color: 'var(--text-muted)', cursor: 'default' } : undefined}
                    >
                      Resend code
                    </button>
                  </div>

                  <button type="submit" className="login-submit-btn" disabled={loading}>
                    {loading ? 'VERIFYING...' : 'VERIFY CODE'}
                  </button>

                  <button
                    type="button"
                    className="login-secondary-btn"
                    onClick={() => { resetMessages(); setOtp(''); setMode(fpRole === 'admin' ? 'forgot-username' : 'forgot-email'); }}
                  >
                    Back
                  </button>

                  <button type="button" className="login-secondary-btn" onClick={backToLogin}>
                    Back to Login
                  </button>
                </form>
              </>
            )}

            {/* ===== FORGOT PASSWORD — STEP 4: NEW PASSWORD ===== */}
            {mode === 'forgot-newpass' && (
              <>
                <div className="login-form-header">
                  <h2>Create new password</h2>
                  <p>Choose a new password for your account.</p>
                </div>

                <form onSubmit={handleResetPassword}>
                  <label className="login-label">
                    <span>NEW PASSWORD</span>
                    <div className="login-input-wrap">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        className="login-input"
                        style={{ paddingRight: 40 }}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        autoFocus
                      />
                      <button type="button" className="login-eye-btn" onClick={() => setShowNewPassword(s => !s)} tabIndex={-1}>
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  <label className="login-label" style={{ marginBottom: 20 }}>
                    <span>CONFIRM NEW PASSWORD</span>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="login-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </label>

                  <button type="submit" className="login-submit-btn" disabled={loading}>
                    {loading ? 'RESETTING...' : 'RESET PASSWORD'}
                  </button>

                  <button type="button" className="login-secondary-btn" onClick={backToLogin}>
                    Back to Login
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}