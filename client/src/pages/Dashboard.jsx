import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { CalendarDays, TrendingUp, Star, Clock, Download, FileDown } from 'lucide-react';

function getDateKey(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0];
}

function formatDayLabel(dateKey) {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ---------------------------------------------------------
   Line chart — gold accent, gradient fill + dots.
   Sized from the ACTUAL measured pixel box (ResizeObserver)
   instead of a fixed viewBox that gets squashed flat on
   narrow phone screens. Colors read from CSS variables so
   it follows the app-wide light/dark theme.
---------------------------------------------------------- */
function LineChart({ data }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 800, height: 280 });
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDims({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { width, height } = dims;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = Math.max(1, width - padding.left - padding.right);
  const chartH = Math.max(1, height - padding.top - padding.bottom);

  const maxVal = Math.max(4, ...data.map(d => d.count));
  const niceMax = Math.ceil(maxVal / 4) * 4;
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (d.count / niceMax) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    `M ${points[0].x} ${padding.top + chartH} ` +
    points.map(p => `L ${p.x} ${p.y}`).join(' ') +
    ` L ${points[points.length - 1].x} ${padding.top + chartH} Z`;

  function handleMove(e) {
    const svg = e.currentTarget.closest('svg');
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let closest = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    setHoverIndex(closest);
  }

  const activeIndex = hoverIndex !== null ? hoverIndex : 0;
  const hp = points[activeIndex];
  const isHovering = hoverIndex !== null;

  const tooltipW = 60;
  const tooltipH = 34;
  let tx = hp.x - tooltipW / 2;
  tx = Math.max(padding.left, Math.min(tx, width - padding.right - tooltipW));
  let ty = hp.y - tooltipH - 12;
  if (ty < padding.top) ty = hp.y + 12;

  return (
    <div ref={containerRef} className="chart-canvas">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block' }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="areaFillGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F0A500" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#F0A500" stopOpacity="0" />
          </linearGradient>
          <clipPath id="chartPlotClip">
            <rect x={padding.left} y={padding.top} width={chartW} height={chartH} />
          </clipPath>
        </defs>

        <style>{`
          .guide-line { transition: x1 0.12s ease, x2 0.12s ease, opacity 0.15s ease; }
          .hover-dot { transition: r 0.15s ease, stroke-width 0.15s ease, cx 0.12s ease, cy 0.12s ease; }
          .tooltip-group { transition: opacity 0.15s ease; }
          .tooltip-box, .tooltip-text { transition: x 0.12s ease; }
        `}</style>

        <g clipPath="url(#chartPlotClip)">
          {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
            const y = padding.top + chartH * (1 - frac);
            return (
              <line key={i} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(240,165,0,0.10)" strokeWidth="1" />
            );
          })}

          <path d={areaPath} fill="url(#areaFillGold)" />
          <path d={linePath} fill="none" stroke="#F0A500" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

          <line
            className="guide-line"
            x1={hp.x} x2={hp.x}
            y1={padding.top} y2={padding.top + chartH}
            stroke="rgba(240,165,0,0.35)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity={isHovering ? 1 : 0}
          />
        </g>

        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
          const y = padding.top + chartH * (1 - frac);
          const val = Math.round(niceMax * frac);
          return (
            <text key={i} x={padding.left - 8} y={y + 4} fontSize="10" fill="var(--text-muted)" textAnchor="end">{val}</text>
          );
        })}

        {points.map((p, i) => {
          // Sa napakaliit na width, hindi kasya lahat ng 7 labels nang magkatabi —
          // i-skip yung mga in-between (pero laging ipakita ang una, huli, at hover/today).
          const isNarrow = width < 380;
          const shouldShowLabel = !isNarrow || i === 0 || i === points.length - 1 || p.isToday || hoverIndex === i;
          return (
            <g key={i}>
              <circle
                className="hover-dot"
                cx={p.x}
                cy={p.y}
                r={hoverIndex === i ? 6.5 : (p.isToday ? 5.5 : 4.5)}
                fill="var(--panel-bg)"
                stroke="#F0A500"
                strokeWidth={hoverIndex === i ? 3 : 2.5}
              />
              {shouldShowLabel && (
                <text x={p.x} y={height - padding.bottom + 18} fontSize={isNarrow ? '8' : '9.5'} fill={hoverIndex === i ? '#F0A500' : 'var(--text-muted)'} textAnchor="middle" fontWeight={hoverIndex === i ? 700 : 400}>
                  {formatDayLabel(p.date)}
                </text>
              )}
            </g>
          );
        })}

        <rect x={padding.left} y={padding.top} width={chartW} height={chartH} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => setHoverIndex(null)} />

        <g className="tooltip-group" opacity={isHovering ? 1 : 0} pointerEvents="none">
          <rect className="tooltip-box" x={tx} y={ty} width={tooltipW} height={tooltipH} rx="6" fill="var(--panel-bg)" stroke="#F0A500" strokeWidth="1.5" />
          <text className="tooltip-text" x={tx + tooltipW / 2} y={ty + 15} fontSize="14" fontWeight="700" fill="#F0A500" textAnchor="middle">
            {hp.count}
          </text>
          <text className="tooltip-text" x={tx + tooltipW / 2} y={ty + 27} fontSize="8.5" fill="var(--text-muted)" textAnchor="middle">
            {formatDayLabel(hp.date)}
          </text>
        </g>
      </svg>
    </div>
  );
}

