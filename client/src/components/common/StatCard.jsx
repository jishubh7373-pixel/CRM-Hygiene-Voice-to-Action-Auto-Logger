import React from 'react';

const StatCard = ({ title, value, subtitle, icon: Icon, trend, trendLabel, color = 'primary' }) => {
  const colorMap = {
    primary: { bg: 'var(--primary-subtle)', border: 'var(--primary-border)', text: 'var(--primary)' },
    success: { bg: 'var(--success-subtle)', border: 'var(--success-border)', text: 'var(--success)' },
    warning: { bg: 'var(--warning-subtle)', border: 'var(--warning-border)', text: 'var(--warning)' },
    danger: { bg: 'var(--danger-subtle)', border: 'var(--danger-border)', text: 'var(--danger)' },
  };

  const scheme = colorMap[color] || colorMap.primary;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{title}</span>
        {Icon && (
          <div
            style={{
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              background: scheme.bg,
              border: `1px solid ${scheme.border}`,
              color: scheme.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          {value}
        </h3>
        {trend && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: trend.startsWith('+') ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {trend}
          </span>
        )}
      </div>

      {(subtitle || trendLabel) && (
        <p style={{ fontSize: '0.785rem', color: 'var(--text-dim)' }}>
          {trendLabel && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{trendLabel} </span>}
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default StatCard;
