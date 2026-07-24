import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, Download, Printer, Search } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SQD_KEYS = ['sqd0', 'sqd1', 'sqd2', 'sqd3', 'sqd4', 'sqd5', 'sqd6', 'sqd7', 'sqd8'];
const SQD_SCORE = {
  'Strongly Disagree': 1,
  'Disagree': 2,
  'Neither Agree nor Disagree': 3,
  'Agree': 4,
  'Strongly Agree': 5,
};

const COPY = {
  en: {
    dbName: 'English Feedback Database',
    searchPh: 'Search records...',
    export: 'Export Records',
    print: 'Print',
    refresh: 'Refresh',
    lastUpdated: 'Last updated',
    cols: ['DATE', 'CLIENT TYPE', 'AGE / SEX', 'REGION', 'SERVICE', 'CC1-3', 'SQD AVG', 'SUGGESTIONS', 'EMAIL'],
    empty: 'No feedback records yet.',
    emptySub: 'Submitted responses to the English form will appear here.',
    loading: 'Loading records...',
    errorLoad: 'Could not load records. Try refreshing.',
    countLabel: (n) => `${n} record${n === 1 ? '' : 's'}`,
    tabLabel: 'English',
  },
  tl: {
    dbName: 'Tagalog Feedback Database',
    searchPh: 'Maghanap ng record...',
    export: 'I-export ang Records',
    print: 'I-print',
    refresh: 'I-refresh',
    lastUpdated: 'Huling na-update',
    cols: ['PETSA', 'URI NG KLIYENTE', 'EDAD / KASARIAN', 'REHIYON', 'SERBISYO', 'CC1-3', 'SQD AVG', 'SUHESTIYON', 'EMAIL'],
    empty: 'Wala pang feedback records.',
    emptySub: 'Ang mga isinumite sa Tagalog na form ay lalabas dito.',
    loading: 'Naglo-load ng records...',
    errorLoad: 'Hindi ma-load ang records. Subukang i-refresh.',
    countLabel: (n) => `${n} record${n === 1 ? '' : ''}`,
    tabLabel: 'Tagalog',
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function sqdAverage(record) {
  const scores = SQD_KEYS
    .map((k) => SQD_SCORE[record[k]])
    .filter((v) => typeof v === 'number');
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function ccSummary(record) {
  const a = record.cc1 || '—';
  const b = record.cc2 || '—';
  const c = record.cc3 || '—';
  return `${a}-${b}-${c}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function todayStamp() {
  return new Date().toISOString().split('T')[0];
}

function downloadCsv(records, lang) {
  const headers = [
    'date', 'client_type', 'age', 'sex', 'region', 'service_availed',
    'cc1', 'cc2', 'cc3', ...SQD_KEYS, 'sqd_avg', 'suggestions', 'email', 'submittedAt',
  ];
  const rows = records.map((r) => {
    const avg = sqdAverage(r);
    return headers.map((h) => {
      if (h === 'sqd_avg') return avg === null ? '' : avg.toFixed(2);
      return r[h];
    }).map(csvEscape).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `feedback-${lang}-${todayStamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Score badge                                                        */
/* ------------------------------------------------------------------ */

function ScorePill({ value }) {
  if (value === null) {
    return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>N/A</span>;
  }
  let bg = '#fdecea', fg = '#c0392b';
  if (value >= 4.5) { bg = '#e8f8f0'; fg = '#1e8e5a'; }
  else if (value >= 3.5) { bg = '#fef8e5'; fg = '#b7860b'; }
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '2px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
        minWidth: 42, background: bg, color: fg,
      }}
    >
      {value.toFixed(1)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function FeedbackReports() {
  useEffect(() => { document.title = 'Feedback Reports | NBI QMS'; }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [lang, setLang] = useState('en');
  const [recordsByLang, setRecordsByLang] = useState({ en: [], tl: [] });
  const [status, setStatus] = useState('loading');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const t = COPY[lang];

  const loadLang = useCallback(async (l) => {
    if (!window.storage) return [];
    const listed = await window.storage.list(`feedback:${l}:`, true).catch(() => null);
    const keys = listed?.keys ?? [];
    const items = await Promise.all(
      keys.map(async (k) => {
        try {
          const res = await window.storage.get(k, true);
          return res ? JSON.parse(res.value) : null;
        } catch {
          return null;
        }
      })
    );
    return items
      .filter(Boolean)
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  }, []);

  const loadAll = useCallback(async () => {
    setStatus('loading');
    try {
      const [en, tl] = await Promise.all([loadLang('en'), loadLang('tl')]);
      setRecordsByLang({ en, tl });
      setLastUpdated(new Date());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [loadLang]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const records = recordsByLang[lang];

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.trim().toLowerCase();
    return records.filter((r) =>
      [r.client_type, r.region, r.service_availed, r.suggestions, r.email, r.sex]
        .some((f) => (f || '').toLowerCase().includes(q))
    );
  }, [records, search]);

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : '—';

  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        user={user}
        activePath={location.pathname}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Action bar */}
        <div className="action-bar" style={{ display: 'flex', flexDirection: 'column', gap: 15, padding: '20px 25px', background: 'var(--panel-bg)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)', fontWeight: 600, letterSpacing: '0.02em' }}>{t.dbName}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 500 }}>
                {t.lastUpdated}: {lastUpdatedLabel}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Language tabs */}
              <div style={{ display: 'flex', gap: 4 }}>
                {['en', 'tl'].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    style={{
                      padding: '8px 16px',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: lang === l ? '#1e3a8a' : 'transparent',
                      color: lang === l ? '#ffffff' : 'var(--text-main)',
                      border: lang === l ? '1px solid #1e3a8a' : '1px solid var(--border-color)',
                    }}
                  >
                    {COPY[l].tabLabel} ({recordsByLang[l].length})
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder={t.searchPh}
                  style={{ width: 260, paddingLeft: 32 }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button className="btn-formal" onClick={loadAll}>
                <RefreshCw size={14} style={{ marginRight: 4, verticalAlign: -2 }} className={status === 'loading' ? 'animate-spin' : ''} /> {t.refresh}
              </button>
              <button className="btn-formal" onClick={() => downloadCsv(filtered, lang)} disabled={filtered.length === 0}>
                <Download size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> {t.export}
              </button>
              <button className="btn-formal" onClick={() => window.print()} disabled={filtered.length === 0}>
                <Printer size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> {t.print}
              </button>
            </div>
          </div>
        </div>

        {/* Main table */}
        <div className="grid-workspace" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--panel-bg)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <style>{`
                .data-table th, .data-table td {
                  padding: 10px 12px !important;
                  font-size: 0.82rem !important;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
                .data-table th.col-title {
                  font-size: 0.72rem !important;
                }
              `}</style>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table className="data-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '19%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                      <tr className="column-titles">
                    {t.cols.map((c) => (
                      <th key={c} className="col-title">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {status === 'loading' && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>{t.loading}</td></tr>
                  )}
                  {status === 'error' && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--red)' }}>{t.errorLoad}</td></tr>
                  )}
                  {status === 'ready' && filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.empty}</div>
                        <div style={{ fontSize: '0.85rem' }}>{t.emptySub}</div>
                      </td>
                    </tr>
                  )}
                  {status === 'ready' && filtered.map((r, i) => {
                    const dateObj = new Date(r.submittedAt || r.date);
                    return (
                      <tr key={r.submittedAt ? r.submittedAt + i : i}>
                        <td>{formatDate(r.date)}</td>
                        <td>{r.client_type || '—'}</td>
                        <td>{r.age || '—'} / {r.sex || '—'}</td>
                        <td>{r.region || '—'}</td>
                        <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.service_availed}>{r.service_availed || '—'}</td>
                        <td>{ccSummary(r)}</td>
                        <td><ScorePill value={sqdAverage(r)} /></td>
                        <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.suggestions}>{r.suggestions || '—'}</td>
                        <td>{r.email || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {status === 'ready' && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {t.countLabel(filtered.length)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}