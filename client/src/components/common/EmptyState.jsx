import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no active records in this category.',
  actionLabel = '',
  onAction = null,
}) => {
  return (
    <div
      style={{
        padding: '3.5rem 1.5rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        background: 'rgba(255, 255, 255, 0.01)',
        borderRadius: 'var(--radius-md)',
        border: '1px dashed var(--border-light)',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--primary-subtle)',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={24} />
      </div>
      <div style={{ maxWidth: 360 }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
          {title}
        </h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{description}</p>
      </div>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
