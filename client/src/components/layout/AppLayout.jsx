import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const AppLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)' }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div
        className={`mobile-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <div className="app-main-wrapper">
        <Topbar onToggleMobileNav={() => setMobileOpen(!mobileOpen)} />
        <main className="app-content-area" style={{ padding: '2rem', flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
