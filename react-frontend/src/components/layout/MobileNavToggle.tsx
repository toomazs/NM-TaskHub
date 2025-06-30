import React from 'react';
import { useLayout } from '../../contexts/LayoutContext'; 

const buttonStyle: React.CSSProperties = {
  position: 'fixed',
  top: '15px',
  left: '15px',
  zIndex: 1001, 
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  width: '40px',
  height: '40px',
  borderRadius: '8px',
  cursor: 'pointer',
};

const iconStyle: React.CSSProperties = {
  fontSize: '16px',
};

const mediaQueryStyle = `
  .mobile-nav-toggle {
    display: none; /* ESCONDE o botão por padrão em telas grandes */
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 992px) {
    .mobile-nav-toggle {
      display: flex; /* MOSTRA o botão apenas em telas menores que 992px */
    }
  }
`;

export function MobileNavToggle() {
  const { toggleMobileNav, isMobileNavOpen } = useLayout();

  return (
    <>
      <style>{mediaQueryStyle}</style>
      <button 
        className="mobile-nav-toggle" 
        style={buttonStyle}
        onClick={toggleMobileNav}
        aria-label="Toggle navigation"
      >
        <i 
          className={isMobileNavOpen ? "fas fa-times" : "fas fa-bars"} 
          style={iconStyle}
        ></i>
      </button>
    </>
  );
}