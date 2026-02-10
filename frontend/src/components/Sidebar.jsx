import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Settings
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Sidebar({ userRole = 'admin' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const logoUrl = '/san_felipe_seal.png';

  // 1. Define all possible menu items
  const allMenuItems = [
    { label: 'Overview', path: '/dashboard/overview', icon: LayoutDashboard, role: 'admin' },
    { label: 'Resident Database', path: '/dashboard/residents', icon: Users, role: 'all' },
    { label: 'Register Resident', path: '/dashboard/create', icon: UserPlus, role: 'all' },
  ];

  // 2. Filter items based on the user's role INSIDE the component
  const menuItems = allMenuItems.filter(item => {
    if (item.role === 'all') return true;
    if (item.role === 'admin' && userRole === 'admin') return true;
    return false;
  });

  const isActive = (path) => location.pathname === path;

  const handleNavigate = (path) => {
    navigate(path);
    setIsOpen(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  // Modern NavItem sub-component
  const NavItem = ({ label, path, Icon }) => {
    const active = isActive(path);

    return (
      <button
        onClick={() => handleNavigate(path)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200
          ${
            active
              ? 'bg-red-50 text-red-700 border-l-4 border-red-700 shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'
          }`}
      >
        <Icon size={18} className={active ? 'text-red-700' : 'text-gray-400'} />
        <span className={`font-medium ${active ? 'text-red-800' : 'text-gray-700'}`}>{label}</span>
        {active && <ChevronRight size={14} className="ml-auto text-red-600 animate-in slide-in-from-left-1" />}
      </button>
    );
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 w-full h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <img
            src={logoUrl}
            alt="San Felipe Seal"
            className="w-7 h-7 object-contain"
            onError={(e) => (e.target.style.display = 'none')}
          />
          <span className="text-sm font-bold text-gray-800 tracking-tight">
            San Felipe
          </span>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 h-full w-[260px] bg-white border-r border-gray-100 z-50 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 flex flex-col shadow-xl lg:shadow-none`}
      >
        {/* Header Section */}
        <div className="h-20 flex items-center px-6 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center border border-red-100">
                <img
                src={logoUrl}
                alt="San Felipe Seal"
                className="w-7 h-7 object-contain"
                onError={(e) => (e.target.style.display = 'none')}
                />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-none">
                LGU San Felipe
              </h1>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-1">
                Zambales
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="ml-auto lg:hidden text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto py-6">
          <div className="px-6 mb-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
            Main Menu
          </div>

          <div className="space-y-1">
            {menuItems.map((item) => (
                <NavItem
                key={item.path}
                label={item.label}
                path={item.path}
                Icon={item.icon}
                />
            ))}
          </div>

          {userRole === 'admin' && (
            <div className="mt-8">
              <div className="px-6 mb-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                Administration
              </div>
              <NavItem
                label="User Management"
                path="/dashboard/users"
                Icon={Settings}
              />
            </div>
          )}
        </nav>

        {/* Account Footer */}
        <div className="p-4 bg-gray-50/50 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-red-200">
              {userRole.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 capitalize truncate">
                {userRole} Account
              </p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                    Online
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-red-600 bg-white border border-red-100 rounded-xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-200 shadow-sm"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}