import { Spin } from 'antd';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

// Gate order matters: signed-out → /login; a temporary password still pending
// → /change-password (the server enforces this too — everything else 403s
// with PASSWORD_CHANGE_REQUIRED — this just avoids the round trip).
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}

// SuperAdmin-only pages (Clients, Markets/Settle) redirect a Client Admin home
// rather than 403 them into a dead end.
export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}
