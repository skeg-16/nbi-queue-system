import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { CalendarDays, TrendingUp, Star, Clock } from 'lucide-react';

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <>
      <style>{`
        .dash-body {
          min-height: 100vh;
          background: var(--bg-color);
          display: flex;
          font-family: 'Inter', Arial, sans-serif;
        }

        /* ---------- Main content ---------- */
        .dash-main { flex: 1; min-width: 0; padding: 30px 32px 60px; }
        .dash-header-title p { margin: 0; color: var(--text-muted); font-size: 13px; }
        .dash-header-title h2 { margin: 2px 0 0 0; color: var(--text-main); font-size: 21px; }

        .stat-row { display: flex; gap: 14px; margin: 22px 0 24px; flex-wrap: wrap; }
        .stat-card {
          background: var(--panel-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 18px 20px;
          flex: 1;
          min-width: 180px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .stat-card.highlighted { border-color: rgba(240,165,0,0.4); background: var(--panel-bg); }
        .stat-label { margin: 0 0 6px 0; color: var(--text-muted); font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase; font-weight: 600; }
        .stat-value { margin: 0; color: var(--text-main); font-size: 24px; font-weight: 700; }
        .stat-sub { margin: 0; font-size: 12px; color: var(--text-muted); }
        .stat-icon {
          width: 34px; height: 34px; border-radius: 50%;
          background: rgba(240,165,0,0.14);
          color: #F0A500;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; flex-shrink: 0;
        }

        .chart-card {
          background: var(--panel-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 22px;
        }
        .chart-card h3 { margin: 0; color: var(--text-main); font-size: 15px; }
        .chart-card .chart-sub { color: var(--text-muted); font-size: 12px; }
        .chart-canvas { width: 100%; height: 300px; }

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
        }

        @media (max-width: 480px) {
          .dash-main { padding: 16px 12px 32px; }
          .dash-header-title p { font-size: 12px; }
          .dash-header-title h2 { font-size: 18px; }

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
          <div className="dash-header-title">
            <p>Welcome back,</p>
            <h2>{user.full_name}</h2>
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
        </main>
      </div>
    </>
  );
}