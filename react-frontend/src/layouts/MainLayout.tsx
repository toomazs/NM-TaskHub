import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../contexts/LayoutContext';

export function MainLayout() {
    const { isSidebarCollapsed } = useLayout();

    const mainStyle = {
        paddingLeft: isSidebarCollapsed 
            ? 'var(--sidebar-width-collapsed)' 
            : 'var(--sidebar-width-expanded)',
        transition: 'padding-left 0.3s ease-in-out', 
    };

    return (
        <div className="app-container">
            {}
            <Sidebar />

            {}
            <main style={mainStyle}>
                {}
                <Outlet /> 
            </main>
        </div>
    );
}