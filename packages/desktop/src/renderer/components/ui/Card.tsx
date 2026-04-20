import React from 'react';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg';
}

const Card: React.FC<CardProps> = ({
  padding = 'md',
  className,
  children,
  ...props
}) => {
  const classes = [
    styles.card,
    padding !== 'md' ? styles[padding] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export default Card;
