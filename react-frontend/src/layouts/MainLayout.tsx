import React from 'react';
import { useLayout } from '../contexts/LayoutContext'; 
import { Sidebar } from '../components/layout/Sidebar'; 

export function MainLayout({ children }: { children: React.ReactNode }) {
    const { isSidebarCollapsed, isMobileNavOpen } = useLayout();

    const mainContentClass = `
        main-content 
        ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}
        ${isMobileNavOpen ? 'mobile-nav-open' : ''}
    `;
    
    return (
        <div className="app-container">
            <Sidebar />
            <main className={mainContentClass}>
                {children}
            </main>
        </div>
    );
}
