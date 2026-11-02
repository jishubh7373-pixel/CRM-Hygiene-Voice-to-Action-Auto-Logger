import React from 'react';
import { LogOut, Activity, Building, UserCheck, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Topbar = ({ onToggleMobileNav }) => {
  const { user, organization, logout } = useAuth();

  return (
    <header
      className="topbar-container"
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--bg-app)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* System Telemetry & Isolation Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="mobile-nav-toggle"
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>

        <div
          className="topbar-desktop-badge"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.75rem',
            background: 'var(--success-subtle)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            color: 'var(--success)',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 8px var(--success)',
            }}
          />
          <span>Auto-Logger Operational</span>
        </div>

        <div className="topbar-domain-info" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          <Building size={14} />
          <span>Domain: <strong>{organization?.domain}</strong></span>
        </div>
      </div>

      {/* User Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {user?.name}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
              {user?.role} &bull; {user?.title}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="btn btn-secondary btn-sm"
          title="Sign out of your session"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
