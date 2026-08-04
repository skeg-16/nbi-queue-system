import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Globe, Loader2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Static reference data                                              */
/* ------------------------------------------------------------------ */

const REGIONS = [
  ['NCR', 'National Capital Region (NCR)'],
  ['CAR', 'Cordillera Administrative Region (CAR)'],
  ['Region I', 'Region I (Ilocos Region)'],
  ['Region II', 'Region II (Cagayan Valley)'],
  ['Region III', 'Region III (Central Luzon)'],
  ['Region IV-A', 'Region IV-A (CALABARZON)'],
  ['Region IV-B', 'Region IV-B (MIMAROPA)'],
  ['Region V', 'Region V (Bicol Region)'],
  ['Region VI', 'Region VI (Western Visayas)'],
  ['Region VII', 'Region VII (Central Visayas)'],
  ['Region VIII', 'Region VIII (Eastern Visayas)'],
  ['Region IX', 'Region IX (Zamboanga Peninsula)'],
  ['Region X', 'Region X (Northern Mindanao)'],
  ['Region XI', 'Region XI (Davao Region)'],
  ['Region XII', 'Region XII (SOCCSKSARGEN)'],
  ['Region XIII', 'Region XIII (Caraga)'],
  ['BARMM', 'BARMM'],
];

const SQD_KEYS = ['sqd0', 'sqd1', 'sqd2', 'sqd3', 'sqd4', 'sqd5', 'sqd6', 'sqd7', 'sqd8'];
const AUTO_NA = ['sqd3', 'sqd4', 'sqd5']; // locked to N/A per office policy

const SCALE = [
  ['Strongly Disagree', '😠'],
  ['Disagree', '🙁'],
  ['Neither Agree nor Disagree', '😐'],
  ['Agree', '🙂'],
  ['Strongly Agree', '😀'],
  ['N/A', ''],
];

