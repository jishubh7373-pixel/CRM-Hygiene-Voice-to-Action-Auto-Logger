import React from 'react';

const LoadingSpinner = ({ size = 'md', message = '' }) => {
  const pixelSizes = {
    sm: 20,
    md: 36,
    lg: 52,
  };

  const dim = pixelSizes[size] || pixelSizes.md;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
      <div
        style={{
          width: `${dim}px`,
          height: `${dim}px`,
          border: '3px solid var(--border-light)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {message && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{message}</span>}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
