import { Spin } from 'antd';
import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import type { RoleCode } from '../types';

const ADMIN_ROLES: readonly RoleCode[] = ['SUPER_ADMIN', 'CLIENT_ADMIN'];

const isAdminRole = (role: RoleCode) => ADMIN_ROLES.includes(role);

// Gate order matters: signed-out → /login; non-admin (e.g. Player) → clear and
// /login; a temporary password still pending → /change-password (the server
// enforces this too — everything else 403s with PASSWORD_CHANGE_REQUIRED —
// this just avoids the round trip).
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const isAdmin = Boolean(user && isAdminRole(user.role));

  // Drop a Player (or any non-admin) session that /auth/me may have restored
  // from a leftover mobile cookie on the same host.
  useEffect(() => {
    if (loading || !user || isAdminRole(user.role)) return;
    void logout();
  }, [loading, user, logout]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!user || !isAdmin) return <Navigate to="/login" state={{ from: location }} replace />;
  // Coerce in case a stale client ever stored 0/1 instead of boolean.
  if (Boolean(user.mustChangePassword) && location.pathname !== '/change-password') {
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