const COPY = {
  en: {
    langLabel: 'Tagalog',
    agency: 'National Bureau of Investigation',
    division: 'Cybercrime Division',
    headline: 'HELP US SERVE YOU BETTER!',
    intro:
      "This Client Satisfaction Measurement (CSM) tracks the customer experience of government offices. Your feedback on your recently concluded transaction will help this office provide a better service. Personal information shared will be kept confidential and you always have the option to not answer this form.",
    steps: ['Client Information', "Citizen's Charter (CC)", 'Service Quality Dimensions', 'Suggestions & Contact'],
    clientType: 'Client type',
    clientTypeOpts: [
      ['Citizen', 'Citizen'],
      ['Business', 'Business'],
      ['Government (Employees or another agency)', 'Government (Employees or another agency)'],
    ],
    date: 'Date',
    sex: 'Sex',
    sexOpts: [['Male', 'Male'], ['Female', 'Female']],
    age: 'Age',
    agePh: 'e.g. 30',
    region: 'Region of Residence',
    service: 'Service Availed',
    servicePh: 'Select service availed',
    serviceOpts: [
      ['File a Complaint', 'File a Complaint'],
      ['Inquire', 'Inquire'],
      ['Follow-up', 'Follow-up'],
    ],
    ccIntro:
      "INSTRUCTIONS: Select your answer to the Citizen's Charter (CC) questions. The Citizen's Charter is an official document that reflects the services of a government agency/office including its requirements, fees, and processing times among others.",
    cc1: 'CC1. Which of the following best describes your awareness of a CC?',
    cc1Opts: [
      ['1', '1. I know what a CC is and I saw this office\u2019s CC.'],
      ['2', '2. I know what a CC is but I did NOT see this office\u2019s CC.'],
      ['3', '3. I learned of the CC only when I saw this office\u2019s CC.'],
      ['4', '4. I do not know what a CC is and I did not see one in this office. (Answer "N/A" on CC2 and CC3)'],
    ],
    cc2: 'CC2. If aware of CC (Answered 1-3 in CC1), would you say that the CC of this office was...?',
    cc2Opts: [
      ['1', '1. Easy to see'],
      ['2', '2. Somewhat easy to see'],
      ['3', '3. Difficult to see'],
      ['4', '4. Not visible at all'],
      ['5', '5. N/A'],
    ],
    cc3: 'CC3. If aware of CC (answered codes 1-3 in CC1), how much did the CC help you in your transaction?',
    cc3Opts: [
      ['1', '1. Helped very much'],
      ['2', '2. Somewhat helped'],
      ['3', '3. Did not help'],
      ['4', '4. N/A'],
    ],
    sqdIntro: 'INSTRUCTIONS: For SQD 0-8, please select the option that best corresponds to your answer.',
    sqdError: 'Please answer all SQD questions.',
    autoNaNote: '(Automatically set to N/A)',
    scaleLabels: ['Strongly\nDisagree', 'Disagree', 'Neither Agree\nnor Disagree', 'Agree', 'Strongly\nAgree', 'N/A'],
    sqd: [
      'SQD0. I am satisfied with the service that I availed.',
      'SQD1. I spent a reasonable amount of time for my transaction.',
      "SQD2. The office followed the transaction's requirements and steps based on the information provided.",
      'SQD3. The steps (including payment) I needed to do for my transactions were easy and simple.',
      'SQD4. I easily found information about my transaction. (If service was free, mark the "N/A" column)',
      'SQD5. I paid a reasonable amount of fees for my transaction. (If service was free, mark the "N/A" column)',
      'SQD6. I feel the office was fair to everyone, or "walang palakasan" during my transaction.',
      'SQD7. I was treated courteously by the staff, and (if asked for help) the staff was helpful.',
      'SQD8. I got what I needed from the government office, or (if denied) denial of request was sufficiently explained to me.',
    ],
    suggestions: 'Suggestions on how we can further improve our services (optional):',
    suggestionsPh: 'Your suggestions...',
    email: 'E-mail address (optional):',
    emailPh: 'your.email@example.com',
    emailError: 'Please enter a valid email address.',
    back: 'Previous',
    next: 'Next Step',
    submit: 'Submit Feedback',
    submitting: 'Submitting...',
    thankYouTitle: 'Thank You!',
    thankYouBody: 'Your feedback has been recorded. We appreciate you taking the time to help us improve.',
    submitAnother: 'Submit Another',
    required: [
      'Please select a client type.',
      'Please select a date.',
      'Please select sex.',
      'Please enter a valid age.',
      'Please select your region.',
      'Please select the service availed.',
      'Please select an option.',
    ],
    stepOf: (s, t) => `Step ${s} of ${t}`,
  },
  tl: {
    langLabel: 'English',
    agency: 'National Bureau of Investigation',
    division: 'Cybercrime Division',
    headline: 'TULUNGAN MO KAMI MAS MAPABUTI ANG AMING MGA PROSESO AT SERBISYO!',
    intro:
      'Ang Client Satisfaction Measurement (CSM) ay naglalayong masubaybayan ang karanasan ng taumbayan hinggit sa kanilang pakikipagtransaksyon sa mga tanggapan ng gobyerno. Makatutulong ang inyong kasagutan ukol sa inyong naging karanasan sa kakatapos lamang ng transaksyon, upang mas mapabuti at lalong mapahusay ang aming serbisyo publiko. Ang personal na impormasyon na iyong ibabahagi ay mananatiling kumpidensyal. Maaari ring piliin na hindi sagutan ang sarbey na ito.',
    steps: ['Impormasyon ng Kliyente', "Citizen's Charter (CC)", 'Kalidad ng Serbisyo', 'Mga Suhestiyon at Kontak'],
    clientType: 'Uri ng Kliyente',
    clientTypeOpts: [
      ['Citizen', 'Mamamayan'],
      ['Business', 'Negosyo'],
      ['Government (Employees or another agency)', 'Gobyerno (Empleyado o Ahensya)'],
    ],
    date: 'Petsa',
    sex: 'Kasarian',
    sexOpts: [['Male', 'Lalaki'], ['Female', 'Babae']],
    age: 'Edad',
    agePh: 'hal. 30',
    region: 'Rehiyon',
    service: 'Uri ng transaksyon o serbisyo',
    servicePh: 'Pumili ng uri ng serbisyo',
    serviceOpts: [
      ['File a Complaint', 'Paghahain ng Reklamo'],
      ['Inquire', 'Pagtatanong'],
      ['Follow-up', 'Follow-up / Pagsubaybay'],
    ],
    ccIntro:
      "PANUTO: Piliin ang iyong sagot sa mga sumusunod na katanungan tungkol sa Citizen's Charter (CC). Ito ay isang opisyal na dokumento na naglalaman ng mga serbisyo sa isang ahensya/opisina ng gobyerno, kasama na rito ang kinakailangang dokumento, kaukulang bayarin, at pangkabuuang oras ng pagproseso.",
    cc1: 'CC1. Alin sa mga susunod ang naglalarawan sa iyong kaalaman sa CC?',
    cc1Opts: [
      ['1', '1. Alam ko ang CC at nakita ko ito sa napuntahang opisina.'],
      ['2', '2. Alam ko ang CC pero hindi ko ito nakita sa napuntahang opisina.'],
      ['3', '3. Nalaman ko ang CC nang makita ko ito sa napuntahang opisina.'],
      ['4', '4. Hindi ko alam kung ano ang CC at wala akong nakita sa napuntahang opisina (Piliin ang "N/A" sa CC2 at CC3).'],
    ],
    cc2: 'CC2. Kung alam ang CC (Nag-tsek sa opsyon 1-3 sa CC1), masasabi mo ba na ang CC ng napuntahang opisina ay...',
    cc2Opts: [
      ['1', '1. Madaling makita'],
      ['2', '2. Medyo madaling makita'],
      ['3', '3. Mahirap makita'],
      ['4', '4. Hindi makita'],
      ['5', '5. N/A'],
    ],
    cc3: 'CC3. Kung alam ang CC (nag-tsek sa opsyon 1-3 sa CC1), gaano nakatulong ang CC sa transaksyon mo?',
    cc3Opts: [
      ['1', '1. Sobrang nakatulong'],
      ['2', '2. Nakatulong naman'],
      ['3', '3. Hindi nakatulong'],
      ['4', '4. N/A'],
    ],
    sqdIntro: 'PANUTO: Para sa SQD 0-8, piliin ang hanay na pinakaangkop sa iyong sagot.',
    sqdError: 'Mangyaring sagutan ang lahat ng SQD.',
    autoNaNote: '(Awtomatikong nakatakda sa N/A)',
    scaleLabels: ['Lubos na hindi\nsumasang-ayon', 'Hindi\nsumasang-ayon', 'Walang\nkinikilingan', 'Sumasang-\nayon', 'Labis na\nsumasang-ayon', 'N/A'],
    sqd: [
      'SQD0. Nasiyahan ako sa serbisyo na aking natanggap sa napuntahang tanggapan.',
      'SQD1. Makatwiran ang oras na aking ginugol para sa pagproseso ng aking transaksyon.',
      'SQD2. Ang opisina ay sumusunod sa mga kinakailangang dokumento at mga hakbang batay sa impormasyong ibinigay.',
      'SQD3. Ang mga hakbang sa pagproseso, kasama na ang pagbayad, ay madali at simple lamang.',
      'SQD4. Mabilis at madali akong nakahanap ng impormasyon tungkol sa aking transaksyon mula sa opisina o sa website nito.',
      'SQD5. Nagbayad ako ng makatwirang halaga para sa aking transaksyon. (Kung ang serbisyo ay ibinigay nang libre, maglagay ng tsek sa hanay ng N/A).',
      'SQD6. Pakiramdam ko ay patas ang opisina sa lahat, o "walang palakasan," sa aking transaksyon.',
      'SQD7. Magalang akong trinato ng mga tauhan, at (kung sakaling humingi ako ng tulong) alam kong sila ay handang tumulong sa akin.',
      'SQD8. Nakuha ko ang kinakailangan ko mula sa tanggapan ng gobyerno, kung tinanggihan man, ito ay sapat na ipinaliwanag sa akin.',
    ],
    suggestions: 'Mga suhestiyon kung paano pa mapapabuti ang aming mga serbisyo (opsyonal):',
    suggestionsPh: 'Iyong suhestiyon...',
    email: 'E-mail address (opsyonal):',
    emailPh: 'iyong.email@example.com',
    emailError: 'Mangyaring maglagay ng balidong email address.',
    back: 'Nakaraan',
    next: 'Susunod na Hakbang',
    submit: 'Ipasa ang Feedback',
    submitting: 'Isinusumite...',
    thankYouTitle: 'Maraming Salamat po!',
    thankYouBody: 'Naitala na ang iyong feedback. Pinahahalagahan namin ang oras mo para tulungan kaming mapabuti.',
    submitAnother: 'Magpasa Ulit',
    required: [
      'Mangyaring pumili ng uri ng kliyente.',
      'Mangyaring pumili ng petsa.',
      'Mangyaring pumili ng kasarian.',
      'Mangyaring maglagay ng balidong edad.',
      'Mangyaring piliin ang iyong rehiyon.',
      'Mangyaring pumili ng uri ng serbisyo.',
      'Mangyaring pumili ng sagot.',
    ],
    stepOf: (s, t) => `Hakbang ${s} ng ${t}`,
  },
};

