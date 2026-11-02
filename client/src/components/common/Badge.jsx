import React from 'react';

const Badge = ({ variant = 'neutral', children, icon: Icon = null }) => {
  return (
    <span className={`badge badge-${variant}`}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
};

export default Badge;
