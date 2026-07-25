import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(240,165,0,0.3)',
  borderRadius: '5px',
  color: '#ffffff',
  fontSize: '14px',
  outline: 'none'
};

const labelTextStyle = {
  display: 'block',
  color: '#c9d4ec',
  fontSize: '12px',
  marginBottom: '6px',
  letterSpacing: '0.5px'
};

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot-request' | 'forgot-verify'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Forgot password (request) state
  const [fpUsername, setFpUsername] = useState('');

  // Forgot password (verify code) state
  const [vUsername, setVUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const resetMessages = () => { setError(''); setInfo(''); setLocked(false); };

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

  const handleForgotRequest = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fpUsername })
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Unable to send request.');
        setLoading(false);
        return;
      }

      setInfo(data.message || 'Your request has been sent to the administrator.');
      setLoading(false);
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleForgotVerify = async (e) => {
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
        body: JSON.stringify({ username: vUsername, otp, newPassword })
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to reset password.');
        setLoading(false);
        return;
      }

      setInfo('Password reset successfully. You may now log in.');
      setMode('login');
      setUsername(vUsername);
      setPassword('');
      setVUsername('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setLoading(false);
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const backToLogin = () => {
    resetMessages();
    setMode('login');
    setFpUsername('');
    setVUsername('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'radial-gradient(circle at 50% 40%, #1a365d 0%, #050e1d 80%)',
        fontFamily: 'Arial, sans-serif',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          width: '380px',
          maxWidth: '100%',
          background: '#0d234f',
          borderRadius: '10px',
          border: '1px solid rgba(240,165,0,0.25)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}
      >
        {/* Header / Branding */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0b1f4d 0%, #142d6e 100%)',
            borderBottom: '4px solid #f0a500',
            padding: '28px 32px',
            textAlign: 'center'
          }}
        >
          <img
            src="/assets/nbi.png"
            alt="NBI Logo"
            style={{ width: '56px', height: '56px', objectFit: 'contain', marginBottom: '10px' }}
          />
          <p style={{ margin: 0, color: '#f0a500', fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Republic of the Philippines
          </p>
          <p style={{ margin: '4px 0 0 0', color: '#ffffff', fontSize: '19px', fontWeight: 'bold' }}>
            National Bureau of Investigation
          </p>
          <p style={{ margin: '2px 0 0 0', color: '#c9d4ec', fontSize: '13px', letterSpacing: '1px' }}>
            Cybercrime Division
          </p>
        </div>

        <div style={{ padding: '28px 32px 32px 32px' }}>

          {error && (
            <div style={{ background: 'rgba(138,31,31,0.2)', border: '1px solid rgba(138,31,31,0.5)', color: '#ff8a8a', padding: '10px 14px', borderRadius: '4px', marginBottom: '18px', fontSize: '13px' }}>
              {error}
              {locked && (
                <div style={{ marginTop: 6, fontSize: '12px', color: '#f0c674' }}>
                  A request has been sent to your administrator to unlock this account.
                </div>
              )}
            </div>
          )}
          {info && (
            <div style={{ background: 'rgba(30,122,60,0.2)', border: '1px solid rgba(30,122,60,0.5)', color: '#8fe0a8', padding: '10px 14px', borderRadius: '4px', marginBottom: '18px', fontSize: '13px' }}>
              {info}
            </div>
          )}

          {/* ===== LOGIN MODE ===== */}
          {mode === 'login' && (
            <>
              <p style={{ margin: '0 0 20px 0', color: '#c9d4ec', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center' }}>
                Staff Login Portal
              </p>

              <form onSubmit={handleSubmit}>
                <label style={{ display: 'block', marginBottom: '16px' }}>
                  <span style={labelTextStyle}>USERNAME</span>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus style={inputStyle} />
                </label>

                 <label style={{ display: 'block', marginBottom: '10px' }}>
                  <span style={labelTextStyle}>PASSWORD</span>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ ...inputStyle, paddingRight: '48px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8092b8', cursor: 'pointer', padding: 4, display: 'flex' }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={() => { resetMessages(); setMode('forgot-request'); }}
                    style={{ background: 'none', border: 'none', color: '#f0a500', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', padding: '12px', background: loading ? '#8a6a1a' : '#f0a500', color: '#0b1f4d', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.5px', cursor: loading ? 'default' : 'pointer' }}
                >
                  {loading ? 'LOGGING IN...' : 'LOGIN'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => { resetMessages(); setMode('forgot-verify'); }}
                    style={{ background: 'none', border: 'none', color: '#8092b8', fontSize: '11.5px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    Already have a reset code?
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ===== FORGOT PASSWORD — REQUEST ===== */}
          {mode === 'forgot-request' && (
            <>
              <p style={{ margin: '0 0 8px 0', color: '#c9d4ec', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center' }}>
                Reset Your Password
              </p>
              <p style={{ margin: '0 0 20px 0', color: '#8092b8', fontSize: '12.5px', textAlign: 'center', lineHeight: 1.5 }}>
                Your request will be sent to an administrator. You'll be given a reset code once it's approved.
              </p>

              <form onSubmit={handleForgotRequest}>
                <label style={{ display: 'block', marginBottom: '20px' }}>
                  <span style={labelTextStyle}>USERNAME</span>
                  <input type="text" value={fpUsername} onChange={(e) => setFpUsername(e.target.value)} required autoFocus style={inputStyle} />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', padding: '12px', background: loading ? '#8a6a1a' : '#f0a500', color: '#0b1f4d', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.5px', cursor: loading ? 'default' : 'pointer', marginBottom: '12px' }}
                >
                  {loading ? 'SENDING REQUEST...' : 'SEND REQUEST'}
                </button>

                <button
                  type="button"
                  onClick={backToLogin}
                  style={{ width: '100%', padding: '10px', background: 'transparent', color: '#c9d4ec', border: '1px solid rgba(240,165,0,0.3)', borderRadius: '5px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Back to Login
                </button>

                <button
                  type="button"
                  onClick={() => { resetMessages(); setFpUsername(prev => prev); setMode('forgot-reset'); }}
                  style={{ width: '100%', padding: '10px', background: 'none', border: 'none', color: '#f0a500', fontSize: '12px', cursor: 'pointer', marginTop: '10px' }}
                >
                  Already have a code? Enter it here
                </button>
              </form>
            </>
          )}

          {/* ===== FORGOT PASSWORD — VERIFY CODE ===== */}
          {mode === 'forgot-verify' && (
            <>
              <p style={{ margin: '0 0 8px 0', color: '#c9d4ec', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center' }}>
                Enter Reset Code
              </p>
              <p style={{ margin: '0 0 20px 0', color: '#8092b8', fontSize: '12.5px', textAlign: 'center', lineHeight: 1.5 }}>
                Enter the code your administrator sent to your email.
              </p>

              <form onSubmit={handleForgotVerify}>
                <label style={{ display: 'block', marginBottom: '16px' }}>
                  <span style={labelTextStyle}>USERNAME</span>
                  <input type="text" value={vUsername} onChange={(e) => setVUsername(e.target.value)} required autoFocus style={inputStyle} />
                </label>

                <label style={{ display: 'block', marginBottom: '16px' }}>
                  <span style={labelTextStyle}>RESET CODE</span>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    style={{ ...inputStyle, letterSpacing: '4px', textAlign: 'center', fontSize: '18px' }}
                  />
                </label>

                <label style={{ display: 'block', marginBottom: '16px' }}>
                  <span style={labelTextStyle}>NEW PASSWORD</span>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      style={{ ...inputStyle, paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(s => !s)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8092b8', cursor: 'pointer', padding: 4, display: 'flex' }}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <label style={{ display: 'block', marginBottom: '20px' }}>
                  <span style={labelTextStyle}>CONFIRM NEW PASSWORD</span>
                  <input type={showNewPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} style={inputStyle} />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', padding: '12px', background: loading ? '#8a6a1a' : '#f0a500', color: '#0b1f4d', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.5px', cursor: loading ? 'default' : 'pointer', marginBottom: '12px' }}
                >
                  {loading ? 'RESETTING...' : 'RESET PASSWORD'}
                </button>

                <button
                  type="button"
                  onClick={backToLogin}
                  style={{ width: '100%', padding: '10px', background: 'transparent', color: '#c9d4ec', border: '1px solid rgba(240,165,0,0.3)', borderRadius: '5px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Back to Login
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 32px', background: '#0b1f4d', borderTop: '1px solid rgba(240,165,0,0.15)' }}>
          <p style={{ margin: 0, color: '#8092b8', fontSize: '11px', textAlign: 'center' }}>
            Authorized personnel only. All access is logged.
          </p>
        </div>
      </div>
    </div>
  );
}