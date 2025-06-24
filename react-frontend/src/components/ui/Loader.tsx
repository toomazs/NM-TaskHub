import React from 'react';

interface LoaderProps {
  fullScreen?: boolean;
  isVisible?: boolean; 
}

export function Loader({ fullScreen = true, isVisible = true }: LoaderProps) {
  const loaderClasses = [
    'loader',
    fullScreen ? 'fullscreen' : '',
    isVisible ? 'visible' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={loaderClasses}>
      <div className="spinner">
        <div className="dot1"></div>
        <div className="dot2"></div>
        <div className="dot3"></div>
      </div>
    </div>
  );
}