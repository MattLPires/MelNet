import React from 'react';

/** MelNet palette colors used for avatar backgrounds */
const PALETTE = ['#F5A623', '#E07B00'] as const;

/** Extract up to 2 uppercase initials from a nickname string */
export function getInitials(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/** Pick a deterministic palette color based on the initials string */
export function pickColor(initials: string): string {
  let hash = 0;
  for (let i = 0; i < initials.length; i++) {
    hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * Build a flat-top regular hexagon path centered at (cx, cy) with given radius.
 * Vertices start at the rightmost point and go counter-clockwise.
 */
export function hexagonPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

export interface AvatarHoneycombProps {
  /** 1-2 character initials to display (or a nickname to extract initials from) */
  initials: string;
  /** Size in pixels (width & height of the SVG viewBox). Default 48 */
  size?: number;
}

/**
 * Avatar Honeycomb — hexagonal avatar with user initials.
 * Renders a flat-top regular hexagon filled with a MelNet palette color
 * and the user's initials centered in white.
 */
const AvatarHoneycomb: React.FC<AvatarHoneycombProps> = ({ initials, size = 48 }) => {
  const display = initials.length <= 2 ? initials.toUpperCase() : getInitials(initials);
  const fill = pickColor(display);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.45; // slight padding so hex doesn't clip
  const fontSize = size * 0.35;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Avatar ${display}`}
    >
      <polygon points={hexagonPoints(cx, cy, r)} fill={fill} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFDF5"
        fontSize={fontSize}
        fontFamily="Inter, Poppins, sans-serif"
        fontWeight={600}
      >
        {display}
      </text>
    </svg>
  );
};

export default AvatarHoneycomb;
