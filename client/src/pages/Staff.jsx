import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

function shortenCcd(ccd) {
  if (!ccd || ccd === "---") return "---";
  const parts = ccd.split("-");
  if (parts.length > 1) return "#" + parts[parts.length - 1];
  return ccd;
}

export default function StaffController() {
  useEffect(() => { document.title = "Staff Controller | NBI QMS"; }, []);
  const socket = useSocket();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  // Load any cached queue state so switching tabs and coming back
  // shows the last known data instantly instead of a blank screen
  // while the socket reconnects and fetches fresh data.
  const CACHE_KEY = 'nbi_staff_queue_cache';
  const cached = (() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const [connected, setConnected] = useState(false);
  const [currentlyServing, setCurrentlyServing] = useState(cached?.currentlyServing ?? null);
  const [waitingList, setWaitingList] = useState(cached?.waitingList ?? []);
  const [skippedList, setSkippedList] = useState(cached?.skippedList ?? []);
  const [stats, setStats] = useState(cached?.stats ?? { waiting: 0, served: 0, skipped: 0, total: 0 });
  const [cycleLabel, setCycleLabel] = useState(cached?.cycleLabel ?? "---");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [serveModalOpen, setServeModalOpen] = useState(false);
  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [personToServeId, setPersonToServeId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState({});


  useEffect(() => {
    if (!socket) return;
    setConnected(socket.connected);
    
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    
    const onStaffUpdate = (data) => {
      const nextCurrentlyServing = data.currentlyServing
        ? {
            id: data.currentlyServing.id,
            ccdNo: data.currentlyServing.ccdNo,
            fullName: data.currentlyServing.fullName,
            isPriority: data.currentlyServing.isPriority
          }
        : null;
      const nextWaitingList = data.waitingList || [];
      const nextSkippedList = data.skippedList || [];
      const nextStats = data.stats || { waiting: 0, served: 0, skipped: 0, total: 0 };
      const nextCycleLabel = data.cycleLabel || "---";

      setCurrentlyServing(nextCurrentlyServing);
      setWaitingList(nextWaitingList);
      setSkippedList(nextSkippedList);
      setStats(nextStats);
      setCycleLabel(nextCycleLabel);

      // Cache the latest snapshot so it survives a tab switch / socket reconnect
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          currentlyServing: nextCurrentlyServing,
          waitingList: nextWaitingList,
          skippedList: nextSkippedList,
          stats: nextStats,
          cycleLabel: nextCycleLabel
        }));
      } catch {
        // sessionStorage full or unavailable — ignore, caching is best-effort
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('staff_update', onStaffUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('staff_update', onStaffUpdate);
    };
  }, [socket]);

  const withLoading = (key, ms, fn) => {
    setLoading((l) => ({ ...l, [key]: true }));
    fn();
    setTimeout(() => setLoading((l) => ({ ...l, [key]: false })), ms);
  };

  const callNext = () => {
    if (waitingList.length === 0 && !currentlyServing) return;
    withLoading("next", 1000, () => socket?.emit("next"));
  };

  const callSkipped = () => {
    if (skippedList.length === 0) return;
    withLoading("callSkipped", 1000, () => socket?.emit("call_skipped"));
  };

  const requestSkip = () => {
    if (!currentlyServing) return;
    setSkipModalOpen(true);
  };

  const confirmSkip = () => {
    withLoading("skip", 1000, () => socket?.emit("skip"));
    setSkipModalOpen(false);
  };

  const toggleBreak = () => {
    if (onBreak) {
      setOnBreak(false);
    } else {
      setBreakModalOpen(true);
    }
  };

  const confirmBreak = () => {
    if (currentlyServing) {
      withLoading("end", 1000, () => socket?.emit("end_current"));
    }
    setOnBreak(true);
    setBreakModalOpen(false);
  };

  const repeatAnnouncement = () => {
    if (!currentlyServing) return;
    withLoading("repeat", 1000, () => socket?.emit("repeat_announcement"));
  };

  const undo = () => {
    if (!window.confirm("Are you sure you want to undo the last action? This will revert the screen to the previous person.")) return;
    withLoading("undo", 1000, () => socket?.emit("undo"));
  };

  const openServeModal = (id) => {
    setPersonToServeId(id);
    setServeModalOpen(true);
  };

  const closeServeModal = () => {
    setPersonToServeId(null);
    setServeModalOpen(false);
  };

  const confirmServe = () => {
    if (personToServeId) {
      socket?.emit("serve_specific", personToServeId);
    }
    closeServeModal();
  };

  const archivePerson = (id) => {
    if (!window.confirm("Archive this complainant? Their status will be marked as SERVED but they will NOT appear in Currently Serving or trigger the TV display.")) return;
    socket?.emit("archive_person", id);
  };

  const confirmReset = () => {
    socket?.emit("reset");
    setResetModalOpen(false);
  };

  const isQueueEmpty = waitingList.length === 0;
  const hasCurrentlyServing = !!currentlyServing;

if (!user) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>      <Sidebar
        user={user}
        activePath={location.pathname}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
      <div className="staff-body" style={{ flex: 1, minWidth: 0 }}>
      <style>{`
        html, body { background-color: var(--bg-color) !important; margin: 0; height: 100%; overflow: hidden; }
        .staff-body {
          background: var(--bg-color);
          height: 100vh;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          flex: 1;
          width: 100%;
          font-family: 'Inter', sans-serif;
          color: var(--text-main);
          box-sizing: border-box;
          overflow: hidden;
        }
        .staff-body *, .staff-body *::before, .staff-body *::after { box-sizing: border-box; }

        .staff-nav {
          display: flex;
          justify-content: center;
          align-items: center;
          background: var(--panel-bg);
          border-bottom: 1px solid var(--border-color);
          padding: 0.6rem 0;
          flex-shrink: 0;
          z-index: 50;
          backdrop-filter: blur(10px);
        }
        .nav-links-container { display: flex; justify-content: center; gap: 2rem; flex-grow: 1; }

        .staff-container {
          max-width: 1400px; margin: 0 auto; padding: 0.6rem 1rem 0.6rem;
          flex: 1; display: flex; flex-direction: column; width: 100%; min-height: 0; overflow: hidden;
        }
        .dashboard-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: stretch; flex: 1; min-height: 0; }
        .left-column { display: flex; flex-direction: column; gap: 0.45rem; min-height: 0; }
        .right-column { display: flex; flex-direction: column; height: 100%; gap: 0.7rem; min-height: 0; }

        .dashboard-card {
          background: var(--panel-bg); border: 1px solid var(--border-color);
          border-radius: 16px; padding: 1rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          width: 100%; display: flex; flex-direction: column;
        }

        .waiting-card, .skipped-card { padding: 1rem; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
        .waiting-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 8px; min-height: 0; max-height: none; }
        .serving-card {
          text-align: center;
          background: var(--panel-bg);
          border-color: rgba(243, 156, 18, 0.3);
          padding: 0.7rem;
        }
        .card-label { font-size: 1rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 3px; margin-bottom: 0.4rem; }
        .status-display { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
        .status-number { font-size: 3.4rem; font-weight: 800; color: #f39c12; text-shadow: 0 0 40px rgba(243, 156, 18, 0.3); line-height: 1; margin-bottom: 0.2rem; }
        .status-name { font-size: 1.4rem; font-weight: 600; color: var(--text-main); }
        .priority-badge {
          display: inline-block; background: #f39c12; color: #0b1d3a; padding: 0.3rem 1rem;
          border-radius: 50px; font-weight: 800; font-size: 0.9rem; text-transform: uppercase;
          letter-spacing: 2px; margin-bottom: 0.6rem;
        }

        .btn { border-radius: 16px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; border: none; user-select: none; }
        .btn:active:not(:disabled) { transform: scale(0.98); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-next {
          background: linear-gradient(135deg, #f1c40f, #f39c12); color: #0b1d3a; padding: 0.8rem;
          flex-direction: column; gap: 0.3rem; box-shadow: 0 8px 25px rgba(243, 156, 18, 0.3); min-height: 64px;
        }
        .btn-next:hover:not(:disabled) { background: linear-gradient(135deg, #f39c12, #e67e22); box-shadow: 0 12px 35px rgba(243, 156, 18, 0.5); transform: translateY(-2px); }
        .btn-call-skipped { background: linear-gradient(135deg, #e74c3c, #c0392b); box-shadow: 0 8px 25px rgba(231, 76, 60, 0.3); color: white; }
        .btn-call-skipped:hover:not(:disabled) { background: linear-gradient(135deg, #c0392b, #a8352a); }

        .secondary-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; width: 100%; }
        .btn-secondary { padding: 0.6rem; flex-direction: row; gap: 0.6rem; font-size: 0.95rem; font-weight: 700; color: var(--text-main); min-height: 40px; }
        .btn-skip { background: rgba(149, 165, 166, 0.2); border: 1px solid rgba(149, 165, 166, 0.4); }
        .btn-skip:hover:not(:disabled) { background: rgba(149, 165, 166, 0.3); }
        .btn-repeat { background: rgba(52, 152, 219, 0.2); border: 1px solid rgba(52, 152, 219, 0.4); color: #3498db; }
        .btn-repeat:hover:not(:disabled) { background: rgba(52, 152, 219, 0.3); }
        .btn-reset { background: rgba(231, 76, 60, 0.2); border: 1px solid rgba(231, 76, 60, 0.4); color: #e74c3c; }
        .btn-reset:hover:not(:disabled) { background: rgba(231, 76, 60, 0.3); }
        .btn-end { background: rgba(46, 204, 113, 0.15); border: 1px solid rgba(46, 204, 113, 0.4); color: #2ecc71; }
        .btn-end:hover:not(:disabled) { background: rgba(46, 204, 113, 0.3); }
        .btn-undo { grid-column: 1 / -1; background: rgba(155, 89, 182, 0.2); border: 1px solid rgba(155, 89, 182, 0.4); color: #9b59b6; }
        .btn-undo:hover:not(:disabled) { background: rgba(155, 89, 182, 0.3); }

        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; width: 100%; }
        .stat-card { background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 12px; padding: 0.5rem; text-align: center; }
        .stat-value { font-size: 1.2rem; font-weight: 800; color: var(--text-main); line-height: 1.2; }
        .stat-label { font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .stat-waiting { color: #f39c12 !important; }
        .stat-served { color: #2ecc71 !important; }
        .stat-skipped { color: #e74c3c !important; }

        .waiting-card, .skipped-card { padding: 1.5rem; display: flex; flex-direction: column; flex: 1; min-height: 0; }
        .waiting-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex-grow: 1; display: flex; flex-direction: column; gap: 0.8rem; padding-right: 10px; min-height: 0; max-height: 480px; }
        .waiting-list::-webkit-scrollbar { width: 8px; }
        .waiting-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        .waiting-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
        .waiting-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }

        .waiting-item {
          background: var(--bg-color); border: 1px solid var(--border-color); padding: 1.2rem 1.5rem;
          border-radius: 12px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;
        }
        .waiting-item.is-priority { border-left: 6px solid #f39c12; background: linear-gradient(90deg, rgba(243, 156, 18, 0.1) 0%, rgba(0,0,0,0.3) 100%); }
        .waiting-item.next-up { border: 1px solid rgba(46, 204, 113, 0.5); box-shadow: inset 0 0 20px rgba(46, 204, 113, 0.1); background: linear-gradient(90deg, rgba(46, 204, 113, 0.1) 0%, rgba(0,0,0,0.3) 100%); }
        .waiting-item.next-up.is-priority {
          border-left: 6px solid #f39c12; border-top: 1px solid rgba(243, 156, 18, 0.5);
          border-bottom: 1px solid rgba(243, 156, 18, 0.5); border-right: 1px solid rgba(243, 156, 18, 0.5);
          box-shadow: inset 0 0 20px rgba(243, 156, 18, 0.15);
        }
        .waiting-info { display: flex; flex-direction: column; gap: 0.2rem; }
        .waiting-ccd { color: var(--text-main); font-weight: 800; font-size: 1.2rem; }
        .waiting-name { color: var(--text-muted); font-weight: 500; font-size: 1rem; }
        .wait-time { font-size: 0.8rem; color: #f39c12; margin-top: 0.3rem; font-weight: 600; }
        .waiting-badge { background: rgba(243, 156, 18, 0.2); color: #f39c12; padding: 0.3rem 0.8rem; border-radius: 6px; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; }

        .btn-serve-now {
          background: rgba(46, 204, 113, 0.15); border: 1px solid rgba(46, 204, 113, 0.4); color: #2ecc71;
          padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.9rem;
          transition: all 0.2s; white-space: nowrap;
        }
        .btn-serve-now:hover { background: rgba(46, 204, 113, 0.3); }
        .btn-serve-now.danger { background: #e74c3c; border: 1px solid #c0392b; color: white; }

        .btn-archive {
          background: rgba(149, 165, 166, 0.15); border: 1px solid rgba(149, 165, 166, 0.4); color: #95a5a6;
          padding: 0.6rem 0.75rem; border-radius: 8px; cursor: pointer; font-size: 1rem; line-height: 1;
          transition: all 0.2s; display: flex; align-items: center; justify-content: center;
        }
        .btn-archive:hover { background: rgba(231, 76, 60, 0.25); border-color: rgba(231, 76, 60, 0.5); color: #e74c3c; }

        .empty-state { text-align: center; padding: 4rem 2rem; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .empty-icon { font-size: 3rem; opacity: 0.5; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); display: none; align-items: center; justify-content: center; z-index: 1000; }
        .modal-overlay.active { display: flex; }
        .modal-box { background: var(--panel-bg); border: 1px solid #e74c3c; padding: 2.5rem; border-radius: 16px; text-align: center; max-width: 400px; box-shadow: 0 10px 40px rgba(231, 76, 60, 0.2); }
        .modal-title { font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-bottom: 1rem; }
        .modal-text { color: var(--text-muted); line-height: 1.5; margin-bottom: 2rem; }
        .modal-actions { display: flex; gap: 1rem; }
        .btn-cancel { flex: 1; padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-main); cursor: pointer; font-weight: 600; }
        .btn-confirm-danger { flex: 1; padding: 1rem; border-radius: 8px; border: none; background: #e74c3c; color: white; cursor: pointer; font-weight: 800; }
        .btn-confirm-success { background: #2ecc71 !important; }

        .mobile-queue-toggle { display: none; background: rgba(243, 156, 18, 0.1); border: 1px solid rgba(243, 156, 18, 0.3); color: #f39c12; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; align-items: center; gap: 0.5rem; margin-right: auto; }
        .mobile-queue-close { display: none; }

        @media (max-width: 1200px) {
          .staff-container { padding: 1.5rem; }
          .dashboard-layout { grid-template-columns: 55% 45%; gap: 1rem; }
          .status-number { font-size: 4rem; }
        }

        @media (max-width: 900px) {
          .dashboard-layout { grid-template-columns: 1fr; gap: 1.5rem; }
          .right-column { height: auto; min-height: 400px; }
          .waiting-list { max-height: 450px; }
          .stats-row { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
          .status-number { font-size: 4.5rem; }
          .secondary-controls { gap: 0.8rem; }
        }

        @media (max-width: 640px) {
          .staff-container { padding: 1.5rem 1rem; }
          .dashboard-layout { grid-template-columns: 1fr; gap: 1.5rem; }
          .left-column { gap: 1rem; }
          .dashboard-card { padding: 1.5rem; }
          .btn-next { min-height: 90px; padding: 1rem; }
          .secondary-controls { grid-template-columns: 1fr; gap: 0.8rem; }
          .btn-secondary { min-height: 56px; font-size: 1.1rem; padding: 1rem; }
          .stats-row { gap: 0.5rem; }
          .stat-card { padding: 0.8rem 0.5rem; }
          .stat-value { font-size: 1.4rem; }
          .stat-label { font-size: 0.7rem; }
          .waiting-item { flex-direction: column; align-items: flex-start; gap: 1rem; padding: 1rem; }
          .waiting-item > div:last-child { width: 100%; display: flex; justify-content: space-between; align-items: center; }
          .btn-serve-now { width: 100%; text-align: center; }
          .staff-nav { justify-content: flex-start; padding-left: 1rem; }
          .nav-links-container { justify-content: flex-start; gap: 1rem; }
          .mobile-queue-toggle { display: flex; }
          .right-column {
            position: fixed; top: 0; right: ${mobileOpen ? "0" : "-100%"}; width: 100%; height: 100vh;
            background: var(--bg-color); z-index: 1000; padding: 1.5rem; transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow-y: auto; box-shadow: -5px 0 30px rgba(0,0,0,0.4);
          }
          .mobile-queue-close { display: flex; align-self: flex-end; background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.4); font-size: 1.2rem; cursor: pointer; margin-bottom: 1rem; padding: 0.5rem; border-radius: 8px; width: 40px; height: 40px; align-items: center; justify-content: center; }
        }

        @media (max-width: 480px) {
          .staff-container { padding: 1rem 0.5rem; }
          .dashboard-card { padding: 1rem; }
          .status-number { font-size: 3.5rem; }
          .status-name { font-size: 1.5rem; }
          .btn-next { min-height: 80px; padding: 0.8rem; font-size: 1.2rem; }
          .btn-secondary { min-height: 50px; font-size: 1rem; padding: 0.8rem; }
          .stats-row { grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }
          .stat-value { font-size: 1.2rem; }
          .stat-card { padding: 0.6rem 0.4rem; }
          .staff-nav { padding: 0.5rem; }
          .mobile-queue-toggle { font-size: 0.9rem; padding: 0.4rem 0.8rem; }
          .nav-links-container { gap: 0.5rem; }

          /* Call Next / Call Skipped: i-stack patayo imbes na magkatabi, para hindi masikip */
          .call-buttons-row { flex-direction: column; }
          .btn-next .btn-next-label { font-size: 1.3rem !important; }
          .status-display .priority-badge { font-size: 0.75rem; padding: 0.25rem 0.7rem; }
        }
      `}</style>

      <div className="staff-nav">
        <button className="mobile-queue-toggle" onClick={() => setMobileOpen(true)}>☰ Queue</button>
        <div className="nav-links-container" />
      </div>

      <div className="staff-container">
        <div className="dashboard-layout">
          <div className="left-column">
            <div className="dashboard-card serving-card">
              <div className="card-label">Currently Serving</div>
              <div className="status-display">
                {currentlyServing?.isPriority && <div className="priority-badge">Priority PWD/Senior</div>}
                <div className="status-number">{currentlyServing ? shortenCcd(currentlyServing.ccdNo) : "---"}</div>
                <div className="status-name">{currentlyServing ? currentlyServing.fullName : "Waiting..."}</div>
              </div>
            </div>

            <div className="call-buttons-row" style={{ display: "flex", gap: "1rem", width: "100%" }}>
              <button
                className="btn btn-next"
                style={{ flex: 1.5 }}
                disabled={onBreak || (isQueueEmpty && !hasCurrentlyServing)}
                onClick={callNext}
              >
                <span className="btn-next-label" style={{ fontSize: "1.6rem", fontWeight: 800, textTransform: "uppercase" }}>Call Next</span>
                <span style={{ fontSize: "1rem", fontWeight: 600, opacity: 0.8 }}>{cycleLabel}</span>
              </button>
              <button
                className="btn btn-next btn-call-skipped"
                style={{ flex: 1 }}
                disabled={onBreak || skippedList.length === 0}
                onClick={callSkipped}
              >
                <span style={{ fontSize: "1.4rem", fontWeight: 800, textTransform: "uppercase" }}>Call Skipped</span>
                <span style={{ fontSize: "1rem", fontWeight: 600, opacity: 0.8, color: "rgba(255,255,255,0.8)" }}>Oldest First</span>
              </button>
            </div>

            <div className="secondary-controls">
              <button className="btn btn-secondary btn-end" onClick={toggleBreak}>
                <span>{loading.end ? "Ending..." : onBreak ? "Continue" : "End Session (Break)"}</span>
              </button>
              <button className="btn btn-secondary btn-skip" disabled={onBreak || !hasCurrentlyServing} onClick={requestSkip}>
                <span>{loading.skip ? "Skipping..." : "Skip Person"}</span>
              </button>
              <button className="btn btn-secondary btn-repeat" disabled={onBreak || !hasCurrentlyServing} onClick={repeatAnnouncement}>
                <span>{loading.repeat ? "Repeating..." : "Repeat Voice"}</span>
              </button>
              <button className="btn btn-secondary btn-reset" disabled={onBreak} onClick={() => setResetModalOpen(true)}>
                <span>Reset Queue</span>
              </button>
              <button className="btn btn-secondary btn-undo" disabled={onBreak} onClick={undo}>
                <span>{loading.undo ? "Undoing..." : "↩ Undo Last Action"}</span>
              </button>
            </div>

            <div className="stats-row">
              <div className="stat-card"><div className="stat-value stat-waiting">{stats.waiting}</div><div className="stat-label">Wait</div></div>
              <div className="stat-card"><div className="stat-value stat-served">{stats.served}</div><div className="stat-label">Served</div></div>
              <div className="stat-card"><div className="stat-value stat-skipped">{stats.skipped}</div><div className="stat-label">Skip</div></div>
              <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total</div></div>
            </div>
          </div>

          <div className="right-column">
            <button className="mobile-queue-close" onClick={() => setMobileOpen(false)}>✕</button>

            <div className="dashboard-card waiting-card">
              <div className="card-label" style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                <span>Queue Preview</span>
                <span style={{ color: "white", fontWeight: "bold", background: "rgba(255,255,255,0.1)", padding: "0.2rem 0.8rem", borderRadius: "50px" }}>
                  {waitingList.length}
                </span>
              </div>

              <ul className="waiting-list">
                {waitingList.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✓</div>
                    <div>No complainants in queue. Waiting for registrations.</div>
                  </div>
                ) : (
                  waitingList.map((person, index) => (
                    <li key={person.id} className={`waiting-item${person.isPriority ? " is-priority" : ""}${index === 0 ? " next-up" : ""}`}>
                      <div className="waiting-info">
                        <span className="waiting-ccd">{shortenCcd(person.ccdNo)}</span>
                        <span className="waiting-name">{person.fullName}</span>
                        <span className="wait-time">{index === 0 ? "Up Next" : `Est. wait: ~${index * 5} mins`}</span>
                      </div>
                      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", width: "auto" }}>
                        <div className="waiting-badge" style={person.isPriority ? { background: "rgba(243, 156, 18, 0.2)", color: "#f39c12" } : { background: "rgba(255,255,255,0.1)", color: "white" }}>
                          {person.isPriority ? "[PRIORITY]" : "[REGULAR]"}
                        </div>
                        <button className="btn-serve-now" disabled={onBreak} onClick={() => openServeModal(person.id)}>Serve Now</button>
                        <button className="btn-archive" disabled={onBreak} title="Archive (mark as served)" onClick={() => archivePerson(person.id)}>X</button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

              <div className="dashboard-card skipped-card" style={{ background: "rgba(231, 76, 60, 0.1)", border: "1px solid rgba(231, 76, 60, 0.3)" }}>
                <div className="card-label" style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                  <span style={{ color: "#ffb8b8" }}>Skipped Complainants</span>
                  <span style={{ color: "white", fontWeight: "bold", background: "rgba(231, 76, 60, 0.5)", padding: "0.2rem 0.8rem", borderRadius: "50px" }}>
                    {skippedList.length}
                  </span>
                </div>
                <ul className="waiting-list">
                  {skippedList.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">✓</div>
                      <div>No skipped complainants.</div>
                    </div>
                  ) : (
                    skippedList.map((person) => (
                      <li key={person.id} className={`waiting-item${person.isPriority ? " is-priority" : ""}`}>
                        <div className="waiting-info">
                          <span className="waiting-ccd" style={{ color: "#ffb8b8" }}>{shortenCcd(person.ccdNo)}</span>
                          <span className="waiting-name">{person.fullName}</span>
                          <span className="wait-time" style={{ color: "#e74c3c" }}>Skipped</span>
                        </div>
                        <div style={{ display: "flex", gap: "1rem", alignItems: "center", width: "auto" }}>
                          <div className="waiting-badge" style={person.isPriority ? { background: "rgba(243, 156, 18, 0.2)", color: "#f39c12" } : { background: "rgba(255,255,255,0.1)", color: "white" }}>
                            {person.isPriority ? "[PRIORITY] PWD/Senior" : "[REGULAR] Lane"}
                          </div>
                          <button className="btn-serve-now danger" disabled={onBreak} onClick={() => openServeModal(person.id)}>Serve Now</button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
          </div>
        </div>
      </div>

      <div className={`modal-overlay${resetModalOpen ? " active" : ""}`}>
        <div className="modal-box">
          <div className="modal-title">Reset Entire Queue?</div>
          <div className="modal-text">Are you sure you want to completely reset the queue? This will skip everyone who hasn't been served and clear today's records.</div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setResetModalOpen(false)}>Cancel</button>
            <button className="btn-confirm-danger" onClick={confirmReset}>Yes, Reset</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay${serveModalOpen ? " active" : ""}`}>
        <div className="modal-box">
          <div className="modal-title">Serve Immediately?</div>
          <div className="modal-text">Yank this person out of line and serve them immediately? This will bypass the normal queue order.</div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={closeServeModal}>Cancel</button>
            <button className="btn-confirm-danger btn-confirm-success" onClick={confirmServe}>Serve Now</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay${breakModalOpen ? " active" : ""}`}>
        <div className="modal-box">
          <div className="modal-title">Take a Break?</div>
          <div className="modal-text">Are you sure you want to go on break? The current session will be marked as ended.</div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setBreakModalOpen(false)}>Cancel</button>
            <button className="btn-confirm-danger btn-confirm-success" onClick={confirmBreak}>Yes, Go on Break</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay${skipModalOpen ? " active" : ""}`}>
        <div className="modal-box">
          <div className="modal-title">Skip Person?</div>
          <div className="modal-text">Are you sure you want to skip this person? They will be moved to the skipped list.</div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setSkipModalOpen(false)}>Cancel</button>
            <button className="btn-confirm-danger" onClick={confirmSkip}>Yes, Skip</button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}