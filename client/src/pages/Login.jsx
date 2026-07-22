import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  const [mode, setMode] = useState('login'); // 'login' | 'forgot-request' | 'forgot-reset'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Forgot password state
  const [fpUsername, setFpUsername] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const resetMessages = () => { setError(''); setInfo(''); };

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
        setError(data.error || 'Unable to send reset code.');
        setLoading(false);
        return;
      }

      setMaskedEmail(data.maskedEmail);
      setMode('forgot-reset');
      setLoading(false);
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleForgotReset = async (e) => {
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

      setInfo('Password reset successfully. You may now log in.');
      setMode('login');
      setUsername(fpUsername);
      setPassword('');
      setFpUsername('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setMaskedEmail('');
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
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setMaskedEmail('');
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
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
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
              </form>
            </>
          )}

          {/* ===== FORGOT PASSWORD — STEP 1: ENTER USERNAME ===== */}
          {mode === 'forgot-request' && (
            <>
              <p style={{ margin: '0 0 20px 0', color: '#c9d4ec', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center' }}>
                Reset Your Password
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
                  {loading ? 'SENDING...' : 'SEND RESET CODE'}
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

          {/* ===== FORGOT PASSWORD — STEP 2: ENTER OTP + NEW PASSWORD ===== */}
          {mode === 'forgot-reset' && (
            <>
              <p style={{ margin: '0 0 8px 0', color: '#c9d4ec', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center' }}>
                Enter Reset Code
              </p>
              <p style={{ margin: '0 0 20px 0', color: '#8092b8', fontSize: '13px', textAlign: 'center' }}>
                A 6-digit code was sent to <strong style={{ color: '#f0a500' }}>{maskedEmail}</strong>
              </p>

              <form onSubmit={handleForgotReset}>
                <label style={{ display: 'block', marginBottom: '16px' }}>
                  <span style={labelTextStyle}>RESET CODE</span>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    maxLength={6}
                    style={{ ...inputStyle, letterSpacing: '4px', textAlign: 'center', fontSize: '18px' }}
                  />
                </label>

                <label style={{ display: 'block', marginBottom: '16px' }}>
                  <span style={labelTextStyle}>NEW PASSWORD</span>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} style={inputStyle} />
                </label>

                <label style={{ display: 'block', marginBottom: '20px' }}>
                  <span style={labelTextStyle}>CONFIRM NEW PASSWORD</span>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} style={inputStyle} />
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