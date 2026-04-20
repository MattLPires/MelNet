import React from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  mono?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  mono = false,
  className,
  id,
  ...props
}) => {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={styles.wrapper}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          styles.input,
          mono ? styles.mono : '',
          error ? styles.hasError : '',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
};

export default Input;
