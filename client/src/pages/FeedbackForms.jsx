import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Menu, Search, Download, Printer, Volume2, VolumeX, RefreshCw, Inbox, AlertTriangle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const NAVY = '#0b1d3a';
const NAVY_DARK = '#081527';
const GOLD = '#f1c40f';

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

function todayStamp() {
  return new Date().toISOString().split('T')[0];
}

/* ------------------------------------------------------------------ */
/*  Score pill                                                          */
/* ------------------------------------------------------------------ */

function ScorePill({ value }) {
  if (value === null) {
    return <span className="text-xs text-slate-400">N/A</span>;
  }
  let bg = '#fdecea', fg = '#c0392b';
  if (value >= 4.5) { bg = '#e8f8f0'; fg = '#1e8e5a'; }
  else if (value >= 3.5) { bg = '#fef8e5'; fg = '#b7860b'; }
  return (
    <span
      className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold min-w-[46px]"
      style={{ background: bg, color: fg }}
    >
      {value.toFixed(1)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function FeedbackRecords() {
  const [lang, setLang] = useState('en'); // 'en' | 'tl' — separate record sets, same component
  const [recordsByLang, setRecordsByLang] = useState({ en: [], tl: [] });
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [search, setSearch] = useState('');
  const [muted, setMuted] = useState(true);
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

  return (
    <div className="w-full min-h-[640px] flex flex-col" style={{ background: '#f5f6f8', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <button className="text-slate-500 hover:text-slate-800 transition-colors" aria-label="Menu">
            <Menu size={20} />
          </button>
          <span className="text-xl" role="img" aria-label="NBI">🛡️</span>
          <h1 className="text-base sm:text-lg font-bold text-slate-900">{t.dbName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-400 font-medium">
            {t.lastUpdated}: {lastUpdatedLabel}
          </span>
          <button
            onClick={() => setMuted((m) => !m)}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            aria-label={muted ? 'Unmute' : 'Mute'}
            style={{ background: '#fff7de' }}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </div>

      {/* Language tabs */}
      <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 bg-white border-b border-slate-200">
        {['en', 'tl'].map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className="px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors relative -mb-px"
            style={
              lang === l
                ? { color: NAVY, borderBottom: `2px solid ${GOLD}`, background: '#fff' }
                : { color: '#94a3b8', borderBottom: '2px solid transparent' }
            }
          >
            {COPY[l].tabLabel}
            <span
              className="ml-2 inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: lang === l ? GOLD : '#e2e8f0', color: lang === l ? NAVY_DARK : '#64748b' }}
            >
              {recordsByLang[l].length}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-4 bg-white">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPh}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-slate-400 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            onClick={loadAll}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} /> {t.refresh}
          </button>
          <button
            onClick={() => downloadCsv(filtered, lang)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            <Download size={14} /> {t.export}
          </button>
          <button
            onClick={() => window.print()}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-40"
            style={{ background: NAVY }}
          >
            <Printer size={14} /> {t.print}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 pb-6">
        <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: NAVY }}>
                {t.cols.map((c) => (
                  <th key={c} className="text-left font-bold text-[11px] tracking-wide text-white uppercase px-4 py-3 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {status === 'loading' && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">{t.loading}</td></tr>
              )}
              {status === 'error' && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-red-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle size={18} /> {t.errorLoad}
                    </div>
                  </td>
                </tr>
              )}
              {status === 'ready' && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Inbox size={22} />
                      <span className="font-semibold text-slate-500">{t.empty}</span>
                      <span className="text-xs">{t.emptySub}</span>
                    </div>
                  </td>
                </tr>
              )}
              {status === 'ready' && filtered.map((r, i) => (
                <tr
                  key={r.submittedAt ? r.submittedAt + i : i}
                  className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 text-slate-700">{r.client_type || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{r.age || '—'} / {r.sex || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.region || '—'}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate" title={r.service_availed}>{r.service_availed || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{ccSummary(r)}</td>
                  <td className="px-4 py-3"><ScorePill value={sqdAverage(r)} /></td>
                  <td className="px-4 py-3 text-slate-500 max-w-[220px] truncate" title={r.suggestions}>{r.suggestions || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{r.email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {status === 'ready' && (
          <div className="mt-3 text-xs text-slate-400 font-medium">{t.countLabel(filtered.length)}</div>
        )}
      </div>
    </div>
  );
}