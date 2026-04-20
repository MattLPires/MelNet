import { useEffect } from 'react';

/**
 * Applies the data-theme attribute to <html> based on the darkTheme preference.
 * Call this at the top level of the app (e.g. in SettingsPage or App)
 * whenever the theme preference changes.
 */
export function applyTheme(dark: boolean): void {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

/**
 * React hook that keeps the document theme in sync with the given preference.
 * Also loads the saved preference from the database on mount.
 */
export function useTheme(dark: boolean): void {
  useEffect(() => {
    applyTheme(dark);
  }, [dark]);
}
