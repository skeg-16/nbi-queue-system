import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { token, user } = useAuth();
  const location = useLocation();

  if (!token) return <Navigate to="/login" replace />;
  if (user?.is_first_login && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/" replace />;

  return children;
}