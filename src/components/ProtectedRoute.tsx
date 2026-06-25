import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

export const AdminRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile?.role !== 'admin') {
    // Normal user trying to access admin route gets sent back to /photos
    return <Navigate to="/photos" replace />;
  }

  return <>{children}</>;
};

export const UserRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile?.role === 'admin') {
    // Admin trying to access user route gets smartly redirected
    const currentPath = location.pathname;
    if (currentPath === '/photos') {
      return <Navigate to="/admin/photos" replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

