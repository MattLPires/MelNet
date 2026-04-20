import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme';
import styles from './SettingsPage.module.css';

interface SettingsPageProps {
  onBack: () => void;
}

const PLACEHOLDER_INTERFACES = ['Automático', 'Ethernet', 'Wi-Fi', 'VPN'];

const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const [networkInterface, setNetworkInterface] = useState('Automático');
  const [notifications, setNotifications] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const [darkTheme, setDarkTheme] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Keep document theme in sync with toggle
  useTheme(darkTheme);

  // Load preferences from SQLite on mount
  useEffect(() => {
    const load = async () => {
      try {
        const prefs = await window.melnetDb.preferences.getAll();
        if (prefs.networkInterface) setNetworkInterface(prefs.networkInterface);
        if (prefs.notifications !== undefined) setNotifications(prefs.notifications === 'true');
        if (prefs.autoStart !== undefined) setAutoStart(prefs.autoStart === 'true');
        if (prefs.darkTheme !== undefined) setDarkTheme(prefs.darkTheme === 'true');
      } catch {
        // DB not available (e.g. in tests) — use defaults
      }
      setLoaded(true);
    };
    load();
  }, []);

  const persist = useCallback(async (key: string, value: string) => {
    try {
      await window.melnetDb.preferences.set(key, value);
    } catch {
      // DB not available — ignore
    }
  }, []);

  const handleNetworkChange = (value: string) => {
    setNetworkInterface(value);
    persist('networkInterface', value);
  };

  const handleNotificationsChange = (checked: boolean) => {
    setNotifications(checked);
    persist('notifications', String(checked));
  };

  const handleAutoStartChange = (checked: boolean) => {
    setAutoStart(checked);
    persist('autoStart', String(checked));
    try {
      window.melnetApp?.setAutoStart(checked);
    } catch {
      // Electron API not available (e.g. in tests)
    }
  };

  const handleThemeChange = (checked: boolean) => {
    setDarkTheme(checked);
    persist('darkTheme', String(checked));
  };

  if (!loaded) return null;

  return (
    <div className={styles.settings}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} data-testid="back-btn">
          ← Voltar
        </button>
        <h1 className={styles.title}>Configurações</h1>
      </header>

      <main className={styles.content}>
        {/* Network interface selector */}
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Interface de rede</span>
          <select
            className={styles.select}
            value={networkInterface}
            onChange={(e) => handleNetworkChange(e.target.value)}
            data-testid="network-select"
            aria-label="Interface de rede"
          >
            {PLACEHOLDER_INTERFACES.map((iface) => (
              <option key={iface} value={iface}>
                {iface}
              </option>
            ))}
          </select>
        </div>

        {/* Notifications toggle */}
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Notificações desktop</span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={notifications}
              onChange={(e) => handleNotificationsChange(e.target.checked)}
              data-testid="notifications-toggle"
              aria-label="Notificações desktop"
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        {/* Auto-start toggle */}
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Iniciar com o sistema</span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={autoStart}
              onChange={(e) => handleAutoStartChange(e.target.checked)}
              data-testid="autostart-toggle"
              aria-label="Iniciar com o sistema"
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        {/* Theme toggle */}
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Tema escuro</span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={darkTheme}
              onChange={(e) => handleThemeChange(e.target.checked)}
              data-testid="theme-toggle"
              aria-label="Tema escuro"
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
