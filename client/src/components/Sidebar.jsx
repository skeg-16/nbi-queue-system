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
} from 'lucide-react';
/**
 * Reusable app sidebar. Drop this into any page.
 *
 * All nav links live HERE, in one place — add/remove/reorder a menu
 * item once and every page that uses <Sidebar /> updates automatically.
 * No need to pass navItems from each page anymore.
 *
 * Props:
 *  - user:        { full_name, role }            (required)
 *  - activePath:  string  -> usually `location.pathname` from the page
 *  - onNavigate:  (path) => void  -> usually `navigate` from react-router
 *  - onLogout:    () => void
 *  - collapsed / onCollapsedChange: optional controlled mode.
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
  { icon: FileEdit, label: 'Register', path: '/kiosk-x7f2', external: true },
  { icon: FileText, label: 'Feedback Forms', path: '/csat-f5w9/en', external: true },
  { icon: Tv, label: 'TV Display', path: '/monitor-d9k4', external: true },
];

function NavItem({ icon: Icon, label, active, collapsed, onClick }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} title={collapsed ? label : undefined}>
      <span className="nav-icon"><Icon size={17} strokeWidth={2} /></span>
      {!collapsed && <span className="nav-label">{label}</span>}
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
        }
        .sidebar-brand { overflow: hidden; }
        .sidebar-brand p { margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
          padding: 10px 12px;
          margin-bottom: 3px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #c9d4ec;
          font-weight: 500;
          font-size: 13.5px;
          cursor: pointer;
          text-align: left;
        }
        .app-sidebar.collapsed .nav-item { justify-content: center; padding: 10px; }
        .nav-item:hover { background: rgba(240,165,0,0.08); }
        .nav-item.active { background: rgba(240,165,0,0.14); color: #F0A500; font-weight: 700; }
        .nav-icon { font-size: 16px; width: 18px; text-align: center; flex-shrink: 0; }
        .nav-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .sidebar-bottom { border-top: 1px solid rgba(240,165,0,0.15); padding-top: 10px; }

        .sidebar-backdrop { display: none; }

        @media (max-width: 900px) {
          .app-sidebar:not(.collapsed) {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            z-index: 60;
            box-shadow: 0 0 40px rgba(0,0,0,0.55);
          }
          .sidebar-backdrop.show {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 55;
          }
        }
      `}</style>

      {/* Backdrop shown only on mobile while the sidebar is expanded */}
      <div className={`sidebar-backdrop ${!collapsed ? 'show' : ''}`} onClick={() => setCollapsed(true)} />

      <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>        <div 
      className="sidebar-top">
          {collapsed ? (
            <button className="logo-toggle" onClick={() => setCollapsed(false)} title="Expand sidebar">
              <img src="/assets/nbi.png" alt="NBI Logo" className="sidebar-logo logo-default" />
              <span className="logo-hover-icon"><ChevronsRight size={16} /></span>
            </button>
          ) : (
            <>
              <img src="/assets/nbi.png" alt="NBI Logo" className="sidebar-logo" />
              <div className="sidebar-brand" style={{ flex: 1 }}>
                <p className="name">{user.full_name}</p>
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
              {!collapsed && <p className="nav-section-label" style={{ marginTop: '36px' }}>Quick Access</p>}
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
          <NavItem icon={Settings} label="Profile" collapsed={collapsed} onClick={() => onNavigate('/profile')} />
          <NavItem icon={LogOut} label="Logout" collapsed={collapsed} onClick={onLogout} />
        </div>
      </aside>
    </>
  );
}