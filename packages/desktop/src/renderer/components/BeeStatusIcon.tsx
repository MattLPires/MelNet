import React from 'react';

export interface BeeStatusIconProps {
  /** Whether the client is connected to the relay server */
  connected: boolean;
  /** Size in pixels (width & height). Default 24 */
  size?: number;
}

const STYLE_ID = 'bee-status-keyframes';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@keyframes bee-pulse {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8%); }
}`;
  document.head.appendChild(style);
}

/**
 * Animated bee icon used as a connection-status indicator.
 * Connected: gentle pulse/bounce animation with Amarelo Mel color.
 * Disconnected: grayscale, static.
 */
const BeeStatusIcon: React.FC<BeeStatusIconProps> = ({ connected, size = 24 }) => {
  ensureKeyframes();

  const color = connected ? '#F5A623' : '#888';
  const wingColor = connected ? '#FFD166' : '#aaa';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={connected ? 'Connected' : 'Disconnected'}
      style={{
        animation: connected ? 'bee-pulse 1.5s ease-in-out infinite' : 'none',
        filter: connected ? 'none' : 'grayscale(1)',
      }}
    >
      {/* Wings */}
      <ellipse cx="8" cy="8" rx="3.5" ry="2.5" fill={wingColor} opacity={0.7} />
      <ellipse cx="16" cy="8" rx="3.5" ry="2.5" fill={wingColor} opacity={0.7} />

      {/* Body */}
      <ellipse cx="12" cy="14" rx="5" ry="6" fill={color} />

      {/* Stripes */}
      <rect x="7" y="12" width="10" height="1.5" rx="0.5" fill="#1A1A1A" opacity={0.5} />
      <rect x="7" y="15" width="10" height="1.5" rx="0.5" fill="#1A1A1A" opacity={0.5} />

      {/* Eyes */}
      <circle cx="10.5" cy="11.5" r="1" fill="#FFFDF5" />
      <circle cx="13.5" cy="11.5" r="1" fill="#FFFDF5" />
    </svg>
  );
};

export default BeeStatusIcon;
