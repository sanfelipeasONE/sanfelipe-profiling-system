import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';

// --- REAL COMPONENT IMPORTS ---
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import DashboardStats from './components/DashboardStats';
import ResidentList from './components/ResidentList';
import RegisterResident from './components/AddResidentForm'; // Ensure filename matches exactly
import UserManagement from './components/UserManagement';   // Ensure filename matches exactly

/**
 * DashboardLayout
 * Wraps protected routes with the Sidebar and a scrollable main content area.
 */
const DashboardLayout = ({ userRole, onLogout }) => {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar - Fixed width */}
      <Sidebar userRole={userRole} onLogout={onLogout} />
      
      {/* Main Content Area - Fill remaining space and scrollable */}
      <main className="flex-1 ml-[260px] h-full overflow-y-auto transition-all duration-300">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default function App() {
  // Initialize state from localStorage to persist login on refresh
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role') || 'staff');

  /**
   * handleLogin
   * Called by Login.jsx after a successful 200 OK from the cloud backend.
   */
  const handleLogin = (newRole) => {
    setRole(newRole);
    setToken(localStorage.getItem('token'));
  };

  /**
   * handleLogout
   * Clears all local data and returns user to the login screen.
   */
  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
  };

  return (
    <Routes>
      {/* PUBLIC ROUTE: Login 
        If already logged in, redirect straight to the dashboard.
      */}
      <Route 
        path="/login" 
        element={
          !token ? (
            <Login onLogin={handleLogin} />
          ) : (
            <Navigate to="/dashboard/overview" replace />
          )
        } 
      />

      {/* PROTECTED ROUTES: Dashboard 
        If no token exists, redirect any attempt to /dashboard back to /login.
      */}
      <Route 
        path="/dashboard" 
        element={
          token ? (
            <DashboardLayout userRole={role} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        {/* Sub-routes mapped to your sidebar menu */}
        <Route 
          path="overview" 
          element={
            role === 'admin' ? (
              <DashboardStats />
            ) : (
              <Navigate to="/dashboard/residents" replace />
            )
          } 
        />
        <Route path="residents" element={<ResidentList userRole={role} />} />
        <Route path="create" element={<RegisterResident />} />
        <Route path="users" element={<UserManagement />} />
        
        {/* Default redirect: /dashboard -> /dashboard/overview */}
        <Route index element={<Navigate to="/dashboard/overview" replace />} />
      </Route>

      {/* CATCH-ALL: Any unknown URL goes back to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}