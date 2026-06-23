import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FolderHeart, Image, Users, LayoutDashboard, LogOut, Settings, Menu, X } from 'lucide-react';

export const Layout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navLinks = profile?.role === 'admin' 
    ? [
        { path: '/admin', label: 'Admin Dashboard', icon: <LayoutDashboard size={20} /> },
        { path: '/admin/users', label: 'Manage Users', icon: <Users size={20} /> },
        { path: '/admin/photos', label: 'All Photos', icon: <Image size={20} /> },
      ]
    : [
        { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { path: '/folders', label: 'My Folders', icon: <FolderHeart size={20} /> },
        { path: '/photos', label: 'My Gallery', icon: <Image size={20} /> },
      ];

  const LinkItem: React.FC<{ to: string, label: string, icon: React.ReactNode }> = ({ to, label, icon }) => {
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <Link
        to={to}
        onClick={() => setIsMobileMenuOpen(false)}
        className={`sidebar-link flex items-center gap-3 px-4 py-3 text-sm ${isActive ? 'active-link' : 'text-slate-600'}`}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row text-slate-900">
      {/* Mobile Navbar Elements */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <FolderHeart size={20} />
          </div>
          <span>Vault.</span>
        </Link>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`\${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-64 bg-white border-r border-slate-200 sticky top-0 md:h-screen z-10 shrink-0`}>
        <div className="p-6 hidden md:flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <FolderHeart size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight">Vault.</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navLinks.map((link) => (
            <LinkItem key={link.path} to={link.path} label={link.label} icon={link.icon} />
          ))}
        </nav>

        <div className="pt-6 border-t border-slate-100 mt-4 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold truncate">{profile?.full_name}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider truncate">{profile?.role} USER</p>
            </div>
          </div>
          
          <Link
            to="/profile"
            className="sidebar-link flex items-center gap-3 px-4 py-3 text-sm text-slate-600 mb-1"
          >
            <Settings size={20} />
            <span>Profile</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="sidebar-link flex items-center gap-3 px-4 py-3 text-sm text-red-600 w-full text-left"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
