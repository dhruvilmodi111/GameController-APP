import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'cyan' | 'magenta' | 'lime' | 'amber' | 'neutral';
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'cyan', pulse = false }) => {
  const borderStyles: Record<string, React.CSSProperties> = {
    cyan: { borderColor: 'rgba(0, 240, 255, 0.4)', background: 'rgba(0, 240, 255, 0.1)', color: '#00f0ff' },
    magenta: { borderColor: 'rgba(255, 0, 85, 0.4)', background: 'rgba(255, 0, 85, 0.1)', color: '#ff0055' },
    lime: { borderColor: 'rgba(0, 255, 136, 0.4)', background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88' },
    amber: { borderColor: 'rgba(255, 170, 0, 0.4)', background: 'rgba(255, 170, 0, 0.1)', color: '#ffaa00' },
    neutral: { borderColor: 'rgba(255, 255, 255, 0.2)', background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8' },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        border: '1px solid',
        ...borderStyles[variant],
      }}
    >
      {pulse && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            animation: 'pulse-glow 1.5s infinite',
          }}
        />
      )}
      {children}
    </span>
  );
};
