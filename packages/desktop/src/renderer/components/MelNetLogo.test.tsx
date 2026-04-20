import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MelNetLogo from './MelNetLogo';

describe('MelNetLogo', () => {
  it('renders an SVG with a polygon (hexagon)', () => {
    const { container } = render(<MelNetLogo />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('polygon')).toBeInTheDocument();
  });

  it('renders 6 network-connection dots (circles)', () => {
    const { container } = render(<MelNetLogo />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(6);
  });

  it('renders 3 connection lines between opposite vertices', () => {
    const { container } = render(<MelNetLogo />);
    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(3);
  });

  it('uses default size of 48', () => {
    const { container } = render(<MelNetLogo />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('48');
    expect(svg.getAttribute('height')).toBe('48');
  });

  it('respects custom size prop', () => {
    const { container } = render(<MelNetLogo size={96} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('96');
    expect(svg.getAttribute('height')).toBe('96');
  });

  it('fills the hexagon with Amarelo Mel (#F5A623)', () => {
    const { container } = render(<MelNetLogo />);
    expect(container.querySelector('polygon')!.getAttribute('fill')).toBe('#F5A623');
  });

  it('dots are filled with Branco Cera (#FFFDF5)', () => {
    const { container } = render(<MelNetLogo />);
    container.querySelectorAll('circle').forEach((c) => {
      expect(c.getAttribute('fill')).toBe('#FFFDF5');
    });
  });

  it('has an accessible aria-label', () => {
    render(<MelNetLogo />);
    expect(screen.getByRole('img', { name: 'MelNet logo' })).toBeInTheDocument();
  });
});
