import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SecurityProvider } from './context/SecurityContext';
import { SecurityOverlays } from './components/SecurityOverlays';
import { UserLayout, AdminLayout } from './components/Layout';
import { AdminRouteGuard, UserRouteGuard } from './components/ProtectedRoute';

import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';

import { Photos } from './pages/Photos';

import { Profile } from './pages/Profile';
import { StoragePage } from './pages/Storage';
import { AdminDashboard } from './pages/Admin';
import { AdminPhotos } from './pages/AdminPhotos';

// Loading screen for redirection Wait
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

// RootRedirect component to land on the correct workspace based on roles
const RootRedirect = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/photos" replace />;
};

// Placeholders for other pages
const Placeholder = ({ title }: { title: string }) => <div className="p-4"><h1 className="text-2xl font-bold">{title}</h1></div>;

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <SecurityProvider>
          <SecurityOverlays />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route element={<UserRouteGuard><UserLayout /></UserRouteGuard>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/photos" element={<Photos activeTab="photos" />} />
              <Route path="/folders" element={<Photos activeTab="albums" />} />
              <Route path="/folders/:albumId" element={<Photos activeTab="albums" />} />
              <Route path="/albums" element={<Navigate to="/folders" replace />} />
              <Route path="/albums/:albumId" element={<Photos activeTab="albums" />} />
              <Route path="/storage" element={<StoragePage />} />
              <Route path="/favorites" element={<Photos activeTab="favorites" />} />
              <Route path="/trash" element={<Photos activeTab="trash" />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            <Route element={<AdminRouteGuard><AdminLayout /></AdminRouteGuard>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<Placeholder title="Manage Users" />} />
              <Route path="/admin/photos" element={<AdminPhotos />} />
              <Route path="/admin/storage" element={<Placeholder title="Storage Analytics" />} />
              <Route path="/admin/settings" element={<Profile />} />
            </Route>
          </Routes>
        </SecurityProvider>
      </AuthProvider>
    </Router>
  );
}
