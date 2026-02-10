import { useState } from 'react';
import { LayoutDashboard, Users, UserPlus, LogOut, Menu, X, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Sidebar({ userRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { label: 'Overview', path: '/dashboard/overview', icon: <LayoutDashboard size={20} /> },
    { label: 'Resident Database', path: '/dashboard/residents', icon: <Users size={20} /> },
    { label: 'Register Resident', path: '/dashboard/create', icon: <UserPlus size={20} /> },
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
      {/* 1. MOBILE HEADER BAR (Visible only on small screens) */}
      <div className="lg:hidden fixed top-0 left-0 w-full h-16 bg-stone-950 text-white flex items-center justify-between px-4 z-40 shadow-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-rose-600 rounded flex items-center justify-center font-bold shadow-red-900/20">SF</div>
          <span className="font-bold tracking-tight">San Felipe</span>
        </div>
        <button onClick={() => setIsOpen(true)} className="p-2 text-stone-300 hover:text-white transition-colors">
          <Menu size={24} />
        </button>
      </div>

      {/* 2. OVERLAY */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-stone-950/60 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* 3. SIDEBAR */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 
        bg-stone-950 text-white z-50 shadow-2xl
        border-r border-white/5
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 
      `}>
        {/* Background Gradient Mesh (Subtle) */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900 via-stone-950 to-black pointer-events-none -z-10"></div>
        <div className="absolute top-0 left-0 w-full h-64 bg-red-900/10 blur-[80px] pointer-events-none -z-10"></div>
        
        {/* HEADER */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-tr from-red-600 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/20 ring-1 ring-white/10">
                <span className="font-bold text-lg text-white">SF</span>
             </div>
             <div>
                <h1 className="font-bold text-lg tracking-tight">San Felipe</h1>
                <p className="text-[10px] text-rose-200/80 uppercase tracking-widest font-semibold">Admin Portal</p>
             </div>
          </div>
          {/* Close Button (Mobile) */}
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-stone-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* MENU */}
        <nav className="p-4 space-y-2 mt-4">
          <p className="px-4 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Main Menu</p>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-900/30 ring-1 ring-white/20' 
                    : 'text-stone-400 hover:bg-white/[0.06] hover:text-stone-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${isActive ? 'text-white' : 'text-stone-500 group-hover:text-stone-300'}`}>
                    {item.icon}
                  </span>
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                {isActive && <ChevronRight size={16} className="text-rose-100 opacity-70" />}
              </button>
            );
          })}
        </nav>

        {/* FOOTER */}
        <div className="absolute bottom-0 w-full p-4 border-t border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4 px-2">
             <div className="w-9 h-9 rounded-full bg-gradient-to-br from-stone-700 to-stone-600 flex items-center justify-center font-bold text-sm border border-stone-600 ring-2 ring-stone-900">
                {userRole === 'admin' ? 'A' : 'B'}
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-100 capitalize truncate">{userRole}</p>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <p className="text-xs text-stone-400">Online</p>
                </div>
             </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-stone-800 hover:bg-red-950/50 text-stone-400 hover:text-red-400 py-2.5 rounded-lg transition-all text-sm font-semibold border border-transparent hover:border-red-900/30"
          >
            <LogOut size={16} /> 
            <span>Sign Out</span>
          </button>
        </div>

      </aside>
    </>
  );
}