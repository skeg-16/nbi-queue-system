import React, { useState, useEffect } from "react";
import { useSocket } from '../context/SocketContext';

function shortenCcd(ccd) {
  if (!ccd || ccd === "---") return "---";
  const parts = ccd.split("-");
  if (parts.length > 1) return "#" + parts[parts.length - 1];
  return ccd;
}

export default function StaffController() {
  useEffect(() => { document.title = "Staff Controller | NBI QMS"; }, []);
  const socket = useSocket();
  const [connected, setConnected] = useState(false);
  const [currentlyServing, setCurrentlyServing] = useState(null);
  const [waitingList, setWaitingList] = useState([]);
  const [skippedList, setSkippedList] = useState([]);
  const [stats, setStats] = useState({ waiting: 0, served: 0, skipped: 0, total: 0 });
  const [cycleLabel, setCycleLabel] = useState("---");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [serveModalOpen, setServeModalOpen] = useState(false);
  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [personToServeId, setPersonToServeId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState({});

  useEffect(() => {
    document.body.classList.add('zoom-layout');
    return () => document.body.classList.remove('zoom-layout');
  }, []);

  useEffect(() => {
    if (!socket) return;
    setConnected(socket.connected);
    
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    
    const onStaffUpdate = (data) => {
      if (data.currentlyServing) {
        setCurrentlyServing({
          id: data.currentlyServing.id,
          ccdNo: data.currentlyServing.ccdNo,
          fullName: data.currentlyServing.fullName,
          isPriority: data.currentlyServing.isPriority
        });
      } else {
        setCurrentlyServing(null);
      }
      setWaitingList(data.waitingList || []);
      setSkippedList(data.skippedList || []);
      setStats(data.stats || { waiting: 0, served: 0, skipped: 0, total: 0 });
      setCycleLabel(data.cycleLabel || "---");
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

  return (
    <div className="staff-body">
      <style>{`
        .staff-body {
          background: radial-gradient(circle at top, #11284d 0%, #050e1d 100%);
          min-height: 100vh;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', sans-serif;
          color: white;
          box-sizing: border-box;
        }
        .staff-body *, .staff-body *::before, .staff-body *::after { box-sizing: border-box; }

        .staff-nav {
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(5, 14, 29, 0.95);
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding: 1rem 0;
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(10px);
        }
        .nav-links-container { display: flex; justify-content: center; gap: 2rem; flex-grow: 1; }
        .connection-indicator-wrapper {
          position: absolute; right: 2rem; display: flex; align-items: center;
          gap: 0.5rem; font-size: 0.85rem; color: #a0aec0; font-weight: 600;
        }
        .connection-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background-color: #e74c3c; box-shadow: 0 0 8px #e74c3c; transition: all 0.3s ease;
        }
        .connection-dot.connected { background-color: #2ecc71; box-shadow: 0 0 8px #2ecc71; }

        .staff-container {
          max-width: 1400px; margin: 0 auto; padding: 1.5rem 2rem 2rem;
          flex-grow: 1; display: flex; flex-direction: column; width: 100%;
        }
        .dashboard-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: stretch; flex-grow: 1; }
        .left-column { display: flex; flex-direction: column; gap: 1rem; }
        .right-column { display: flex; flex-direction: column; height: 100%; gap: 1rem; }

        .dashboard-card {
          background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px; padding: 1.5rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          backdrop-filter: blur(15px); width: 100%; display: flex; flex-direction: column;
        }
        .serving-card {
          text-align: center;
          background: linear-gradient(145deg, rgba(243, 156, 18, 0.05), rgba(0,0,0,0.3));
          border-color: rgba(243, 156, 18, 0.2);
        }
        .card-label { font-size: 1.1rem; color: #a0aec0; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 1rem; }
        .status-display { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .status-number { font-size: 5rem; font-weight: 800; color: #f39c12; text-shadow: 0 0 40px rgba(243, 156, 18, 0.3); line-height: 1; margin-bottom: 0.2rem; }
        .status-name { font-size: 2rem; font-weight: 600; color: white; }
        .priority-badge {
          display: inline-block; background: #f39c12; color: #0b1d3a; padding: 0.4rem 1.2rem;
          border-radius: 50px; font-weight: 800; font-size: 1rem; text-transform: uppercase;
          letter-spacing: 2px; margin-bottom: 1rem;
        }

        .btn { border-radius: 16px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; border: none; user-select: none; }
        .btn:active:not(:disabled) { transform: scale(0.98); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-next {
          background: linear-gradient(135deg, #f1c40f, #f39c12); color: #0b1d3a; padding: 1.5rem;
          flex-direction: column; gap: 0.5rem; box-shadow: 0 8px 25px rgba(243, 156, 18, 0.3); min-height: 100px;
        }
        .btn-next:hover:not(:disabled) { background: linear-gradient(135deg, #f39c12, #e67e22); box-shadow: 0 12px 35px rgba(243, 156, 18, 0.5); transform: translateY(-2px); }
        .btn-call-skipped { background: linear-gradient(135deg, #e74c3c, #c0392b); box-shadow: 0 8px 25px rgba(231, 76, 60, 0.3); color: white; }
        .btn-call-skipped:hover:not(:disabled) { background: linear-gradient(135deg, #c0392b, #a8352a); }

        .secondary-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; width: 100%; }
        .btn-secondary { padding: 1.2rem; flex-direction: row; gap: 0.8rem; font-size: 1.2rem; font-weight: 700; color: white; min-height: 60px; }
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

        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; width: 100%; }
        .stat-card { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1rem; text-align: center; }
        .stat-value { font-size: 1.8rem; font-weight: 800; color: white; line-height: 1.2; }
        .stat-label { font-size: 0.85rem; color: #a0aec0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
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
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); padding: 1.2rem 1.5rem;
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
        .waiting-ccd { color: white; font-weight: 800; font-size: 1.2rem; }
        .waiting-name { color: #a0aec0; font-weight: 500; font-size: 1rem; }
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

        .empty-state { text-align: center; padding: 4rem 2rem; color: #a0aec0; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .empty-icon { font-size: 3rem; opacity: 0.5; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); display: none; align-items: center; justify-content: center; z-index: 1000; }
        .modal-overlay.active { display: flex; }
        .modal-box { background: #0d1f3d; border: 1px solid #e74c3c; padding: 2.5rem; border-radius: 16px; text-align: center; max-width: 400px; box-shadow: 0 10px 40px rgba(231, 76, 60, 0.3); }
        .modal-title { font-size: 1.5rem; font-weight: 800; color: white; margin-bottom: 1rem; }
        .modal-text { color: #a0aec0; line-height: 1.5; margin-bottom: 2rem; }
        .modal-actions { display: flex; gap: 1rem; }
        .btn-cancel { flex: 1; padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: white; cursor: pointer; font-weight: 600; }
        .btn-confirm-danger { flex: 1; padding: 1rem; border-radius: 8px; border: none; background: #e74c3c; color: white; cursor: pointer; font-weight: 800; }
        .btn-confirm-success { background: #2ecc71 !important; }

        .mobile-queue-toggle { display: none; background: rgba(243, 156, 18, 0.1); border: 1px solid rgba(243, 156, 18, 0.3); color: #f39c12; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; align-items: center; gap: 0.5rem; margin-right: auto; }
        .mobile-queue-close { display: none; }

        @media (max-width: 1024px) {
          .dashboard-layout { gap: 1.5rem; }
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
          .connection-indicator-wrapper { position: static; margin-left: auto; margin-right: 1rem; }
          .staff-nav { justify-content: flex-start; padding-left: 1rem; }
          .nav-links-container { justify-content: flex-start; gap: 1rem; }
          .mobile-queue-toggle { display: flex; }
          .right-column {
            position: fixed; top: 0; right: ${mobileOpen ? "0" : "-100%"}; width: 100%; height: 100vh;
            background: #050e1d; z-index: 1000; padding: 1.5rem; transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow-y: auto; box-shadow: -5px 0 30px rgba(0,0,0,0.8);
          }
          .mobile-queue-close { display: flex; align-self: flex-end; background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.4); font-size: 1.2rem; cursor: pointer; margin-bottom: 1rem; padding: 0.5rem; border-radius: 8px; width: 40px; height: 40px; align-items: center; justify-content: center; }
        }
      `}</style>

      <div className="staff-nav">
        <button className="mobile-queue-toggle" onClick={() => setMobileOpen(true)}>☰ Queue</button>
        <div className="nav-links-container" />
        <div className="connection-indicator-wrapper">
          <span style={{ color: connected ? "#2ecc71" : "#e74c3c" }}>{connected ? "Live" : "Offline"}</span>
          <div className={`connection-dot${connected ? " connected" : ""}`} />
        </div>
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

            <div style={{ display: "flex", gap: "1rem", width: "100%" }}>
              <button
                className="btn btn-next"
                style={{ flex: 1.5 }}
                disabled={onBreak || (isQueueEmpty && !hasCurrentlyServing)}
                onClick={callNext}
              >
                <span style={{ fontSize: "1.6rem", fontWeight: 800, textTransform: "uppercase" }}>Call Next</span>
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

            {skippedList.length > 0 && (
              <div className="dashboard-card skipped-card" style={{ background: "rgba(231, 76, 60, 0.1)", border: "1px solid rgba(231, 76, 60, 0.3)" }}>
                <div className="card-label" style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                  <span style={{ color: "#ffb8b8" }}>Skipped Complainants</span>
                  <span style={{ color: "white", fontWeight: "bold", background: "rgba(231, 76, 60, 0.5)", padding: "0.2rem 0.8rem", borderRadius: "50px" }}>
                    {skippedList.length}
                  </span>
                </div>
                <ul className="waiting-list">
                  {skippedList.map((person) => (
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
                  ))}
                </ul>
              </div>
            )}
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
  );
}