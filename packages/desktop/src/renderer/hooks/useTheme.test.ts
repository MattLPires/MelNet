import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { applyTheme, useTheme } from './useTheme';

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('sets data-theme="dark" when dark is true', () => {
    applyTheme(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('sets data-theme="light" when dark is false', () => {
    applyTheme(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('useTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies dark theme via hook', () => {
    renderHook(() => useTheme(true));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applies light theme via hook', () => {
    renderHook(() => useTheme(false));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('updates theme when value changes', () => {
    const { rerender } = renderHook(({ dark }) => useTheme(dark), {
      initialProps: { dark: true },
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    rerender({ dark: false });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
