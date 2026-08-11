import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  MessageSquareText,
  MonitorPlay,
  Users,
  FileEdit,
  FileText,
  Tv,
  Settings,
  LogOut,
  PanelLeftClose,
  ChevronsRight,
  AlertTriangle,
  MoreHorizontal,
  X,
} from 'lucide-react';
/**
 * Reusable app sidebar. Drop this into any page.
 *
 * All nav links live HERE, in one place — add/remove/reorder a menu
 * item once and every page that uses <Sidebar /> updates automatically.
 * No need to pass navItems from each page anymore.
 *
 * On screens <= 900px, this renders a Facebook/LinkedIn-style fixed
 * bottom tab bar instead of the collapsible side panel. The first
 * few MAIN_NAV_ITEMS get their own tab; everything else (admin links,
 * quick access, settings, logout) lives behind a "More" tab that
 * opens a slide-up sheet.
 *
 * Props:
 *  - user:        { username, full_name, role }  (required)
 *  - activePath:  string  -> usually `location.pathname` from the page
 *  - onNavigate:  (path) => void  -> usually `navigate` from react-router
 *  - onLogout:    () => void
 *  - collapsed / onCollapsedChange: optional controlled mode (desktop only).
 *      If you don't pass these, Sidebar manages its own collapsed
 *      state (starts collapsed on screens <= 900px, like before).
 */

// Main nav items. Edit this list to change what shows for everyone.
const MAIN_NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: ClipboardList, label: 'Records', path: '/ledger-m3z6' },
  { icon: MonitorPlay, label: 'Staff Panel', path: '/panel-q1a8' },
];

// Only shown when user.role === 'admin'. Appended after MAIN_NAV_ITEMS.
const ADMIN_NAV_ITEMS = [
  { icon: MessageSquareText, label: 'Feedback Reports', path: '/feedback-reports' },
  { icon: Users, label: 'Manage Users', path: '/manage-users' },
];

// "Quick Access" section, rendered below the main list — things
// everyone uses regardless of role.
const QUICK_ACCESS_ITEMS = [
  { icon: FileEdit, label: 'Register', path: '/register', external: true },
  { icon: FileText, label: 'Feedback Forms', path: '/forms', external: true },
  { icon: Tv, label: 'TV Display', path: '/display', external: true },
];

function NavItem({ icon: Icon, label, active, collapsed, onClick }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} title={collapsed ? label : undefined}>
      <span className="nav-icon"><Icon size={17} strokeWidth={2} /></span>
      {!collapsed && <span className="nav-label">{label}</span>}
    </button>
  );
}

