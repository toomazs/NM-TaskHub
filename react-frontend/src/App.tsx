import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { BoardProvider } from './contexts/BoardContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { ModalProvider } from './contexts/ModalContext';
import { LayoutProvider } from './contexts/LayoutContext';

// Layouts e UI
import { MainLayout } from './layouts/MainLayout';
import { ModalManager } from './components/modals/ModalManager';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import { MobileNavToggle } from './components/layout/MobileNavToggle';

// Pages
import { LoginPage } from './pages/LoginPage';
import { KanbanPage } from './pages/KanbanPage';
import { PrivateBoardsPage } from './pages/PrivateBoardsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LigacoesPage } from './pages/LigacoesPage';
import { AvaliacoesPage } from './pages/AvaliacoesPage';
import { AgendaPage } from './pages/AgendaPage';
import { ContatosPage } from './pages/ContatosPage';


const ProtectedPagesLayout = () => {
  return (
    <ProtectedRoute>
      <LayoutProvider>
        <BoardProvider>
          <NotificationsProvider>
            <MobileNavToggle />
            <ModalManager />
            <MainLayout>
      
              <Outlet />
            </MainLayout>
          </NotificationsProvider>
        </BoardProvider>
      </LayoutProvider>
    </ProtectedRoute>
  );
};


export function App() {
  return (
    <AuthProvider>
      <ModalProvider>
        <BrowserRouter>
          <Toaster
            position="bottom-right"
            reverseOrder={false}
            gutter={12}
            containerClassName="toast-container"
            containerStyle={{
              bottom: 20,
              right: 20,
              zIndex: 9999,
            }}
            toastOptions={{
              duration: 4000,
              className: 'custom-toast',
              style: {
                background: 'var(--bg-card, #ffffff)',
                color: 'var(--text-primary, #1f2937)',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: '16px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                padding: '16px 20px',
                minWidth: '340px',
                maxWidth: '420px',
                fontSize: '14px',
                lineHeight: '1.5',
                fontWeight: '500',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              },
              success: {
                duration: 3500,
                className: 'custom-toast-success',
                iconTheme: {
                  primary: 'var(--accent-green, #10b981)',
                  secondary: '#ffffff',
                },
                style: {
                  borderLeft: '4px solid var(--accent-green, #10b981)',
                  background: 'linear-gradient(135deg, var(--bg-card, #ffffff) 0%, rgba(16, 185, 129, 0.05) 100%)',
                },
              },
              error: {
                duration: 5000,
                className: 'custom-toast-error',
                iconTheme: {
                  primary: 'var(--accent-red, #ef4444)',
                  secondary: '#ffffff',
                },
                style: {
                  borderLeft: '4px solid var(--accent-red, #ef4444)',
                  background: 'linear-gradient(135deg, var(--bg-card, #ffffff) 0%, rgba(239, 68, 68, 0.05) 100%)',
                },
              },
              loading: {
                className: 'custom-toast-loading',
                iconTheme: {
                  primary: 'var(--accent-blue, #3b82f6)',
                  secondary: '#ffffff',
                },
                style: {
                  borderLeft: '4px solid var(--accent-blue, #3b82f6)',
                  background: 'linear-gradient(135deg, var(--bg-card, #ffffff) 0%, rgba(59, 130, 246, 0.05) 100%)',
                },
              },
              blank: {
                duration: 4500,
                className: 'custom-toast-blank',
                style: {
                  borderLeft: '4px solid var(--accent-blue, #3b82f6)',
                  background: 'linear-gradient(135deg, var(--bg-card, #ffffff) 0%, rgba(59, 130, 246, 0.05) 100%)',
                },
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<ProtectedPagesLayout />}>
              <Route index element={<KanbanPage />} />
              <Route path="board/:boardId" element={<KanbanPage />} />
              <Route path="private-boards" element={<PrivateBoardsPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="ligacoes" element={<LigacoesPage />} />
              <Route path="avaliacoes" element={<AvaliacoesPage />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="contatos-preventivos" element={<ContatosPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ModalProvider>
    </AuthProvider>
  );
}
