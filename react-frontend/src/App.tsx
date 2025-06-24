import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

// Pages
import { LoginPage } from './pages/LoginPage';
import { KanbanPage } from './pages/KanbanPage';
import { PrivateBoardsPage } from './pages/PrivateBoardsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LigacoesPage } from './pages/LigacoesPage';
import { AvaliacoesPage } from './pages/AvaliacoesPage';
import { AgendaPage } from './pages/AgendaPage';

function ProtectedAppLayout() {
  return (
    <LayoutProvider>
      <BoardProvider>
        <NotificationsProvider>
          <ModalManager />
          <MainLayout /> 
        </NotificationsProvider>
      </BoardProvider>
    </LayoutProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <ProtectedAppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<KanbanPage />} /> 
        <Route path="board/:boardId" element={<KanbanPage />} />
        <Route path="private-boards" element={<PrivateBoardsPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="ligacoes" element={<LigacoesPage />} />
        <Route path="avaliacoes" element={<AvaliacoesPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ModalProvider>
        <AuthProvider>
          <Toaster
            position="bottom-right"
            reverseOrder={false}
            toastOptions={{
              style: {
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-modal)',
                padding: '1.25rem',
                minWidth: '320px',
              },
              success: {
                iconTheme: {
                  primary: 'var(--accent-green)',
                  secondary: 'white',
                },
                style: {
                  borderLeft: '5px solid var(--accent-green)',
                },
              },
              error: {
                iconTheme: {
                  primary: 'var(--accent-red)',
                  secondary: 'white',
                },
                style: {
                  borderLeft: '5px solid var(--accent-red)',
                },
              },
            }}
          />
          <AppRoutes />
        </AuthProvider>
      </ModalProvider>
    </BrowserRouter>
  );
}
