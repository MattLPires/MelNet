import React from 'react';

export interface MelNetLogoProps {
  /** Size in pixels (width & height). Default 48 */
  size?: number;
}

/** Radius of the small network-connection dots at each vertex */
const DOT_RADIUS_RATIO = 0.06;

/**
 * Build vertices for a flat-top regular hexagon centered at (cx, cy).
 * Returns an array of [x, y] pairs.
 */
function hexVertices(cx: number, cy: number, r: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [number, number];
  });
}

/**
 * MelNet Logo — hexagon with network connection dots at each vertex.
 * Filled with Amarelo Mel (#F5A623), dots in Branco Cera (#FFFDF5),
 * and thin connection lines between opposite vertices.
 */
const MelNetLogo: React.FC<MelNetLogoProps> = ({ size = 48 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.44;
  const dotR = size * DOT_RADIUS_RATIO;
  const verts = hexVertices(cx, cy, r);

  const polygonPoints = verts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

  // Connection lines: each vertex to the one two steps away (3 diagonals)
  const connections: [number, number][] = [
    [0, 3],
    [1, 4],
    [2, 5],
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="MelNet logo"
    >
      <polygon points={polygonPoints} fill="#F5A623" />
      {connections.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={verts[a][0]}
          y1={verts[a][1]}
          x2={verts[b][0]}
          y2={verts[b][1]}
          stroke="#FFFDF5"
          strokeWidth={size * 0.02}
          strokeOpacity={0.5}
        />
      ))}
      {verts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={dotR} fill="#FFFDF5" />
      ))}
    </svg>
  );
};

export default MelNetLogo;
