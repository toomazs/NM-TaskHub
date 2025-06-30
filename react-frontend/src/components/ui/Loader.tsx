import React from 'react';
import styles from './Loader.module.css';

interface LoaderProps {
  fullScreen?: boolean;
  isVisible?: boolean;
  text?: string; 
}

export function Loader({ fullScreen = true, isVisible = true, text }: LoaderProps) {
  const loaderClasses = [
    styles.loader,
    fullScreen ? styles.fullscreen : '',
    isVisible ? styles.visible : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={loaderClasses}>
      <div className={styles.spinner}>
        <div className={styles.dot1}></div>
        <div className={styles.dot2}></div>
        <div className={styles.dot3}></div>
      </div>
      {text && <p className={styles.loaderText}>{text}</p>}
    </div>
  );
}