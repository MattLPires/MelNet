import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BeeStatusIcon from './BeeStatusIcon';

describe('BeeStatusIcon', () => {
  it('renders an SVG element', () => {
    const { container } = render(<BeeStatusIcon connected={true} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('uses default size of 24', () => {
    const { container } = render(<BeeStatusIcon connected={true} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
  });

  it('respects custom size prop', () => {
    const { container } = render(<BeeStatusIcon connected={false} size={32} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('32');
  });

  it('shows "Connected" aria-label when connected', () => {
    render(<BeeStatusIcon connected={true} />);
    expect(screen.getByRole('img', { name: 'Connected' })).toBeInTheDocument();
  });

  it('shows "Disconnected" aria-label when disconnected', () => {
    render(<BeeStatusIcon connected={false} />);
    expect(screen.getByRole('img', { name: 'Disconnected' })).toBeInTheDocument();
  });

  it('applies pulse animation when connected', () => {
    const { container } = render(<BeeStatusIcon connected={true} />);
    const svg = container.querySelector('svg')!;
    expect(svg.style.animation).toContain('bee-pulse');
  });

  it('has no animation when disconnected', () => {
    const { container } = render(<BeeStatusIcon connected={false} />);
    const svg = container.querySelector('svg')!;
    expect(svg.style.animation).toBe('none');
  });

  it('applies grayscale filter when disconnected', () => {
    const { container } = render(<BeeStatusIcon connected={false} />);
    const svg = container.querySelector('svg')!;
    expect(svg.style.filter).toBe('grayscale(1)');
  });

  it('has no filter when connected', () => {
    const { container } = render(<BeeStatusIcon connected={true} />);
    const svg = container.querySelector('svg')!;
    expect(svg.style.filter).toBe('none');
  });
});
