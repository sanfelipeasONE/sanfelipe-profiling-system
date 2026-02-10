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

const menuItems = [
  { label: 'Overview', path: '/dashboard/overview', icon: LayoutDashboard },
  { label: 'Resident Database', path: '/dashboard/residents', icon: Users },
  { label: 'Register Resident', path: '/dashboard/create', icon: UserPlus }
];

export default function Sidebar({ userRole = 'admin' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const logoUrl = '/san_felipe_seal.png';

  const isActive = (path) => location.pathname === path;

  const handleNavigate = (path) => {
    navigate(path);
    setIsOpen(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const NavItem = ({ label, path, Icon }) => {
    const active = isActive(path);

    return (
      <button
        onClick={() => handleNavigate(path)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150
          ${
            active
              ? 'bg-red-50 text-red-700 border-l-4 border-red-700'
              : 'text-gray-700 hover:bg-gray-100 border-l-4 border-transparent'
          }`}
      >
        <Icon size={18} className={active ? 'text-red-700' : 'text-gray-500'} />
        <span className="font-medium">{label}</span>
        {active && <ChevronRight size={14} className="ml-auto text-red-600" />}
      </button>
    );
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 w-full h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <img
            src={logoUrl}
            alt="San Felipe Seal"
            className="w-7 h-7 object-contain"
            onError={(e) => (e.target.style.display = 'none')}
          />
          <span className="text-sm font-semibold text-gray-800">
            San Felipe
          </span>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="p-2 text-gray-600"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-[260px] bg-white border-r border-gray-200 z-50 transform transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 flex flex-col`}
      >
        {/* Header */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="San Felipe Seal"
              className="w-9 h-9 object-contain"
              onError={(e) => (e.target.style.display = 'none')}
            />
            <div>
              <h1 className="text-sm font-semibold text-gray-800">
                LGU San Felipe
              </h1>
              <p className="text-xs text-gray-500">
                Province of Zambales
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="ml-auto lg:hidden text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase">
            Main Menu
          </div>

          {menuItems.map(({ label, path, icon }) => (
            <NavItem
              key={path}
              label={label}
              path={path}
              Icon={icon}
            />
          ))}

          {userRole === 'admin' && (
            <>
              <div className="px-4 mt-6 mb-2 text-xs font-semibold text-gray-400 uppercase">
                Administration
              </div>

              <NavItem
                label="User Management"
                path="/dashboard/users"
                Icon={Settings}
              />
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-red-700 text-white flex items-center justify-center text-sm font-semibold">
              {userRole.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 capitalize">
                {userRole}
              </p>
              <p className="text-xs text-gray-500">
                Active Session
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-700 border border-red-700 hover:bg-red-700 hover:text-white transition-colors duration-150"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}