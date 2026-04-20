import React from 'react';
import styles from './TitleBar.module.css';

const TitleBar: React.FC = () => {
  const handleMinimize = () => window.melnetWindow?.minimize();
  const handleMaximize = () => window.melnetWindow?.maximize();
  const handleClose = () => window.melnetWindow?.close();

  return (
    <div className={styles.titleBar}>
      <div className={styles.dragRegion}>
        <span className={styles.appName}>MelNet</span>
      </div>
      <div className={styles.controls}>
        <button
          className={styles.controlBtn}
          onClick={handleMinimize}
          aria-label="Minimizar"
        >
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
        </button>
        <button
          className={styles.controlBtn}
          onClick={handleMaximize}
          aria-label="Maximizar"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="9" height="9"/></svg>
        </button>
        <button
          className={`${styles.controlBtn} ${styles.closeBtn}`}
          onClick={handleClose}
          aria-label="Fechar"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2"><line x1="0" y1="0" x2="10" y2="10"/><line x1="10" y1="0" x2="0" y2="10"/></svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
