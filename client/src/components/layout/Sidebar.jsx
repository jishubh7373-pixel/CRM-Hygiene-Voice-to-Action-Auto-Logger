import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Mic,
  TrendingUp,
  CheckSquare,
  Network,
  Settings,
  ShieldCheck,
  Zap,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ mobileOpen, onClose }) => {
  const { user, organization } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Voice Meetings', path: '/meetings', icon: Mic },
    { name: 'Deal Intelligence', path: '/deals', icon: TrendingUp },
    { name: 'Action Center', path: '/action-center', icon: CheckSquare },
    { name: 'Approval Center', path: '/approvals', icon: ShieldCheck },
    { name: 'Integrations', path: '/integrations', icon: Network },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
          }}
        >
          <Zap size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            DealFlow <span style={{ color: 'var(--primary)' }}>AI</span>
          </h1>
          <p style={{ fontSize: '0.675rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            CRM Auto-Logger
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mobile-sidebar-close"
          style={{ display: 'none', marginLeft: 'auto' }}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
      </div>

      {/* Tenant Scope Card */}
      <div
        style={{
          margin: '1rem 1.25rem 0.5rem 1.25rem',
          padding: '0.75rem 1rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
          <ShieldCheck size={13} style={{ color: 'var(--success)' }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
            Active Tenant
          </span>
        </div>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {organization?.name || 'Organization'}
        </p>
        <span
          style={{
            fontSize: '0.675rem',
            padding: '0.1rem 0.45rem',
            background: 'var(--primary-subtle)',
            color: 'var(--primary)',
            borderRadius: 'var(--radius-xs)',
            fontWeight: 700,
            display: 'inline-block',
            marginTop: '0.25rem',
            textTransform: 'uppercase',
          }}
        >
          {organization?.plan || 'Professional'} Plan
        </span>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '0.75rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                if (onClose) onClose();
              }}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#ffffff' : 'var(--text-muted)',
                background: isActive ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0.05) 100%)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'all 0.15s ease',
              })}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Mini Profile Footer */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'rgba(0, 0, 0, 0.2)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--primary-subtle)',
            border: '1px solid var(--primary-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            color: 'var(--primary)',
            fontSize: '0.85rem',
          }}
        >
          {user?.name?.charAt(0) || 'U'}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user?.name}
          </p>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
            {user?.role} Role
          </span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
