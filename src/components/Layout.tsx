import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Image, 
  Folder, 
  HardDrive, 
  User, 
  WifiOff, 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Settings 
} from 'lucide-react';

export const UserLayout: React.FC = () => {
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navItems = [
    { path: '/dashboard', label: 'Home', icon: Home },
    { path: '/photos', label: 'Photos', icon: Image },
    { path: '/folders', label: 'Folders', icon: Folder },
    { path: '/storage', label: 'Storage', icon: HardDrive },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  const getIsActive = (path: string) => {
    const current = location.pathname;
    if (path === '/dashboard') return current === '/dashboard';
    if (path === '/folders') return current === '/folders' || current.startsWith('/folders/');
    if (path === '/photos') return current === '/photos';
    if (path === '/storage') return current === '/storage';
    if (path === '/profile') return current === '/profile';
    return current.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center text-slate-900 font-sans">
      <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl bg-white min-h-screen flex flex-col shadow-2xl relative overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden pb-[72px] bg-white relative">
          {isOffline && (
            <div className="bg-amber-500 text-white text-[9px] py-1 px-4 text-center font-black uppercase tracking-widest animate-in slide-in-from-top duration-200 sticky top-0 z-50 shrink-0 flex items-center justify-center gap-1.5 shadow-sm border-b border-amber-600/20">
              <WifiOff size={11} className="stroke-[2.5]" />
              <span>Offline Connection Mode — Using Local Cache</span>
            </div>
          )}
          <Outlet />
        </main>

        <nav className="absolute bottom-0 left-0 right-0 h-[72px] bg-white/95 backdrop-blur-md border-t border-slate-100/80 flex items-center justify-around px-4 z-40 shadow-[0_-8px_30px_rgb(0,0,0,0.03)] pb-safe">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = getIsActive(item.path);

            return (
              <Link
                key={item.path}
                id={`nav-tab-${item.label.toLowerCase()}`}
                to={item.path}
                className="flex-1 flex flex-col items-center justify-center py-2 select-none group transition-all relative"
              >
                <div 
                  className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
                    isActive 
                      ? 'bg-purple-100/80 text-purple-600' 
                      : 'text-slate-400 group-active:scale-90 group-hover:text-slate-600'
                  }`}
                >
                  <IconComponent size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                
                <span 
                  className={`text-[10px] mt-1 tracking-tight transition-all font-semibold ${
                    isActive ? 'text-purple-600 font-bold' : 'text-slate-400 font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/photos', label: 'All Photos', icon: Image },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/storage', label: 'Storage', icon: BarChart3 },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const getIsActive = (path: string) => {
    const current = location.pathname;
    if (path === '/admin') return current === '/admin';
    return current.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center text-slate-900 font-sans">
      <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl bg-white min-h-screen flex flex-col shadow-2xl relative overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden pb-[72px] bg-white relative">
          {isOffline && (
            <div className="bg-amber-500 text-white text-[9px] py-1 px-4 text-center font-black uppercase tracking-widest animate-in slide-in-from-top duration-200 sticky top-0 z-50 shrink-0 flex items-center justify-center gap-1.5 shadow-sm border-b border-amber-600/20">
              <WifiOff size={11} className="stroke-[2.5]" />
              <span>Offline Connection Mode — Using Local Cache</span>
            </div>
          )}
          <Outlet />
        </main>

        <nav className="absolute bottom-0 left-0 right-0 h-[72px] bg-red-50/95 backdrop-blur-md border-t border-red-100/80 flex items-center justify-around px-4 z-40 shadow-[0_-8px_30px_rgb(0,0,0,0.03)] pb-safe">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = getIsActive(item.path);

            return (
              <Link
                key={item.path}
                id={`admin-nav-tab-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                to={item.path}
                className="flex-1 flex flex-col items-center justify-center py-2 select-none group transition-all relative"
              >
                <div 
                  className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
                    isActive 
                      ? 'bg-red-100 text-red-600 font-bold' 
                      : 'text-slate-400 group-active:scale-90 group-hover:text-slate-600'
                  }`}
                >
                  <IconComponent size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                
                <span 
                  className={`text-[10px] mt-1 tracking-tight transition-all font-semibold ${
                    isActive ? 'text-red-600 font-bold' : 'text-slate-400 font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

