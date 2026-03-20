import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireMesero?: boolean;
  requireCocina?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false, requireMesero = false, requireCocina = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin, isMesero, isCocina, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Wait for role to be fetched
  if ((requireAdmin || requireMesero) && role === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireMesero && !isMesero && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}