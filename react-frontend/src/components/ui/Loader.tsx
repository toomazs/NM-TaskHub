import React from 'react';

interface LoaderProps {
  fullScreen?: boolean;
  isVisible?: boolean; // Usaremos esta prop para controlar o fade
}

export function Loader({ fullScreen = true, isVisible = true }: LoaderProps) {
  // Constrói as classes CSS para aplicar o estilo e a animação
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