function MobileTab({ icon: Icon, label, active, onClick }) {
  return (
    <button className={`mobile-tab ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={20} strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar({
  user,
  activePath,
  onNavigate,
  onLogout,
  collapsed: collapsedProp,
  onCollapsedChange,
}) {
  const isControlled = collapsedProp !== undefined;
  const [internalCollapsed, setInternalCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  );
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const collapsed = isControlled ? collapsedProp : internalCollapsed;
  const setCollapsed = (val) => {
    if (isControlled) {
      onCollapsedChange && onCollapsedChange(val);
    } else {
      setInternalCollapsed(val);
    }
  };

  const navItems = [
    ...MAIN_NAV_ITEMS,
    ...(user.role === 'admin' ? ADMIN_NAV_ITEMS : []),
  ];

  const displayName = user.username || user.full_name;

  // ---- Mobile bottom-bar split ----
  // All main + admin nav items get their own tab; "..." holds Quick Access, Settings, Logout only.
  const mobileTabItems = navItems;
  const mobileMoreItems = QUICK_ACCESS_ITEMS;
  const isMoreActive = activePath === '/profile';
  function handleMobileNavigate(item) {
    setMobileMoreOpen(false);
    if (item.external) window.open(item.path, '_blank');
    else onNavigate(item.path);
  }

  return (
    <>
      <style>{`
        .app-sidebar {
          width: 240px;
          flex-shrink: 0;
          background: #0F1E30;
          border-right: 1px solid rgba(240,165,0,0.15);
          padding: 20px 14px;
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          transition: width 0.2s ease;
          z-index: 40;
        }
        .app-sidebar.collapsed { width: 76px; }

        .sidebar-top {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 6px 18px 6px;
          border-bottom: 1px solid rgba(240,165,0,0.15);
          margin-bottom: 14px;
          background: transparent;
        }
        .app-sidebar.collapsed .sidebar-top {
          justify-content: center;
          padding: 4px 0 18px 0;
        }

        .logo-toggle {
          position: relative;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }
        .logo-toggle .logo-default { transition: opacity 0.15s ease; }
        .logo-toggle .logo-hover-icon {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: #F0A500;
          opacity: 0;
          transition: opacity 0.15s ease;
          background: rgba(240,165,0,0.12);
          border-radius: 6px;
        }
        .logo-toggle:hover .logo-default { opacity: 0; }
        .logo-toggle:hover .logo-hover-icon { opacity: 1; }

        .sidebar-logo {
          width: 34px; height: 34px; object-fit: contain; flex-shrink: 0;
          filter: drop-shadow(0 0 6px rgba(240,165,0,0.25));
          background: transparent;
        }
        .sidebar-user-avatar {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          border: 1.5px solid rgba(240,165,0,0.4);
          background: rgba(255,255,255,0.06);
        }
        .sidebar-brand { overflow: hidden; background: transparent; }
        .sidebar-brand p { margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: transparent; }
        .sidebar-brand .name { font-size: 13px; font-weight: 700; color: #fff; }
        .sidebar-brand .role { font-size: 11px; color: #F0A500; text-transform: capitalize; }

        .collapse-btn {
          background: transparent;
          border: 1px solid rgba(240,165,0,0.25);
          color: #c9d4ec;
          border-radius: 6px;
          width: 26px; height: 26px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-size: 12px;
        }
        .collapse-btn:hover { border-color: #F0A500; color: #F0A500; }

        .nav-section-label {
          margin: 4px 0 8px 10px;
          font-size: 10px;
          color: #5c6f94;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          font-weight: 600;
        }
        .app-sidebar.collapsed .nav-section-label { text-align: center; margin-left: 0; }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 8px 12px;
          margin-bottom: 2px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #c9d4ec;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          text-align: left;
        }
        .app-sidebar.collapsed .nav-item { justify-content: center; padding: 10px; }
        .nav-item:hover { background: rgba(240,165,0,0.08); }
        .nav-item.active { background: rgba(240,165,0,0.14); color: #F0A500; font-weight: 700; }
        .nav-icon { font-size: 16px; width: 18px; text-align: center; flex-shrink: 0; }
        .nav-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .sidebar-bottom { border-top: 1px solid rgba(240,165,0,0.15); padding-top: 10px; background: transparent; }

        .sidebar-backdrop { display: none; }

        /* ---- Mobile bottom tab bar (FB/LinkedIn style) ---- */
        .mobile-bottom-nav { display: none; }
        .mobile-more-overlay { display: none; }

        @media (max-width: 900px) {
          /* Hide the desktop side panel entirely on mobile — the
             bottom tab bar replaces it. */
          .app-sidebar { display: none; }

          .mobile-bottom-nav {
            display: flex;
            position: fixed;
            bottom: 14px;
            left: 14px;
            right: 14px;
            height: 60px;
            background: #1c1c22;
            border-radius: 22px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.35);
            z-index: 70;
            padding: 0 4px;
            margin-bottom: env(safe-area-inset-bottom, 0);
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .mobile-bottom-nav::-webkit-scrollbar { display: none; }
          .mobile-tab {
            flex: 1 0 auto;
            min-width: 56px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            background: transparent;
            border: none;
            cursor: pointer;
            color: #9a9aa5;
            font-size: 9.5px;
            font-weight: 600;
            padding: 8px 4px 6px;
            position: relative;
          }
          .mobile-tab.active { color: #4d9dff; }
          .mobile-tab.active svg { color: #4d9dff; }
          .mobile-tab.active::after {
            content: '';
            position: absolute;
            bottom: 2px;
            left: 50%;
            transform: translateX(-50%);
            width: 18px;
            height: 2px;
            border-radius: 2px;
            background: #4d9dff;
          }
          .mobile-tab span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 64px;
          }

          .mobile-more-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.45);
            z-index: 80;
          }
          .mobile-more-sheet {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            background: #0F1E30;
            border-top-left-radius: 16px;
            border-top-right-radius: 16px;
            padding: 10px 14px calc(14px + env(safe-area-inset-bottom, 0));
            max-height: 75vh;
            overflow-y: auto;
            z-index: 90;
          }
          .mobile-more-handle {
            width: 40px;
            height: 4px;
            border-radius: 2px;
            background: rgba(255,255,255,0.2);
            margin: 6px auto 14px;
          }
          .mobile-more-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 4px 6px 14px;
            border-bottom: 1px solid rgba(240,165,0,0.15);
            margin-bottom: 10px;
          }
          .mobile-more-close {
            margin-left: auto;
            background: transparent;
            border: none;
            color: #c9d4ec;
            cursor: pointer;
            width: 30px; height: 30px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 8px;
          }
          .mobile-more-close:hover { background: rgba(255,255,255,0.08); }

          /* Give page content room so it isn't hidden behind the floating bar */
          body { padding-bottom: 90px; }
        }

        /* ---- Logout confirm modal ---- */
        .logout-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center; z-index: 100;
          padding: 20px;
        }
        .logout-confirm-modal {
          background: #0d234f;
          border: 1px solid rgba(194,63,63,0.4);
          border-radius: 12px;
          padding: 26px;
          width: 360px;
          max-width: 100%;
          text-align: center;
        }
        .logout-confirm-icon {
          width: 46px; height: 46px; border-radius: 50%;
          background: rgba(194,63,63,0.15);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          color: #e04b4b;
        }
        .logout-confirm-modal h3 { margin: 0 0 8px 0; color: #fff; font-size: 16px; }
        .logout-confirm-modal p { margin: 0 0 22px 0; color: #a9b6d6; font-size: 13px; line-height: 1.5; }
        .logout-confirm-actions { display: flex; gap: 10px; }
        .logout-btn-cancel {
          flex: 1; padding: 10px 16px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #c9d4ec;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
        }
        .logout-btn-cancel:hover { background: rgba(255,255,255,0.1); }
        .logout-btn-confirm {
          flex: 1; padding: 10px 16px;
          background: #c23f3f;
          border: none;
          color: #fff;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
        }
        .logout-btn-confirm:hover { background: #d94848; }
      `}</style>

      {/* ---------- Desktop / tablet sidebar ---------- */}
      <div className={`sidebar-backdrop ${!collapsed ? 'show' : ''}`} onClick={() => setCollapsed(true)} />

      <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`} style={{ background: '#0F1E30' }}>
        <div className="sidebar-top">
          {collapsed ? (
            <button className="logo-toggle" onClick={() => setCollapsed(false)} title="Expand sidebar">
                <span className="logo-hover-icon"><ChevronsRight size={16} /></span>
              </button>
          ) : (
            <>
              <img
                src={`https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(user.avatar_seed || user.full_name || displayName)}`}
                alt={displayName}
                className="sidebar-user-avatar"
              />
              <div className="sidebar-brand" style={{ flex: 1 }}>
                <p className="name">{displayName}</p>
                <p className="role">{user.role}</p>
              </div>
              <button className="collapse-btn" onClick={() => setCollapsed(true)} title="Minimize sidebar">
                <PanelLeftClose size={14} />
              </button>
            </>
          )}
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
              active={activePath === item.path}
              onClick={() => (item.external ? window.open(item.path, '_blank') : onNavigate(item.path))}
            />
          ))}

          {QUICK_ACCESS_ITEMS.length > 0 && (
            <>
           {!collapsed && <p className="nav-section-label" style={{ marginTop: '18px' }}>Quick Access</p>}
              {collapsed && <div style={{ height: '24px' }} />}
              {QUICK_ACCESS_ITEMS.map((item) => (
                <NavItem
                  key={item.path}
                  icon={item.icon}
                  label={item.label}
                  collapsed={collapsed}
                  active={activePath === item.path}
                  onClick={() => (item.external ? window.open(item.path, '_blank') : onNavigate(item.path))}
                />
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <NavItem icon={Settings} label="Settings" collapsed={collapsed} active={activePath === '/profile'} onClick={() => onNavigate('/profile')} />
          <NavItem icon={LogOut} label="Logout" collapsed={collapsed} onClick={() => setConfirmLogout(true)} />
        </div>
      </aside>

      {/* ---------- Mobile bottom tab bar ---------- */}
      <nav className="mobile-bottom-nav">
        {mobileTabItems.map((item) => (
          <MobileTab
            key={item.path}
            icon={item.icon}
            label={item.label}
            active={activePath === item.path}
            onClick={() => (item.external ? window.open(item.path, '_blank') : onNavigate(item.path))}
          />
        ))}
        <MobileTab
          icon={MoreHorizontal}
          label="⋯"
          active={isMoreActive}
          onClick={() => setMobileMoreOpen(true)}
        />
      </nav>

      {/* ---------- Mobile "More" slide-up sheet ---------- */}
      {mobileMoreOpen && (
        <>
          <div className="mobile-more-overlay" onClick={() => setMobileMoreOpen(false)} />
          <div className="mobile-more-sheet">
            <div className="mobile-more-handle" />
            <div className="mobile-more-header">
              <img
                src={`https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(user.avatar_seed || user.full_name || displayName)}`}
                alt={displayName}
                className="sidebar-user-avatar"
              />
              <div className="sidebar-brand" style={{ flex: 1 }}>
                <p className="name">{displayName}</p>
                <p className="role">{user.role}</p>
              </div>
              <button className="mobile-more-close" onClick={() => setMobileMoreOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {mobileMoreItems.length > 0 && (
              <>
                <p className="nav-section-label" style={{ marginTop: '4px' }}>Quick Access</p>
                {mobileMoreItems.map((item) => (
                  <NavItem
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    collapsed={false}
                    active={activePath === item.path}
                    onClick={() => handleMobileNavigate(item)}
                  />
                ))}
              </>
            )}

            <div className="sidebar-bottom" style={{ marginTop: '10px' }}>
              <NavItem icon={Settings} label="Settings" collapsed={false} active={activePath === '/profile'} onClick={() => handleMobileNavigate({ path: '/profile' })} />
              <NavItem icon={LogOut} label="Logout" collapsed={false} onClick={() => { setMobileMoreOpen(false); setConfirmLogout(true); }} />
            </div>
          </div>
        </>
      )}

      {confirmLogout && (
        <div className="logout-modal-overlay" onClick={() => setConfirmLogout(false)}>
          <div className="logout-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="logout-confirm-icon">
              <AlertTriangle size={22} />
            </div>
            <h3>Log Out</h3>
            <p>Are you sure you want to log out? You'll need to sign in again to continue.</p>
            <div className="logout-confirm-actions">
              <button className="logout-btn-cancel" onClick={() => setConfirmLogout(false)}>Cancel</button>
              <button className="logout-btn-confirm" onClick={() => { setConfirmLogout(false); onLogout(); }}>Log Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}