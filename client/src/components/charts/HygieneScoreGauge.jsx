import React from 'react';

const HygieneScoreGauge = ({ score = 85 }) => {
  const radius = 64;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = (s) => {
    if (s >= 75) return 'var(--success)';
    if (s >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getLabel = (s) => {
    if (s >= 80) return 'Optimal Hygiene';
    if (s >= 65) return 'Minor Risk Factors';
    if (s >= 50) return 'High Stale Risk';
    return 'Critical CRM Decay';
  };

  const strokeColor = getColor(score);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: 150, height: 150 }}>
        <svg height={150} width={150} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            stroke="rgba(255, 255, 255, 0.08)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={75}
            cy={75}
          />
          {/* Progress circle */}
          <circle
            stroke={strokeColor}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{
              strokeDashoffset,
              transition: 'stroke-dashoffset 0.8s ease-in-out',
              strokeLinecap: 'round',
            }}
            r={normalizedRadius}
            cx={75}
            cy={75}
          />
        </svg>

        {/* Center score readout */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '2rem', fontWeight: 800, color: strokeColor, lineHeight: 1 }}>{score}%</span>
          <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.2rem' }}>
            Health
          </span>
        </div>
      </div>
      <p style={{ marginTop: '0.5rem', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)' }}>
        {getLabel(score)}
      </p>
    </div>
  );
};

export default HygieneScoreGauge;
