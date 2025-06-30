import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

interface LayoutContextType {
    isSidebarCollapsed: boolean;
    toggleSidebar: () => void;
    isMobileNavOpen: boolean;
    toggleMobileNav: () => void;
    closeMobileNav: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    const toggleSidebar = useCallback(() => {
        setIsSidebarCollapsed(prev => !prev);
    }, []);
    
    const toggleMobileNav = useCallback(() => {
        setIsMobileNavOpen(prev => !prev);
    }, []);

    const closeMobileNav = useCallback(() => {
        setIsMobileNavOpen(false);
    }, []);

    const value = { 
        isSidebarCollapsed, 
        toggleSidebar, 
        isMobileNavOpen, 
        toggleMobileNav, 
        closeMobileNav 
    };

    return (
        <LayoutContext.Provider value={value}>
            {children}
        </LayoutContext.Provider>
    );
}

export const useLayout = () => {
    const context = useContext(LayoutContext);
    if (!context) {
        throw new Error('useLayout deve ser usado dentro de um LayoutProvider');
    }
    return context;
};
