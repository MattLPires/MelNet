import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AvatarHoneycomb, { getInitials, pickColor, hexagonPoints } from './AvatarHoneycomb';

// --- Unit tests for helper functions ---

describe('getInitials', () => {
  it('returns first two chars uppercased for a single word', () => {
    expect(getInitials('alice')).toBe('AL');
  });

  it('returns initials of first two words for multi-word input', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns "?" for empty string', () => {
    expect(getInitials('')).toBe('?');
    expect(getInitials('   ')).toBe('?');
  });

  it('handles single character nickname', () => {
    expect(getInitials('A')).toBe('A');
  });
});

describe('pickColor', () => {
  it('returns a color from the MelNet palette', () => {
    const valid = ['#F5A623', '#E07B00'];
    expect(valid).toContain(pickColor('AB'));
    expect(valid).toContain(pickColor('ZZ'));
  });

  it('returns the same color for the same input (deterministic)', () => {
    expect(pickColor('JD')).toBe(pickColor('JD'));
  });
});

describe('hexagonPoints', () => {
  it('returns 6 coordinate pairs', () => {
    const pts = hexagonPoints(24, 24, 20);
    const pairs = pts.split(' ');
    expect(pairs).toHaveLength(6);
  });

  it('each pair contains x,y numbers', () => {
    const pts = hexagonPoints(24, 24, 20);
    pts.split(' ').forEach((pair) => {
      const [x, y] = pair.split(',').map(Number);
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });
});

// --- Component tests ---

describe('AvatarHoneycomb', () => {
  it('renders an SVG with a polygon and text', () => {
    const { container } = render(<AvatarHoneycomb initials="AB" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('polygon')).toBeInTheDocument();
    expect(container.querySelector('text')).toBeInTheDocument();
  });

  it('displays the provided initials uppercased', () => {
    const { container } = render(<AvatarHoneycomb initials="jd" />);
    expect(container.querySelector('text')!.textContent).toBe('JD');
  });

  it('extracts initials from a longer nickname', () => {
    const { container } = render(<AvatarHoneycomb initials="John Doe" />);
    expect(container.querySelector('text')!.textContent).toBe('JD');
  });

  it('uses default size of 48', () => {
    const { container } = render(<AvatarHoneycomb initials="AB" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('48');
    expect(svg.getAttribute('height')).toBe('48');
  });

  it('respects custom size prop', () => {
    const { container } = render(<AvatarHoneycomb initials="AB" size={64} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('64');
    expect(svg.getAttribute('height')).toBe('64');
  });

  it('has an accessible aria-label', () => {
    render(<AvatarHoneycomb initials="AB" />);
    expect(screen.getByRole('img', { name: 'Avatar AB' })).toBeInTheDocument();
  });

  it('fills the polygon with a MelNet palette color', () => {
    const { container } = render(<AvatarHoneycomb initials="AB" />);
    const fill = container.querySelector('polygon')!.getAttribute('fill');
    expect(['#F5A623', '#E07B00']).toContain(fill);
  });

  it('renders text in Branco Cera (#FFFDF5)', () => {
    const { container } = render(<AvatarHoneycomb initials="AB" />);
    expect(container.querySelector('text')!.getAttribute('fill')).toBe('#FFFDF5');
  });
});
