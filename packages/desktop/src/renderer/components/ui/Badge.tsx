import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'danger';
}

const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  className,
  children,
  ...props
}) => {
  const classes = [styles.badge, styles[variant], className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
};

export default Badge;