function StatCard({ label, value, sub, icon, highlighted }) {
  return (
    <div className={`stat-card ${highlighted ? 'highlighted' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalExportSummary, setModalExportSummary] = useState(false);

  useEffect(() => {
    document.title = "Dashboard | NBI QMS";
    fetchRecords();
  }, []);

  async function fetchRecords() {
    try {
      const res = await fetch('/api/records');
      const json = await res.json();
      if (json.success) setRecords(json.data);
    } catch (err) {
      console.error('Failed to fetch records:', err);
    }
    setLoading(false);
  }

  const chartData = useMemo(() => {
    const todayKey = getDateKey(new Date().toISOString());
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(getDateKey(d.toISOString()));
    }
    const counts = {};
    days.forEach(d => { counts[d] = 0; });
    records.forEach(r => {
      if (!r.created_at) return;
      const key = getDateKey(r.created_at);
      if (counts[key] !== undefined) counts[key]++;
    });
    return days.map(d => ({ date: d, count: counts[d], isToday: d === todayKey }));
  }, [records]);

  const stats = useMemo(() => {
    const todayKey = getDateKey(new Date().toISOString());
    const weekTotal = chartData.reduce((sum, d) => sum + d.count, 0);
    const todayTotal = chartData.find(d => d.date === todayKey)?.count || 0;
    const priorityToday = records.filter(r => r.created_at && getDateKey(r.created_at) === todayKey && r.is_priority).length;
    const waitingNow = records.filter(r => r.status === 'Waiting').length;
    return { todayTotal, weekTotal, priorityToday, waitingNow };
  }, [records, chartData]);

  const regionData = useMemo(() => {
    const weekDates = new Set(chartData.map(d => d.date));
    const counts = {};
    records.forEach(r => {
      if (!r.created_at) return;
      const key = getDateKey(r.created_at);
      if (!weekDates.has(key)) return;
      const region = r.region || 'Unspecified';
      counts[region] = (counts[region] || 0) + 1;
    });
    const arr = Object.entries(counts).map(([region, count]) => ({ region, count }));
    arr.sort((a, b) => b.count - a.count);
    return arr.slice(0, 6);
  }, [records, chartData]);

  const priorityBreakdown = useMemo(() => {
    const weekDates = new Set(chartData.map(d => d.date));
    let priority = 0, regular = 0;
    records.forEach(r => {
      if (!r.created_at) return;
      const key = getDateKey(r.created_at);
      if (!weekDates.has(key)) return;
      if (r.is_priority) priority++; else regular++;
    });
    const total = priority + regular;
    return { priority, regular, total, pct: total > 0 ? Math.round((priority / total) * 100) : 0 };
  }, [records, chartData]);

  function exportSummary() {
    setModalExportSummary(false);
    const genBy = (user.full_name || user.username || 'Unknown').replace(/,/g, ' ');
    const lines = [
      'NBI Cybercrime Division - Dashboard Summary',
      `Generated by,${genBy}`,
      `Generated on,${new Date().toLocaleString('en-PH')}`,
      '',
      'Metric,Value',
      `Today,${stats.todayTotal}`,
      `This Week,${stats.weekTotal}`,
      `Priority Today,${stats.priorityToday}`,
      `Waiting Now,${stats.waitingNow}`,
      '',
      'Priority Breakdown (Last 7 Days)',
      'Type,Count',
      `Priority,${priorityBreakdown.priority}`,
      `Regular,${priorityBreakdown.regular}`,
      '',
      'Records by Region (Last 7 Days)',
      'Region,Count',
      ...regionData.map(r => `${r.region},${r.count}`)
    ];
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `Dashboard_Summary_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportSummaryPDF() {
    setModalExportSummary(false);
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const genBy = user.full_name || user.username || 'Unknown';
    const genOn = new Date().toLocaleString('en-PH');

    doc.setFontSize(15);
    doc.text('NBI Cybercrime Division - Dashboard Summary', 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated by: ${genBy}  |  Generated on: ${genOn}`, 14, 25);
    doc.setTextColor(0);

    let y = 38;
    doc.setFontSize(12);
    doc.text('Overview', 14, y);
    y += 7;
    doc.setFontSize(10);
    [
      ['Today', stats.todayTotal],
      ['This Week', stats.weekTotal],
      ['Priority Today', stats.priorityToday],
      ['Waiting Now', stats.waitingNow],
    ].forEach(([label, val]) => {
      doc.text(`${label}: ${val}`, 14, y);
      y += 6;
    });

    y += 6;
    doc.setFontSize(12);
    doc.text('Priority Breakdown (Last 7 Days)', 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(`Priority: ${priorityBreakdown.priority}`, 14, y); y += 6;
    doc.text(`Regular: ${priorityBreakdown.regular}`, 14, y); y += 6;
    doc.text(`Priority Rate: ${priorityBreakdown.pct}%`, 14, y); y += 6;

    y += 6;
    doc.setFontSize(12);
    doc.text('Records by Region (Last 7 Days)', 14, y);
    y += 7;
    doc.setFontSize(10);
    if (regionData.length === 0) {
      doc.text('No records with region data yet.', 14, y);
      y += 6;
    } else {
      regionData.forEach(r => {
        doc.text(`${r.region}: ${r.count}`, 14, y);
        y += 6;
      });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`Dashboard_Summary_${dateStr}.pdf`);
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <>
      <style>{`
        .dash-body {
          height: 100vh;
          overflow: hidden;
          background: var(--bg-color);
          display: flex;
          font-family: 'Inter', Arial, sans-serif;
        }

        /* ---------- Main content ----------
           Locked to viewport height so an overflowing dashboard
           only scrolls WITHIN itself — the sidebar (sibling, its
           own height:100vh) never gets pushed off-screen. */
        .dash-main {
          flex: 1;
          min-width: 0;
          height: 100vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding: 18px 28px 16px;
          gap: 12px;
        }
        .dash-header-row { flex: 0 0 auto; }
        .dash-header-title p { margin: 0; color: var(--text-muted); font-size: 12.5px; }
        .dash-header-title h2 { margin: 2px 0 0 0; color: var(--text-main); font-size: 19px; }

        .stat-row { display: flex; gap: 12px; flex: 0 0 auto; flex-wrap: wrap; }
        .stat-card {
          background: var(--panel-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 14px 18px;
          flex: 1;
          min-width: 180px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .stat-card.highlighted { border-color: rgba(240,165,0,0.4); background: var(--panel-bg); }
        .stat-label { margin: 0 0 4px 0; color: var(--text-muted); font-size: 10.5px; letter-spacing: 0.6px; text-transform: uppercase; font-weight: 600; }
        .stat-value { margin: 0; color: var(--text-main); font-size: 21px; font-weight: 700; }
        .stat-sub { margin: 0; font-size: 11px; color: var(--text-muted); }
        .stat-icon {
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(240,165,0,0.14);
          color: #F0A500;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; flex-shrink: 0;
        }

        .chart-card {
          background: var(--panel-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 16px 20px;
          flex: 1 1 auto;
          min-height: 160px;
          display: flex;
          flex-direction: column;
        }
        .chart-card h3 { margin: 0; color: var(--text-main); font-size: 14px; }
        .chart-card .chart-sub { color: var(--text-muted); font-size: 11.5px; }
        .chart-canvas { width: 100%; flex: 1 1 auto; min-height: 0; }
        .chart-card {
          background: var(--panel-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 22px;
        }
        .chart-card h3 { margin: 0; color: var(--text-main); font-size: 15px; }
        .chart-card .chart-sub { color: var(--text-muted); font-size: 12px; }
        .chart-canvas { width: 100%; height: 300px; }

        .dash-header-row { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
        .btn-export-summary {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--panel-bg); border: 1px solid rgba(240,165,0,0.4);
          color: #F0A500; font-weight: 600; font-size: 13px;
          padding: 8px 14px; border-radius: 8px; cursor: pointer;
          white-space: nowrap;
        }
        .btn-export-summary:hover { background: rgba(240,165,0,0.08); }

        .summary-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; flex: 0 0 auto; }
        .summary-card {
          background: var(--panel-bg); border: 1px solid var(--border-color);
          border-radius: 12px; padding: 14px 18px;
        }
        .summary-card h3 { margin: 0 0 2px 0; color: var(--text-main); font-size: 14px; }
        .summary-card .chart-sub { color: var(--text-muted); font-size: 11px; margin: 0 0 10px 0; }

        .region-list { display: flex; flex-direction: column; gap: 7px; }
        .region-row { display: flex; align-items: center; gap: 10px; }
        .region-name { flex: 0 0 110px; font-size: 12.5px; color: var(--text-main); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .region-bar-track { flex: 1; height: 8px; border-radius: 4px; background: rgba(240,165,0,0.1); overflow: hidden; }
        .region-bar-fill { height: 100%; border-radius: 4px; background: #F0A500; }
        .region-count { flex: 0 0 26px; text-align: right; font-size: 12.5px; font-weight: 700; color: var(--text-main); }
        .region-empty { color: var(--text-muted); font-size: 13px; padding: 10px 0; }

        .priority-summary { display: flex; align-items: center; gap: 20px; }
        .priority-ring {
          width: 78px; height: 78px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .priority-ring-value { font-size: 17px; font-weight: 700; color: var(--text-main); }
        .priority-legend { flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
        .priority-legend-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-main); }
        .priority-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .priority-legend-count { margin-left: auto; font-weight: 700; }

        .chart-skeleton {
          width: 100%;
          height: 300px;
          border-radius: 8px;
          border: 1px dashed rgba(240,165,0,0.3);
          background: transparent;
          position: relative;
          overflow: hidden;
        }
        .chart-skeleton::before {
          content: '';
          position: absolute;
          top: 0;
          left: -40%;
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(240,165,0,0.35) 50%, transparent 100%);
          animation: shimmerSweep 1.6s ease-in-out infinite;
        }
        @keyframes shimmerSweep {
          0% { left: -40%; }
          100% { left: 100%; }
        }

        /* ---------- Responsive ---------- */
        @media (max-width: 900px) {
          .dash-main { padding: 20px 16px 40px; }

          .stat-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 18px 0 20px;
          }
          .stat-card { min-width: 0; padding: 14px 16px; gap: 4px; }
          .stat-label { font-size: 10px; margin-bottom: 4px; }
          .stat-value { font-size: 20px; }
          .stat-sub { font-size: 10.5px; }
          .stat-icon { width: 28px; height: 28px; font-size: 13px; }

          .chart-canvas { height: 240px; }

          .summary-grid { grid-template-columns: 1fr; margin-top: 14px; gap: 12px; }
          .btn-export-summary { font-size: 12px; padding: 7px 12px; }
        }
        @media (max-width: 480px) {
          .dash-main { padding: 16px 12px 32px; }
          .dash-header-title p { font-size: 12px; }
          .dash-header-title h2 { font-size: 18px; }
          .dash-header-row { align-items: stretch; }
          .btn-export-summary { justify-content: center; }

          .stat-row { gap: 8px; margin: 14px 0 16px; }
          .stat-card { padding: 12px; border-radius: 10px; }
          .stat-label { font-size: 9px; }
          .stat-value { font-size: 17px; }
          .stat-sub { font-size: 9.5px; }
          .stat-icon { width: 24px; height: 24px; font-size: 11px; }

          .chart-card { padding: 14px; border-radius: 10px; }
          .chart-card h3 { font-size: 13.5px; }
          .chart-card .chart-sub { font-size: 10.5px; }
          .chart-canvas { height: 200px; }

          .summary-card { padding: 14px; border-radius: 10px; }
          .priority-summary { gap: 14px; }
          .priority-ring { width: 76px; height: 76px; }
        }

        @media (max-width: 900px) {
          .dash-main { padding: 16px 14px; }
          .stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .summary-grid { grid-template-columns: 1fr; }
          .chart-card { min-height: 200px; }
        }
      `}</style>

      <div className="dash-body">
        <Sidebar
          user={user}
          activePath={location.pathname}
          onNavigate={navigate}
          onLogout={handleLogout}
        />

        {/* Main content */}
        <main className="dash-main">
          <div className="dash-header-row">
            <div className="dash-header-title">
              <p>Welcome back,</p>
              <h2>{user.full_name}</h2>
            </div>
            <button className="btn-export-summary" onClick={() => setModalExportSummary(true)}>
              <Download size={14} /> Export Summary
            </button>
          </div>

          <div className="stat-row">
            <StatCard label="Today" value={stats.todayTotal} sub="Registrations logged today" icon={<CalendarDays size={16} />} highlighted />
            <StatCard label="This Week" value={stats.weekTotal} sub="Last 7 days total" icon={<TrendingUp size={16} />} />
            <StatCard label="Priority Today" value={stats.priorityToday} sub="Flagged as priority" icon={<Star size={16} />} />
            <StatCard label="Waiting Now" value={stats.waitingNow} sub="Currently in queue" icon={<Clock size={16} />} />
          </div>

          <div className="chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
              <h3>Complainants by day</h3>
              <span className="chart-sub">Last 7 days</span>
            </div>
            {loading ? (
              <div className="chart-skeleton" />
            ) : (
              <LineChart data={chartData} />
            )}
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <h3>Records by Region</h3>
              <p className="chart-sub">Last 7 days</p>
              {regionData.length === 0 ? (
                <p className="region-empty">No records with region data yet.</p>
              ) : (
                <div className="region-list">
                  {regionData.map(r => (
                    <div className="region-row" key={r.region}>
                      <span className="region-name" title={r.region}>{r.region}</span>
                      <div className="region-bar-track">
                        <div
                          className="region-bar-fill"
                          style={{ width: `${regionData[0].count > 0 ? (r.count / regionData[0].count) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="region-count">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="summary-card">
              <h3>Priority Overview</h3>
              <p className="chart-sub">Last 7 days</p>
              <div className="priority-summary">
                <div
                  className="priority-ring"
                  style={{ background: `conic-gradient(#F0A500 0% ${priorityBreakdown.pct}%, rgba(240,165,0,0.12) ${priorityBreakdown.pct}% 100%)` }}
                >
              <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--panel-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>                    <span className="priority-ring-value">{priorityBreakdown.pct}%</span>
                  </div>
                </div>
                <div className="priority-legend">
                  <div className="priority-legend-row">
                    <span className="priority-dot" style={{ background: '#F0A500' }} />
                    Priority
                    <span className="priority-legend-count">{priorityBreakdown.priority}</span>
                  </div>
                  <div className="priority-legend-row">
                    <span className="priority-dot" style={{ background: 'rgba(240,165,0,0.2)' }} />
                    Regular
                    <span className="priority-legend-count">{priorityBreakdown.regular}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {modalExportSummary && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.55)', padding: 20
          }}
        >
          <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 22, width: 380, maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: 16 }}>Export Summary</h3>
              <button
                onClick={() => setModalExportSummary(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
            <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
              Choose a format to download today's dashboard overview — stats, priority breakdown, and records by region.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={exportSummary}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: '#F0A500', border: 'none', color: '#1c1c22', fontWeight: 700, fontSize: 13,
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer'
                }}
              >
                <Download size={14} /> CSV
              </button>
              <button
                onClick={exportSummaryPDF}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: '#F0A500', border: 'none', color: '#1c1c22', fontWeight: 700, fontSize: 13,
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer'
                }}
              >
                <FileDown size={14} /> PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}