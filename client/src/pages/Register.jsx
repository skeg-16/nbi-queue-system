import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

const REGIONS = [
  { value: 'NCR', label: 'National Capital Region (NCR)' },
  { value: 'CAR', label: 'Cordillera Administrative Region (CAR)' },
  { value: 'Region I', label: 'Ilocos Region (Region I)' },
  { value: 'Region II', label: 'Cagayan Valley (Region II)' },
  { value: 'Region III', label: 'Central Luzon (Region III)' },
  { value: 'Region IV-A', label: 'CALABARZON (Region IV-A)' },
  { value: 'MIMAROPA', label: 'MIMAROPA Region' },
  { value: 'Region V', label: 'Bicol Region (Region V)' },
  { value: 'Region VI', label: 'Western Visayas (Region VI)' },
  { value: 'Region VII', label: 'Central Visayas (Region VII)' },
  { value: 'Region VIII', label: 'Eastern Visayas (Region VIII)' },
  { value: 'Region IX', label: 'Zamboanga Peninsula (Region IX)' },
  { value: 'Region X', label: 'Northern Mindanao (Region X)' },
  { value: 'Region XI', label: 'Davao Region (Region XI)' },
  { value: 'Region XII', label: 'SOCCSKSARGEN (Region XII)' },
  { value: 'Region XIII', label: 'Caraga (Region XIII)' },
  { value: 'BARMM', label: 'Bangsamoro (BARMM)' }
];

