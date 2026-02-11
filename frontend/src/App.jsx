import { useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';

// --- IMPORTS (Connect your Real Files here) ---
import Login from './components/Login';
import Sidebar from './components/Sidebar';

// IMPORT YOUR REAL PAGES
// (Make sure these file names match what is in your folder!)
import ResidentList from './components/ResidentList'; 
import RegisterResident from './components/AddResidentForm'; 
import UserManagement from './components/UserManagement'; 
// If you don't have an Overview.jsx yet, keep the placeholder below, or create one.

// --- PLACEHOLDERS (Keep these only if you don't have the file yet) ---
const Overview = () => (
  <div className="p-10">
    <h1 className="text-3xl font-bold text-gray-800 mb-4">Dashboard Overview</h1>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-gray-500 text-sm font-bold uppercase">Total Residents</h3>
        <p className="text-4xl font-bold text-red-600 mt-2">Loading...</p>
      </div>
      {/* You can add more stats widgets here later */}
    </div>
  </div>
);

// --- LAYOUT ---
const DashboardLayout = ({ userRole, onLogout }) => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userRole={userRole} onLogout={onLogout} />
      <main className="flex-1 ml-[260px] overflow-auto transition-all duration-300">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role') || 'staff');

  const handleLogin = (newRole) => {
    setRole(newRole);
    setToken(localStorage.getItem('token'));
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
  };

  return (
    <Routes>
      {/* Login Route */}
      <Route 
        path="/login" 
        element={!token ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard/overview" replace />} 
      />

      {/* Dashboard Routes */}
      <Route 
        path="/dashboard" 
        element={token ? <DashboardLayout userRole={role} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
      >
        <Route path="overview" element={<Overview />} />
        
        {/* REAL COMPONENTS LINKED HERE */}
        <Route path="residents" element={<ResidentList userRole={role} />} />
        <Route path="create" element={<RegisterResident />} />
        <Route path="users" element={<UserManagement />} />
        
        <Route index element={<Navigate to="/dashboard/overview" replace />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}