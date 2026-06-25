import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SecurityProvider } from './context/SecurityContext';
import { SecurityOverlays } from './components/SecurityOverlays';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';

import { Photos } from './pages/Photos';

import { Profile } from './pages/Profile';
import { StoragePage } from './pages/Storage';
import { AdminDashboard } from './pages/Admin';
import { AdminPhotos } from './pages/AdminPhotos';

// Placeholders for other pages
const Placeholder = ({ title }: { title: string }) => <div className="p-4"><h1 className="text-2xl font-bold">{title}</h1></div>;

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <SecurityProvider>
          <SecurityOverlays />
          <Routes>
            <Route path="/" element={<Navigate to="/photos" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/photos" element={<Photos activeTab="photos" />} />
              <Route path="/folders" element={<Photos activeTab="albums" />} />
              <Route path="/folders/:albumId" element={<Photos activeTab="albums" />} />
              <Route path="/albums" element={<Navigate to="/folders" replace />} />
              <Route path="/albums/:albumId" element={<Photos activeTab="albums" />} />
              <Route path="/storage" element={<StoragePage />} />
              <Route path="/trash" element={<Photos activeTab="trash" />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            <Route element={<ProtectedRoute requireAdmin={true}><Layout /></ProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<Placeholder title="Manage Users" />} />
              <Route path="/admin/photos" element={<AdminPhotos />} />
            </Route>
          </Routes>
        </SecurityProvider>
      </AuthProvider>
    </Router>
  );
}