function toTitleCase(str) {
  return str.split(' ').map(w => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

const RULES = {
  fullName: { validate: v => v.trim().length >= 2 && /^[a-zA-Z\s.,-]+$/.test(v), msg: '⚠ Please enter a valid full name (letters only)' },
  contact: { validate: v => /^09\d{9}$/.test(v.trim()), msg: '⚠ Please enter a valid mobile number' },
  email: { validate: v => v.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), msg: '⚠ Please enter a valid email' },
  age: { validate: v => { const n = parseInt(v, 10); return !isNaN(n) && n >= 1 && n <= 120; }, msg: '⚠ Please enter a valid age' },
  address: { validate: v => v.trim().length >= 5, msg: '⚠ Please enter your complete address' },
  region: { validate: v => v !== '', msg: '⚠ Please select a region' },
  purpose: { validate: v => v !== '', msg: '⚠ Please select a purpose' }
};

export default function Register() {
  const socket = useSocket();

  // ---------- Screens ----------
  const [screen, setScreen] = useState('landing'); // landing | priority | form

  // ---------- Form fields ----------
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [region, setRegion] = useState('');
  const [address, setAddress] = useState('');
  const [purpose, setPurpose] = useState('');
  const [civilStatus, setCivilStatus] = useState('Single');
  const [gender, setGender] = useState('Prefer not to say');
  const [referredBy, setReferredBy] = useState('');
  const [isPriority, setIsPriority] = useState(false);

  // ---------- Validation ----------
  const [errors, setErrors] = useState({});

  // ---------- Signature (draw-only) ----------
  const [signatureError, setSignatureError] = useState(false);
  const canvasRef = useRef(null);
  const padRef = useRef(null); // SignaturePad instance

  // ---------- Submit state ----------
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successData, setSuccessData] = useState(null);

  const formStartTimeRef = useRef(null);
  const keystrokeCountRef = useRef(0);
  const firstInvalidRef = useRef({});

  // ---------- Init SignaturePad when entering form screen ----------
  useEffect(() => {
    if (screen !== 'form') return;

    let padInstance;
    (async () => {
      const { default: SignaturePad } = await import('signature_pad');
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);

      padInstance = new SignaturePad(canvas, {
        penColor: 'rgb(240, 165, 0)',
        backgroundColor: 'rgba(10, 22, 40, 0)'
      });
      padInstance.addEventListener('endStroke', () => validateSignature());
      padRef.current = padInstance;
    })();

    function handleResize() {
      const canvas = canvasRef.current;
      if (!canvas || !padRef.current) return;
      const data = padRef.current.toData();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      padRef.current.fromData(data);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  function validateSignature() {
    const valid = padRef.current ? !padRef.current.isEmpty() : false;
    setSignatureError(!valid);
    return valid;
  }

  function getSignatureDataURL() {
    if (!padRef.current) return '';
    // toSVG() returns a lightweight vector SVG string (data URI)
    const svg = padRef.current.toSVG();
    const base64 = btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${base64}`;
  }

  // ---------- Field validation ----------
  const fieldValues = { fullName, contact, email, age, address, region, purpose };

  function validateField(fieldId) {
    const rule = RULES[fieldId];
    if (!rule) return true;
    const valid = rule.validate(fieldValues[fieldId]);
    setErrors(e => ({ ...e, [fieldId]: valid ? null : rule.msg }));
    return valid;
  }

  function handleBlur(fieldId) {
    validateField(fieldId);
  }

  function trackKeystroke() {
    keystrokeCountRef.current += 1;
    if (keystrokeCountRef.current === 2 && !formStartTimeRef.current) {
      formStartTimeRef.current = new Date();
    }
  }

  // ---------- Screen transitions ----------
  function goToLanding() {
    setScreen('landing');
  }

  function goToPriority() {
    setScreen('priority');
  }

  function chooseIsPriority(val) {
    setIsPriority(val);
    setScreen('form');
  }

  // ---------- Submit ----------
  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');

    let isFormValid = true;
    let firstInvalidId = null;
    Object.keys(RULES).forEach(fieldId => {
      const valid = validateField(fieldId);
      if (!valid && !firstInvalidId) firstInvalidId = fieldId;
    });

    const sigValid = validateSignature();
    if (!sigValid && !firstInvalidId) firstInvalidId = 'signature-pad';

    if (!isFormValid || !sigValid) {
      const el = document.getElementById(firstInvalidId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus?.();
      }
      return;
    }

    setSubmitting(true);

    const formData = {
      fullName: toTitleCase(fullName.trim()),
      contact: contact.trim(),
      age,
      email: email.trim(),
      civilStatus: civilStatus.toUpperCase(),
      gender: gender.toUpperCase(),
      region: region.toUpperCase(),
      address: address.trim().toUpperCase(),
      purpose: purpose.toUpperCase(),
      referredBy: referredBy.trim().toUpperCase(),
      isPriority,
      signature: getSignatureDataURL(),
      registrationDuration: (() => {
        if (!formStartTimeRef.current) return '00:00';
        const diffMs = Math.max(0, new Date() - formStartTimeRef.current);
        const mins = Math.floor(diffMs / 60000).toString().padStart(2, '0');
        const secs = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
        return `${mins}:${secs}`;
      })()
    };

    const timeoutId = setTimeout(() => {
      setServerError('⚠ Server response timeout. Please ask staff for assistance.');
      setSubmitting(false);
    }, 10000);

    socket.emit('submit_registration', formData, response => {
      clearTimeout(timeoutId);
      if (response && response.success) {
        setSubmitSuccess(true);
        setTimeout(() => {
          setSuccessData(response);
          setSubmitting(false);
        }, 800);
      } else {
        let msg = '⚠ Something went wrong. Please ask the staff for assistance.';
        if (response && response.error) {
          msg = `⚠ Error: ${response.error}`;
          if (response.details?.hint) msg += ` (${response.details.hint})`;
        }
        setServerError(msg);
        setSubmitting(false);
      }
    });
  }

  // ---------- Reset everything, back to landing ----------
  function resetForm() {
    setFullName(''); setContact(''); setEmail(''); setAge('');
    setRegion(''); setAddress(''); setPurpose('');
    setCivilStatus('Single'); setGender('Prefer not to say'); setReferredBy('');
    setIsPriority(false);
    setErrors({});
    setSignatureError(false);
    padRef.current?.clear();
    setSubmitting(false);
    setSubmitSuccess(false);
    setServerError('');
    setSuccessData(null);
    formStartTimeRef.current = null;
    keystrokeCountRef.current = 0;
    setScreen('landing');
  }

  // ---------- Success screen auto-redirect ----------
  useEffect(() => {
    if (!successData) return;
    const t = setTimeout(() => resetForm(), 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successData]);

  let shortCcd = successData?.ccdNo || '';
  if (shortCcd.includes('-')) {
    const parts = shortCcd.split('-');
    shortCcd = '#' + parts[parts.length - 1];
  }

  let queueText = '';
  if (successData) {
    if (successData.isPriority) {
      queueText = successData.position === 0
        ? 'You are next in the Priority Lane!'
        : `You are Priority #${successData.position + 1} — ${successData.position} priority complainant(s) ahead of you.`;
    } else {
      queueText = successData.position === 0
        ? 'You are next in line!'
        : `There are ${successData.position} people ahead of you in the queue.`;
    }
  }

  // ==================== RENDER ====================
  return (
    <>
      <style>{`
        .reg-body { background:#050e1d; font-family:'Inter',sans-serif; height:100vh; width:100vw; overflow:hidden; display:flex; align-items:center; justify-content:center; }
        .reg-container { max-width:1100px; width:100%; max-height:96vh; background:#0F1E30; border:1px solid rgba(240,165,0,0.15); border-top:3px solid #F0A500; border-radius:12px; padding:16px 28px; box-shadow:0 15px 50px rgba(0,0,0,0.5); position:relative; overflow:hidden; overflow-y:auto; }
        .reg-header { text-align:center; margin-bottom:0.6rem; }
        .reg-seal { width:52px; height:52px; margin:0 auto 0.3rem; object-fit:contain; filter:drop-shadow(0 0 10px rgba(240,165,0,0.2)); }
        .reg-agency { font-size:0.68rem; color:rgba(255,255,255,0.7); letter-spacing:0.18em; text-transform:uppercase; font-weight:600; }
        .reg-brand { font-size:1.15rem; font-weight:800; color:#F0A500; text-transform:uppercase; letter-spacing:2px; }
        .reg-subtitle { font-size:0.72rem; color:rgba(255,255,255,0.5); letter-spacing:1px; text-transform:uppercase; }
        .reg-divider { height:1px; background:rgba(240,165,0,0.2); margin:0.5rem 0; }
        .reg-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:0.5rem; }
        .reg-field { display:flex; flex-direction:column; gap:0.2rem; }
        .reg-label { font-size:10px; color:#F0A500; text-transform:uppercase; letter-spacing:0.06em; font-weight:600; }
        .reg-req { color:#F0A500; }
        .reg-input { width:100%; height:34px; background:#0A1628; border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:white; font-size:13px; padding:0 0.8rem; font-family:inherit; text-transform:uppercase; }
        .reg-input:focus { outline:none; border-color:#F0A500; box-shadow:0 0 0 3px rgba(240,165,0,0.15); }
        .reg-input.err { border-color:#e74c3c; }
        .reg-err-msg { color:#e74c3c; font-size:0.65rem; font-weight:600; margin-top:1px; }
        .reg-span-2 { grid-column: span 2; }
        .reg-span-4 { grid-column: 1 / -1; }
        select.reg-input { appearance:none; background-image:url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23F0A500' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat:no-repeat; background-position:right 0.7rem center; background-size:0.9em; cursor:pointer; }
        .reg-priority-row { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; background:#0A1628; padding:0.4rem 1rem; border-radius:6px; border:1px solid rgba(255,255,255,0.05); cursor:pointer; margin-bottom:0.3rem; }
        .reg-priority-row.active { border-color:rgba(240,165,0,0.4); background:linear-gradient(90deg,#0A1628,rgba(240,165,0,0.05)); }
        .reg-priority-title { color:white; font-weight:700; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem; }
        .reg-priority-row.active .reg-priority-title { color:#F0A500; }
        .reg-priority-sub { color:rgba(255,255,255,0.4); font-size:0.65rem; }
        .reg-toggle { position:relative; display:inline-block; width:40px; height:22px; }
        .reg-toggle input { opacity:0; width:0; height:0; }
        .reg-toggle-slider { position:absolute; inset:0; background:rgba(255,255,255,0.15); transition:.3s; border-radius:30px; cursor:pointer; }
        .reg-toggle-slider:before { content:""; position:absolute; height:14px; width:14px; left:4px; bottom:4px; background:white; transition:.3s; border-radius:50%; }
        .reg-toggle input:checked + .reg-toggle-slider { background:#F0A500; }
        .reg-toggle input:checked + .reg-toggle-slider:before { transform:translateX(18px); }
        .reg-sig-pad { width:100%; height:150px; display:block; cursor:crosshair; background:#0A1628; border:1px solid rgba(255,255,255,0.12); border-radius:6px; }
        .reg-sig-pad.err { border-color:#e74c3c; }
        .reg-sig-btn { background:transparent; border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.7); font-size:0.62rem; padding:2px 8px; border-radius:4px; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; font-weight:600; }
        .reg-sig-btn.active { background:rgba(255,255,255,0.1); color:white; }
        .reg-submit { width:auto; min-width:180px; flex-shrink:0; background:#F0A500; color:#0A1628; height:30px; font-size:0.72rem; font-weight:700; border:none; border-radius:6px; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; display:flex; justify-content:center; align-items:center; gap:0.4rem; padding:0 1rem; }
        .reg-submit:disabled { opacity:0.7; cursor:not-allowed; }
        .reg-submit.success { background:#2ecc71; color:white; }
        .reg-privacy { text-align:left; font-size:0.62rem; color:rgba(255,255,255,0.3); line-height:1.3; max-width:600px; }
        .reg-back-btn { position:absolute; top:12px; left:16px; background:transparent; border:none; color:rgba(255,255,255,0.6); font-size:1.3rem; cursor:pointer; padding:0.3rem; z-index:10; }
        .reg-back-btn:hover { color:white; }
        @keyframes tapPulse { 0%,100%{opacity:1;transform:scale(1);text-shadow:0 0 25px rgba(240,165,0,0.35);} 50%{opacity:0.85;transform:scale(1.03);text-shadow:0 0 45px rgba(240,165,0,0.6);} }
        .reg-overlay { position:fixed; inset:0; background:#050e1d; display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:1000; text-align:center; padding:2rem; }
        .reg-success-seal { width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg,#2ecc71,#27ae60); display:flex; align-items:center; justify-content:center; color:white; font-size:2.2rem; margin-bottom:1.2rem; box-shadow:0 0 30px rgba(46,204,113,0.3); }
        .reg-success-title { font-size:1.8rem; color:white; font-weight:800; margin-bottom:0.3rem; }
        .reg-success-sub { color:#a0aec0; font-size:0.9rem; margin-bottom:2rem; }
        .reg-ticket { background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:2.5rem 3rem; margin-bottom:2rem; width:100%; max-width:520px; }
        .reg-ticket-label { color:#a0aec0; text-transform:uppercase; letter-spacing:2px; margin-bottom:0.6rem; font-weight:600; font-size:0.8rem; }
        .reg-ticket-number { font-size:3.2rem; font-weight:800; color:#f39c12; letter-spacing:2px; margin-bottom:0.6rem; }
        .reg-ticket-queue { font-size:1.05rem; color:white; font-weight:500; }
        .reg-register-another { background:transparent; border:2px solid rgba(255,255,255,0.2); color:white; padding:0.8rem 2.4rem; border-radius:50px; font-size:0.95rem; font-weight:600; cursor:pointer; }
        .reg-register-another:hover { background:rgba(255,255,255,0.1); border-color:white; }
        @media (max-width: 768px) {
          .reg-grid { grid-template-columns: repeat(2, 1fr); }
          .reg-span-2 { grid-column: span 2; }
          .reg-priority-row { flex-direction: column; align-items: flex-start; gap: 8px; padding: 0.6rem 1rem; }
          .reg-toggle { align-self: flex-end; }
        }
        @media (max-width: 480px) {
          .reg-container { padding: 12px 16px; }
          .reg-grid { grid-template-columns: 1fr; }
          .reg-span-2, .reg-span-4 { grid-column: 1; }
        }
      `}</style>

      <div className="reg-body">

        {/* Landing "Tap Anywhere" screen */}
        {screen === 'landing' && (
          <div
            onClick={goToPriority}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', textAlign: 'center' }}
          >
            <img src="/assets/nbi.png" alt="NBI Logo" style={{ width: 90, height: 90, objectFit: 'contain', marginBottom: '1rem', filter: 'drop-shadow(0 0 10px rgba(240,165,0,0.2))' }} />
            <div className="reg-agency">National Bureau of Investigation</div>
            <div className="reg-brand" style={{ fontSize: '1.5rem', marginTop: '0.3rem', marginBottom: '2.5rem' }}>Cybercrime Division</div>
            <div style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', fontWeight: 800, color: '#F0A500', textTransform: 'uppercase', letterSpacing: 3, lineHeight: 1.2, animation: 'tapPulse 2s ease-in-out infinite' }}>
              Tap Anywhere<br />to Register!
            </div>
            <div style={{ marginTop: '1.2rem', fontSize: '1rem', color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>
              Complainant Registration
            </div>
          </div>
        )}

        {/* Priority question screen */}
        {screen === 'priority' && (
          <div className="reg-container" style={{ textAlign: 'center', maxWidth: 560 }}>
            <button className="reg-back-btn" onClick={goToLanding}>←</button>
            <img src="/assets/nbi.png" alt="NBI Logo" style={{ width: 80, height: 80, margin: '0 auto 1rem', display: 'block', filter: 'drop-shadow(0 0 10px rgba(240,165,0,0.2))' }} />
            <div className="reg-agency">National Bureau of Investigation</div>
            <div className="reg-brand" style={{ fontSize: '1.5rem', marginTop: '0.4rem', marginBottom: '1.5rem' }}>Cybercrime Division</div>

            <h2 style={{ color: 'white', marginBottom: '1.5rem', fontSize: '1.4rem', fontWeight: 600, lineHeight: 1.4 }}>
              Are you a Senior Citizen, PWD, or Pregnant?
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '0 1rem' }}>
              <button
                onClick={() => chooseIsPriority(true)}
                style={{ background: 'linear-gradient(135deg,#F0A500,#d35400)', color: 'white', border: 'none', padding: '1.1rem', fontSize: '1.1rem', fontWeight: 700, borderRadius: 8, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1, boxShadow: '0 10px 20px rgba(240,165,0,0.2)' }}
              >
                Yes, I am a Priority
              </button>
              <button
                onClick={() => chooseIsPriority(false)}
                style={{ background: '#0A1628', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)', padding: '1.1rem', fontSize: '1.1rem', fontWeight: 600, borderRadius: 8, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}
              >
                No, Regular Registration
              </button>
            </div>
          </div>
        )}

        {/* Main registration form */}
        {screen === 'form' && (
          <div className="reg-container">
            <button className="reg-back-btn" onClick={goToLanding}>←</button>

            <div className="reg-header">
              <img src="/assets/nbi.png" alt="NBI Logo" className="reg-seal" />
              <div className="reg-agency">National Bureau of Investigation</div>
              <div className="reg-brand">Cybercrime Division</div>
              <div className="reg-subtitle">Complainant Registration Form</div>
            </div>

            <div className="reg-divider" />

            <form onSubmit={handleSubmit} noValidate>
              <div className="reg-grid">

                <label className={`reg-priority-row ${isPriority ? 'active' : ''}`}>
                  <div>
                    <div className="reg-priority-title">
                      PWD / Senior Citizen
                      {isPriority && <span style={{ fontSize: '0.6rem', background: 'rgba(231,76,60,0.15)', color: '#e74c3c', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(231,76,60,0.3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800 }}>⚑ Priority Lane Active</span>}
                    </div>
                    <div className="reg-priority-sub">Access to priority queue</div>
                  </div>
                  <div className="reg-toggle">
                    <input type="checkbox" checked={isPriority} onChange={e => setIsPriority(e.target.checked)} />
                    <span className="reg-toggle-slider" />
                  </div>
                </label>

                <div className="reg-field reg-span-2">
                  <label className="reg-label" htmlFor="fullName">Full Name <span className="reg-req">*</span></label>
                  <input
                    id="fullName" type="text" className={`reg-input ${errors.fullName ? 'err' : ''}`}
                    placeholder="Enter your full name" style={{ textTransform: 'none' }}
                    value={fullName}
                    onChange={e => { setFullName(toTitleCase(e.target.value)); trackKeystroke(); }}
                    onBlur={() => handleBlur('fullName')}
                  />
                  {errors.fullName && <div className="reg-err-msg">{errors.fullName}</div>}
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="contact">Mobile Number <span className="reg-req">*</span></label>
                  <input
                    id="contact" type="tel" className={`reg-input ${errors.contact ? 'err' : ''}`}
                    placeholder="09XXXXXXXXX" maxLength={11}
                    value={contact}
                    onChange={e => { setContact(e.target.value.replace(/[^0-9]/g, '')); trackKeystroke(); }}
                    onBlur={() => handleBlur('contact')}
                  />
                  {errors.contact && <div className="reg-err-msg">{errors.contact}</div>}
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="email">Email</label>
                  <input
                    id="email" type="email" className={`reg-input ${errors.email ? 'err' : ''}`}
                    placeholder="Optional" style={{ textTransform: 'none' }}
                    value={email}
                    onChange={e => { setEmail(e.target.value); trackKeystroke(); }}
                    onBlur={() => handleBlur('email')}
                  />
                  {errors.email && <div className="reg-err-msg">{errors.email}</div>}
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="age">Age <span className="reg-req">*</span></label>
                  <input
                    id="age" type="number" className={`reg-input ${errors.age ? 'err' : ''}`}
                    placeholder="Age" min={1} max={120}
                    value={age}
                    onChange={e => { setAge(e.target.value); trackKeystroke(); }}
                    onBlur={() => handleBlur('age')}
                  />
                  {errors.age && <div className="reg-err-msg">{errors.age}</div>}
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="region">Region <span className="reg-req">*</span></label>
                  <select
                    id="region" className={`reg-input ${errors.region ? 'err' : ''}`}
                    value={region}
                    onChange={e => { setRegion(e.target.value); validateField('region'); }}
                  >
                    <option value="" disabled hidden>Select Region</option>
                    {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  {errors.region && <div className="reg-err-msg">{errors.region}</div>}
                </div>

                <div className="reg-field reg-span-2">
                  <label className="reg-label" htmlFor="address">Complete Address (City, Brgy, St) <span className="reg-req">*</span></label>
                  <input
                    id="address" type="text" className={`reg-input ${errors.address ? 'err' : ''}`}
                    placeholder="Enter your complete address"
                    value={address}
                    onChange={e => { setAddress(e.target.value); trackKeystroke(); }}
                    onBlur={() => handleBlur('address')}
                  />
                  {errors.address && <div className="reg-err-msg">{errors.address}</div>}
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="purpose">Purpose <span className="reg-req">*</span></label>
                  <select
                    id="purpose" className={`reg-input ${errors.purpose ? 'err' : ''}`}
                    value={purpose}
                    onChange={e => { setPurpose(e.target.value); validateField('purpose'); }}
                  >
                    <option value="" disabled hidden>Select a purpose</option>
                    <option value="File a Complaint">File a Complaint</option>
                    <option value="Inquire">Inquire</option>
                    <option value="Follow-Up">Follow-Up</option>
                  </select>
                  {errors.purpose && <div className="reg-err-msg">{errors.purpose}</div>}
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="civilStatus">Civil Status</label>
                  <select id="civilStatus" className="reg-input" value={civilStatus} onChange={e => setCivilStatus(e.target.value)}>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="gender">Gender</label>
                  <select id="gender" className="reg-input" value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div className="reg-field">
                  <label className="reg-label" htmlFor="referredBy">Referred By</label>
                  <input
                    id="referredBy" type="text" className="reg-input" placeholder="Optional"
                    value={referredBy}
                    onChange={e => { setReferredBy(e.target.value); trackKeystroke(); }}
                  />
                </div>

                {/* Signature (draw-only) */}
                <div className="reg-field reg-span-4">
                  <div style={{ marginBottom: 4 }}>
                    <label className="reg-label">E-Signature <span className="reg-req">*</span></label>
                  </div>

                  <canvas id="signature-pad" ref={canvasRef} className={`reg-sig-pad ${signatureError ? 'err' : ''}`} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button type="button" className="reg-sig-btn" onClick={() => { padRef.current?.clear(); validateSignature(); }}>Clear</button>
                    <button type="button" className="reg-sig-btn" onClick={() => {
                      const data = padRef.current?.toData();
                      if (data && data.length) { data.pop(); padRef.current.fromData(data); validateSignature(); }
                    }}>Undo</button>
                  </div>

                  {signatureError && <div className="reg-err-msg">⚠ Please provide your signature</div>}
                </div>

                {/* Footer */}
                <div className="reg-span-4" style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div className="reg-privacy" style={{ flex: 1 }}>
                      Your information is collected in accordance with RA 10173 (Data Privacy Act of 2012) and will be used solely for NBI Cybercrime Division processing.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                        All fields marked <span style={{ color: '#F0A500' }}>*</span> are required
                      </div>
                      <button type="submit" className={`reg-submit ${submitSuccess ? 'success' : ''}`} disabled={submitting}>
                        <span>{submitting ? (submitSuccess ? '✓ Success' : 'Submitting...') : 'Submit Registration'}</span>
                        {!submitting && <span style={{ fontSize: '1.1rem' }}>&rarr;</span>}
                      </button>
                    </div>
                  </div>

                  {serverError && (
                    <div style={{ color: '#e74c3c', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center', marginTop: 6 }}>
                      {serverError}
                    </div>
                  )}
                </div>

              </div>
            </form>
          </div>
        )}

        {/* Success overlay */}
        {successData && (
          <div className="reg-overlay">
            <div className="reg-success-seal">✓</div>
            <div className="reg-success-title">Registration Successful</div>
            <div className="reg-success-sub">Your details have been securely recorded.</div>

            <div className="reg-ticket">
              {isPriority && (
                <div style={{ background: '#f39c12', color: '#0b1d3a', fontWeight: 800, padding: '0.4rem', textTransform: 'uppercase', letterSpacing: 3, fontSize: '0.8rem', marginBottom: '1.5rem', borderRadius: 4 }}>
                  Priority Lane
                </div>
              )}
              <div className="reg-ticket-label">Control Number</div>
              <div className="reg-ticket-number">{shortCcd}</div>
              <div className="reg-ticket-queue">{queueText}</div>
            </div>

            <button className="reg-register-another" onClick={resetForm}>Register Another Person</button>
          </div>
        )}
      </div>
    </>
  );
}