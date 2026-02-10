import { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  LogOut, 
  Menu, 
  X, 
  ChevronRight,
  ShieldCheck,
  Settings // <--- 1. Added Settings Icon
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Sidebar({ userRole = 'admin' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const logoUrl = "/san_felipe_seal.png"; 

  const menuItems = [
    { label: 'Overview', path: '/dashboard/overview', icon: <LayoutDashboard size={18} /> },
    { label: 'Resident Database', path: '/dashboard/residents', icon: <Users size={18} /> },
    { label: 'Register Resident', path: '/dashboard/create', icon: <UserPlus size={18} /> },
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleNavigate = (path) => {
    navigate(path);
    setIsOpen(false); 
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 w-full h-16 bg-[#1a0505] flex items-center justify-between px-5 z-40 border-b border-red-900/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-700 flex items-center justify-center shadow-lg shadow-red-900/50">
            <img 
              src={logoUrl} 
              alt="Seal" 
              className="w-5 h-5 object-contain"
              onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
            />
            <ShieldCheck className="hidden w-5 h-5 text-red-100" />
          </div>
          <span className="font-semibold text-white text-[15px] tracking-tight">San Felipe</span>
        </div>
        <button 
          onClick={() => setIsOpen(true)} 
          className="p-2 text-red-200 hover:text-white transition-all duration-200 rounded-lg hover:bg-red-500/20"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-red-950/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 h-full w-[280px] 
        bg-[#1a0505] text-white z-50 
        border-r border-red-900/30 shadow-2xl shadow-black/50
        transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 flex flex-col
      `}>
        
        {/* Header */}
        <div className="relative h-[88px] flex items-center justify-between px-6 border-b border-red-900/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center shadow-inner ring-1 ring-white/10">
              <img 
                src={logoUrl} 
                alt="Seal" 
                className="w-7 h-7 object-contain drop-shadow-md"
                onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
              />
              <ShieldCheck className="hidden w-6 h-6 text-white" />
            </div>

            <div className="flex flex-col">
              <h1 className="font-bold text-[17px] text-white leading-tight">LGU San Felipe</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-red-300 uppercase tracking-widest">Province of Zambales</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsOpen(false)} 
            className="lg:hidden text-red-300 hover:text-white transition-all p-2 hover:bg-white/10 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-8 px-5 space-y-2">
          
          {/* Main Menu Section */}
          <div className="px-3 mb-2">
            <p className="text-[11px] font-bold text-red-300/60 uppercase tracking-widest">Main Menu</p>
          </div>
          
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={`
                  w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                  transition-all duration-200 group
                  ${isActive 
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/40 ring-1 ring-white/10' 
                    : 'text-red-200/70 hover:text-white hover:bg-red-900/30'
                  }
                `}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`
                    ${isActive ? 'text-white' : 'text-red-400 group-hover:text-red-200'}
                  `}>
                    {item.icon}
                  </div>
                  <span className="font-medium text-[14px] tracking-wide">{item.label}</span>
                </div>
                {isActive && <ChevronRight size={14} className="text-red-200" />}
              </button>
            );
          })}

          {/* 2. ADMIN CONTROLS SECTION (Only for Admins) */}
          {userRole === 'admin' && (
            <>
              <div className="px-3 mt-8 mb-2">
                <p className="text-[11px] font-bold text-red-300/60 uppercase tracking-widest">Admin Controls</p>
              </div>
              
              <button
                onClick={() => handleNavigate('/dashboard/users')}
                className={`
                  w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                  transition-all duration-200 group
                  ${location.pathname === '/dashboard/users'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/40 ring-1 ring-white/10' 
                    : 'text-red-200/70 hover:text-white hover:bg-red-900/30'
                  }
                `}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`
                    ${location.pathname === '/dashboard/users' ? 'text-white' : 'text-red-400 group-hover:text-red-200'}
                  `}>
                    <Settings size={18} />
                  </div>
                  <span className="font-medium text-[14px] tracking-wide">User Management</span>
                </div>
                {location.pathname === '/dashboard/users' && <ChevronRight size={14} className="text-red-200" />}
              </button>
            </>
          )}

        </nav>

        {/* Footer */}
        <div className="p-5 border-t border-red-900/30 bg-[#160404]">
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-red-950/30 border border-red-900/20">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 flex items-center justify-center text-white font-bold ring-2 ring-[#1a0505]">
              {userRole.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate capitalize">{userRole} Account</p>
              <p className="text-[10px] text-red-300/70 font-medium">System Active</p>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full mt-3 flex items-center justify-center gap-2.5 py-3 rounded-xl text-red-300/60 hover:text-red-200 hover:bg-red-900/20 transition-all duration-200 border border-transparent hover:border-red-900/30"
          >
            <LogOut size={15} /> 
            <span className="text-xs font-semibold uppercase tracking-wider">Sign Out</span>
          </button>
        </div>

      </aside>
    </>
  );
}