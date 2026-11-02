import React from 'react';

const PipelineFunnel = ({ stageCounts = {}, stageValues = {} }) => {
  const stages = [
    { key: 'discovery', label: 'Discovery', color: '#6366f1' },
    { key: 'qualification', label: 'Qualification', color: '#818cf8' },
    { key: 'demo', label: 'Demo', color: '#06b6d4' },
    { key: 'proposal', label: 'Proposal', color: '#3b82f6' },
    { key: 'negotiation', label: 'Negotiation', color: '#f59e0b' },
    { key: 'closed_won', label: 'Closed Won', color: '#10b981' },
  ];

  const totalValue = Object.values(stageValues).reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {stages.map((stage) => {
        const count = stageCounts[stage.key] || 0;
        const val = stageValues[stage.key] || 0;
        const pct = Math.min(100, Math.round((val / totalValue) * 100)) || (count > 0 ? 15 : 4);

        return (
          <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.785rem' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{stage.label}</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {count} {count === 1 ? 'deal' : 'deals'} &bull; ${val.toLocaleString()}
              </span>
            </div>
            <div
              style={{
                height: 8,
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: stage.color,
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PipelineFunnel;
