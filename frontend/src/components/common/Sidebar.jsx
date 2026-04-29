import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Settings,
  QrCode,
  ArchiveRestore,
  HeartHandshake,
  FileBadge
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Sidebar({ userRole = 'staff', onLogout, onLinkClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const logoUrl = '/san_felipe_seal.png';

  const role = (userRole || "").toLowerCase();
  const isAdmin = role === "admin";
  const isSuperAdmin = role === "super_admin";
  const isAdminLimited = role === "admin_limited";
  const isAdminLike = isAdmin || isSuperAdmin || isAdminLimited;
  const isOscaAdmin = role === "osca_admin"; 

  const roleLabel =
    role === "super_admin" ? "Super Admin" :
    role === "admin" ? "Admin" :
    role === "admin_limited" ? "Admin" :
    role === "barangay" ? "Barangay" :
    role === "osca_admin" ? "OSCA Admin" : 
    "User";

  const allMenuItems = [
    // Standard LGU Routes
    { label: 'Overview', path: '/dashboard/overview', Icon: LayoutDashboard, view: 'standard' },
    { label: 'Resident Database', path: '/dashboard/residents', Icon: Users, view: 'standard' },
    { label: 'Register Resident', path: '/dashboard/create', Icon: UserPlus, view: 'standard' },
    { label: 'Scan QR', path: '/dashboard/scan', Icon: QrCode, view: 'admin' },
    { label: 'Assistance', path: '/dashboard/assistance', Icon: HeartHandshake, view: 'admin' },
    { label: 'Archived Residents', path: '/dashboard/archived', Icon: ArchiveRestore, view: 'admin' },
    
    // OSCA Isolated Routes
    { label: 'OSCA Overview', path: '/dashboard/overview', Icon: LayoutDashboard, view: 'osca' },
    { label: 'Senior Citizens Database', path: '/dashboard/seniors', Icon: Users, view: 'osca' },
    { label: 'Register a Senior Citizen', path: '/dashboard/create-senior', Icon: FileBadge, view: 'osca' },
    { label: 'Archived Senior Citizens', path: '/dashboard/osca-archived', Icon: ArchiveRestore, view: 'osca' },
  ];

  const menuItems = allMenuItems.filter(item => {
    // 1. OSCA Admin only sees OSCA views
    if (isOscaAdmin) return item.view === 'osca'; 
    
    // 2. Standard User / Admin Routing
    if (item.view === 'osca') return false; 
    if (item.view === 'standard') return true;
    if (item.view === 'admin' && (isAdmin || isSuperAdmin || isAdminLimited)) return true;
    
    return false;
  });

  const isActive = (path) => location.pathname === path;

  const handleNavigate = (path) => {
    if (onLinkClick) {
      onLinkClick();
    }
    navigate(path);
    setIsOpen(false);
  };

  const NavItem = ({ label, path, Icon }) => {
    const active = isActive(path);

    return (
      <button
        onClick={() => handleNavigate(path)}
        className={`w-full group flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 rounded-xl
          ${
            active
              ? 'bg-red-50 text-red-700 shadow-sm ring-1 ring-red-100/50'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
      >
        <div className={`p-1.5 rounded-lg transition-colors duration-200 ${active ? 'bg-red-100 text-red-700' : 'bg-transparent text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-200/50'}`}>
          <Icon size={18} strokeWidth={active ? 2.5 : 2} />
        </div>
        <span className={`font-medium tracking-tight ${active ? 'text-red-800 font-semibold' : ''}`}>
          {label}
        </span>
        {active && (
          <ChevronRight
            size={16}
            className="ml-auto text-red-500 opacity-70 animate-in fade-in slide-in-from-left-2"
          />
        )}
      </button>
    );
  };

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 w-full h-16 bg-white/90 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 z-40 supports-[backdrop-filter]:bg-white/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shadow-sm border border-red-100/50">
            <img src={logoUrl} alt="San Felipe Seal" className="w-6 h-6 object-contain" onError={(e) => (e.target.style.display = 'none')} />
          </div>
          <span className="text-sm font-bold text-slate-800 tracking-tight">San Felipe</span>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all active:scale-95"
        >
          <Menu size={20} />
        </button>
      </div>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      <aside className={`fixed top-0 left-0 h-full w-[280px] bg-white border-r border-slate-100 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 flex flex-col shadow-2xl lg:shadow-none`}>

        <div className="h-20 flex items-center px-6 mt-2 lg:mt-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-gradient-to-br from-red-50 to-white rounded-2xl flex items-center justify-center border border-red-100 shadow-sm">
              <img src={logoUrl} alt="San Felipe Seal" className="w-7 h-7 object-contain drop-shadow-sm" onError={(e) => (e.target.style.display = 'none')} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-slate-900 leading-tight tracking-tight">LGU San Felipe</h1>
              <p className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase mt-0.5">Zambales</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="ml-auto lg:hidden p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
          <div className="mb-3 px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {isOscaAdmin ? "OSCA Menu" : "Main Menu"}
          </div>
          <div className="space-y-1">
            {menuItems.map((item, idx) => (
              <NavItem key={idx} label={item.label} path={item.path} Icon={item.Icon} />
            ))}
          </div>

          {(isAdmin || isSuperAdmin) && !isOscaAdmin && (
            <div className="mt-8">
              <div className="mb-3 px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Administration</div>
              <NavItem label="User Management" path="/dashboard/users" Icon={Settings} />
            </div>
          )}
        </nav>

        <div className="p-4 m-4 mt-0 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-red-600/20 uppercase ring-2 ring-white">
              {userRole?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 capitalize truncate">{roleLabel}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <p className="text-[10px] text-slate-500 font-medium tracking-wide">System Online</p>
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full group flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-200 shadow-sm"
          >
            <LogOut size={16} className="text-slate-400 group-hover:text-red-500 transition-colors" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}