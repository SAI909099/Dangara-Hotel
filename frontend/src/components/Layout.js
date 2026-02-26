import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userHasPermission } from '@/lib/permissions';
import { 
  LayoutDashboard, 
  DoorOpen, 
  Users, 
  Calendar,
  CalendarDays,
  BarChart3, 
  UserCog, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Boshqaruv Paneli', permission: 'dashboard', roles: ['admin', 'receptionist', 'accountant'] },
    { path: '/rooms', icon: DoorOpen, label: 'Xonalar', permission: 'rooms', roles: ['admin', 'receptionist', 'accountant'] },
    { path: '/guests', icon: Users, label: 'Mehmonlar', permission: 'guests', roles: ['admin', 'receptionist', 'accountant'] },
    { path: '/bookings', icon: Calendar, label: 'Bronlar', permission: 'bookings', roles: ['admin', 'receptionist', 'accountant'] },
    { path: '/calendar', icon: CalendarDays, label: 'Xonalar Taqvimi', permission: 'calendar', roles: ['admin', 'receptionist', 'accountant'] },
    { path: '/reports', icon: BarChart3, label: 'Hisobotlar', permission: 'reports', roles: ['admin', 'receptionist', 'accountant'] },
    { path: '/users', icon: UserCog, label: 'Foydalanuvchilar', permission: 'users', roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role) && userHasPermission(user, item.permission)
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
            <h1 className="text-xl font-bold text-white">Dangara Hotel</h1>
            <button
              data-testid="close-sidebar-btn"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#1e1b4b] text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center mb-4 px-2">
              <div className="w-10 h-10 rounded-full bg-[#d4af37] flex items-center justify-center text-white font-semibold">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-white">{user?.username}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
              </div>
            </div>
            <Button
              data-testid="logout-btn"
              onClick={handleLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Chiqish
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6">
          <button
            data-testid="open-sidebar-btn"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-600 hover:text-slate-900"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center">
            <span className="text-sm text-slate-600">
              Xush kelibsiz, <span className="font-semibold text-slate-900">{user?.username}</span>
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-12">
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
