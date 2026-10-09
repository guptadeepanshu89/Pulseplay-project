import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/AppLayout';
import { ProtectedRoute, SuperAdminRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { BetsPage } from './pages/BetsPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { FundRequestsPage } from './pages/FundRequestsPage';
import { LoginPage } from './pages/LoginPage';
import { MarketsPage } from './pages/MarketsPage';
import { NewClientPage } from './pages/NewClientPage';
import { NewUserPage } from './pages/NewUserPage';
import { UsersPage } from './pages/UsersPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 15_000 } },
});

function Shell({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#5b21b6' } }}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/change-password"
                  element={
                    <ProtectedRoute>
                      <ChangePasswordPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/"
                  element={
                    <Shell>
                      <DashboardPage />
                    </Shell>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <Shell>
                      <UsersPage />
                    </Shell>
                  }
                />
                <Route
                  path="/users/new"
                  element={
                    <Shell>
                      <NewUserPage />
                    </Shell>
                  }
                />
                <Route
                  path="/fund-requests"
                  element={
                    <Shell>
                      <FundRequestsPage />
                    </Shell>
                  }
                />
                <Route
                  path="/bets"
                  element={
                    <Shell>
                      <BetsPage />
                    </Shell>
                  }
                />
                <Route
                  path="/clients"
                  element={
                    <Shell>
                      <SuperAdminRoute>
                        <ClientsPage />
                      </SuperAdminRoute>
                    </Shell>
                  }
                />
                <Route
                  path="/clients/new"
                  element={
                    <Shell>
                      <SuperAdminRoute>
                        <NewClientPage />
                      </SuperAdminRoute>
                    </Shell>
                  }
                />
                <Route
                  path="/markets"
                  element={
                    <Shell>
                      <SuperAdminRoute>
                        <MarketsPage />
                      </SuperAdminRoute>
                    </Shell>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