const todayISO = () => new Date().toISOString().split('T')[0];

const initialForm = () => ({
  client_type: '', date: todayISO(), sex: '', age: '', region: '', service_availed: '',
  cc1: '', cc2: '', cc3: '',
  sqd0: '', sqd1: '', sqd2: '', sqd3: 'N/A', sqd4: 'N/A', sqd5: 'N/A', sqd6: '', sqd7: '', sqd8: '',
  suggestions: '', email: '',
});

/* ------------------------------------------------------------------ */
/*  UI atoms                                                           */
/* ------------------------------------------------------------------ */

const GOLD = '#f1c40f';
const DANGER = '#e74c3c';

function Field({ label, required, error, children }) {
  return (
    <div className="mb-6">
      <label className="block text-[1.02rem] font-semibold mb-2 text-white text-left">
        {label}
        {required && <span className="ml-1 font-bold" style={{ color: DANGER }}>*</span>}
      </label>
      {children}
      {error && (
        <div className="mt-1.5 flex items-center gap-1 text-sm" style={{ color: DANGER }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
    </div>
  );
}

const inputCls = (hasError) =>
  `w-full bg-black/30 border-2 rounded-lg px-4 py-3 text-white text-base min-h-[48px] outline-none transition-colors ${
    hasError ? 'border-red-500' : 'border-white/10 focus:border-yellow-400'
  }`;

function Select({ value, onChange, options, placeholder, hasError }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls(hasError) + ' appearance-none bg-no-repeat'}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
        backgroundPosition: 'right 1rem center',
        backgroundSize: '1em',
        paddingRight: '2.5rem',
      }}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map(([val, txt]) => (
        <option key={val} value={val} style={{ background: '#050e1d' }}>{txt}</option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function FeedbackForm() {
  const [lang, setLang] = useState(null);
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState('forward');
  const [form, setForm] = useState(initialForm());
  const [errors, setErrors] = useState({});
  const [sqdError, setSqdError] = useState(false);
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const t = lang ? COPY[lang] : null;
  const totalSteps = 4;

  const set = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  useEffect(() => {
    if (form.cc1 === '4') {
      setForm((f) => ({ ...f, cc2: '5', cc3: '4' }));
      setErrors((e) => ({ ...e, cc2: undefined, cc3: undefined }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cc1]);

  function validateStep(s) {
    const errs = {};
    const [rClient, rDate, rSex, rAge, rRegion, rService, rOpt] = t.required;
    if (s === 1) {
      if (!form.client_type) errs.client_type = rClient;
      if (!form.date) errs.date = rDate;
      if (!form.sex) errs.sex = rSex;
      if (!form.age) errs.age = rAge;
      if (!form.region) errs.region = rRegion;
      if (!form.service_availed) errs.service_availed = rService;
    } else if (s === 2) {
      if (!form.cc1) errs.cc1 = rOpt;
      if (!form.cc2) errs.cc2 = rOpt;
      if (!form.cc3) errs.cc3 = rOpt;
    } else if (s === 3) {
      const missing = SQD_KEYS.some((k) => !form[k]);
      setSqdError(missing);
      return !missing;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setDir('forward');
    setStep((s) => s + 1);
  }

  function goBack() {
    setDir('back');
    setStep((s) => s - 1);
  }

 async function handleSubmit() {
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrors((e) => ({ ...e, email: t.emailError }));
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = { ...form, language: lang };
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!data.success) {
        setSubmitError(data.error ? `Error: ${data.error}` : 'Submission failed. Please try again.');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setForm(initialForm());
    setStep(1);
    setErrors({});
    setSqdError(false);
    setSubmitted(false);
    setLang(null);
  }

  const pct = (step / totalSteps) * 100;

  /* ---------------- Language picker (shown before anything else) ---------------- */
  if (!lang) {
    return (
      <div
          className="w-full min-h-screen flex flex-col items-center justify-center p-4 sm:p-8"        style={{
          background: 'radial-gradient(circle at 50% 0%, #1a365d 0%, #050e1d 60%)',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div
          className="w-full max-w-md rounded-2xl overflow-hidden border border-white/10 shadow-2xl text-center px-8 py-10"
          style={{ background: 'rgba(11,29,58,0.4)', backdropFilter: 'blur(10px)' }}
        >
          <div className="mx-auto mb-4 w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-white/5">
            <img src="/assets/nbi.png" alt="NBI Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xs tracking-[2px] uppercase font-semibold text-slate-400">National Bureau of Investigation</h1>
          <h2 className="text-xl font-extrabold my-1" style={{ color: GOLD }}>Cybercrime Division</h2>

          <p className="text-white font-semibold mt-6 mb-1">Choose your language</p>
          <p className="text-slate-400 text-sm mb-6">Piliin ang gusto mong wika</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setLang('en')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold min-h-[48px] transition-transform hover:scale-[1.02]"
              style={{ background: GOLD, color: '#050e1d' }}
            >
              <Globe size={18} /> English
            </button>
            <button
              onClick={() => setLang('tl')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold border-2 border-white/10 bg-white/10 text-white hover:bg-white/20 transition-colors min-h-[48px]"
            >
              <Globe size={18} /> Tagalog
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-[640px] flex flex-col items-center justify-center p-4 sm:p-8"
      style={{
        background: 'radial-gradient(circle at 50% 0%, #1a365d 0%, #050e1d 60%)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
    <div className="w-full max-w-4xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl" style={{ background: 'rgba(11,29,58,0.4)', backdropFilter: 'blur(10px)' }}>        {/* Header */}
        <div
          className="relative text-center px-6 py-8 border-b-2"
          style={{ borderColor: GOLD, background: 'linear-gradient(180deg, rgba(11,29,58,0.9) 0%, rgba(5,14,29,0) 100%)' }}
        >
          <button
            onClick={() => setLang(null)}
            className="absolute top-4 left-4 text-xs font-semibold px-2 py-1 rounded-md border flex items-center gap-1 transition-colors"
            style={{ color: GOLD, borderColor: GOLD, background: 'rgba(241,196,15,0.1)' }}
          >
            <ChevronLeft size={12} /> {t.langLabel === 'Tagalog' ? 'Back' : 'Bumalik'}
          </button>
          <div className="mx-auto mb-2 w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-white/5">
            <img src="/assets/nbi.png" alt="NBI Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xs tracking-[2px] uppercase font-semibold text-slate-400">{t.agency}</h1>
          <h2 className="text-xl font-extrabold my-1" style={{ color: GOLD }}>{t.division}</h2>
          <h3 className="text-base font-semibold text-white mb-2">{t.headline}</h3>
          <p className="text-sm text-slate-400 text-justify leading-relaxed">{t.intro}</p>
        </div>

        {/* Progress */}
        <div className="w-full h-1 bg-white/10">
          <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: GOLD }} />
        </div>

        {/* Body */}
        <div className="p-6 sm:p-10 min-h-[420px] flex flex-col">
          {submitted ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6" style={{ background: '#2ecc71' }}>
                <CheckCircle2 size={52} color="white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">{t.thankYouTitle}</h2>
              <p className="text-slate-400 max-w-sm mb-6">{t.thankYouBody}</p>
              <button
                onClick={reset}
                className="px-6 py-3 rounded-lg border-2 border-white/10 bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
              >
                {t.submitAnother}
              </button>
            </div>
          ) : (
            <>
              <div className="text-center text-xs font-semibold uppercase tracking-wide mb-6" style={{ color: GOLD }}>
                {t.stepOf(step, totalSteps)} — {t.steps[step - 1]}
              </div>

              {step === 1 && (
                <div className="grid sm:grid-cols-2 gap-x-8">
                  <Field label={t.clientType} required error={errors.client_type}>
                    <Select value={form.client_type} onChange={(v) => set('client_type', v)} options={t.clientTypeOpts} placeholder="—" hasError={!!errors.client_type} />
                  </Field>
                  <Field label={t.date} required error={errors.date}>
                    <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls(!!errors.date)} />
                  </Field>
                  <Field label={t.sex} required error={errors.sex}>
                    <Select value={form.sex} onChange={(v) => set('sex', v)} options={t.sexOpts} placeholder="—" hasError={!!errors.sex} />
                  </Field>
                  <Field label={t.age} required error={errors.age}>
                    <input type="number" min="1" max="150" placeholder={t.agePh} value={form.age} onChange={(e) => set('age', e.target.value)} className={inputCls(!!errors.age)} />
                  </Field>
                  <Field label={t.region} required error={errors.region}>
                    <Select value={form.region} onChange={(v) => set('region', v)} options={REGIONS} placeholder="—" hasError={!!errors.region} />
                  </Field>
                  <Field label={t.service} required error={errors.service_availed}>
                    <Select value={form.service_availed} onChange={(v) => set('service_availed', v)} options={t.serviceOpts} placeholder={t.servicePh} hasError={!!errors.service_availed} />
                  </Field>
                </div>
              )}

              {step === 2 && (
                <div>
                  <p className="text-sm text-slate-300 text-justify leading-relaxed mb-6">{t.ccIntro}</p>
                  <Field label={t.cc1} required error={errors.cc1}>
                    <Select value={form.cc1} onChange={(v) => set('cc1', v)} options={t.cc1Opts} placeholder="—" hasError={!!errors.cc1} />
                  </Field>
                  <Field label={t.cc2} required error={errors.cc2}>
                    <Select value={form.cc2} onChange={(v) => set('cc2', v)} options={t.cc2Opts} placeholder="—" hasError={!!errors.cc2} />
                  </Field>
                  <Field label={t.cc3} required error={errors.cc3}>
                    <Select value={form.cc3} onChange={(v) => set('cc3', v)} options={t.cc3Opts} placeholder="—" hasError={!!errors.cc3} />
                  </Field>
                </div>
              )}

              {step === 3 && (
                <div>
                  <p className="text-sm text-slate-300 text-justify leading-relaxed mb-4">{t.sqdIntro}</p>
                  {sqdError && (
                    <div className="mb-4 flex items-center gap-1 text-sm font-medium" style={{ color: DANGER }}>
                      <AlertTriangle size={14} /> {t.sqdError}
                    </div>
                  )}
                  <div className="space-y-4">
                    {t.sqd.map((qText, i) => {
                      const key = SQD_KEYS[i];
                      const locked = AUTO_NA.includes(key);
                      const missing = sqdError && !form[key];
                      return (
                        <div
                          key={key}
                          className="rounded-lg border overflow-hidden"
                          style={{
                            borderColor: missing ? DANGER : 'rgba(255,255,255,0.1)',
                            opacity: locked ? 0.7 : 1,
                            background: 'rgba(255,255,255,0.03)',
                          }}
                        >
                          <div className="px-4 py-3 text-sm font-medium text-white text-justify" style={{ background: 'rgba(0,0,0,0.3)' }}>
                            {qText}
                            {locked && <span className="block text-xs font-semibold mt-1" style={{ color: GOLD }}>{t.autoNaNote}</span>}
                          </div>
                          <div className="flex flex-wrap gap-2 p-3">
                            {SCALE.map(([val, emoji], idx) => (
                              <label
                                key={val}
                                className={`flex-1 min-w-[70px] flex flex-col items-center gap-1 py-2 rounded-md border cursor-pointer text-xs text-slate-300 ${
                                  form[key] === val ? 'border-yellow-400' : 'border-white/10'
                                } ${locked ? 'pointer-events-none' : ''}`}
                                style={form[key] === val ? { background: 'rgba(241,196,15,0.12)' } : {}}
                              >
                                <input
                                  type="radio"
                                  name={key}
                                  value={val}
                                  checked={form[key] === val}
                                  onChange={() => set(key, val)}
                                  className="accent-yellow-400 w-4 h-4"
                                  disabled={locked}
                                />
                                {emoji && <span>{emoji}</span>}
                                <span className="text-center leading-tight whitespace-pre-line">{t.scaleLabels[idx]}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <Field label={t.suggestions}>
                    <textarea
                      placeholder={t.suggestionsPh}
                      value={form.suggestions}
                      maxLength={200}
                      onChange={(e) => set('suggestions', e.target.value.slice(0, 200))}
                      className={inputCls(false) + ' min-h-[120px] resize-y text-justify'}
                    />
                    <div className="text-right text-xs text-slate-400 mt-1">{form.suggestions.length}/200</div>
                  </Field>
                  <Field label={t.email} error={errors.email}>
                    <input
                      type="email"
                      placeholder={t.emailPh}
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      className={inputCls(!!errors.email)}
                    />
                  </Field>
                  {submitError && (
                    <div className="flex items-center gap-1 text-sm mb-2" style={{ color: DANGER }}>
                      <AlertTriangle size={14} /> {submitError}
                    </div>
                  )}
                </div>
              )}

              {/* Nav */}
              <div className="flex gap-4 mt-8">
                {step > 1 && (
                  <button
                    onClick={goBack}
                    className="flex-1 flex items-center justify-center gap-1 py-3 rounded-lg font-bold border-2 border-white/10 bg-white/10 text-white hover:bg-white/20 transition-colors min-h-[48px]"
                  >
                    <ChevronLeft size={18} /> {t.back}
                  </button>
                )}
                {step < 4 && (
                  <button
                    onClick={goNext}
                    className={`flex-1 flex items-center justify-center gap-1 py-3 rounded-lg font-bold min-h-[48px] transition-transform ${shake ? 'animate-[shake_0.4s]' : ''}`}
                    style={{ background: GOLD, color: '#050e1d' }}
                  >
                    {t.next} <ChevronRight size={18} />
                  </button>
                )}
                {step === 4 && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold min-h-[48px] disabled:opacity-70"
                    style={{ background: GOLD, color: '#050e1d' }}
                  >
                    {submitting ? (<><Loader2 size={18} className="animate-spin" /> {t.submitting}</>) : t.submit}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}