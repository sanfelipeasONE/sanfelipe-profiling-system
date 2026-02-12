import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';

// --- REAL COMPONENT IMPORTS ---
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import DashboardStats from './components/DashboardStats';
import ResidentList from './components/ResidentList';
import AddResidentForm from './components/AddResidentForm'; 
import UserManagement from './components/UserManagement';

/**
 * DashboardLayout
 * Wraps protected routes with the Sidebar and a scrollable main content area.
 * Updated to accept `onResetView` and pass it to Sidebar.
 */
// 1. UPDATE THIS COMPONENT DEFINITION
const DashboardLayout = ({ userRole, onLogout, onResetView }) => {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 2. PASS THE RESET FUNCTION TO SIDEBAR */}
      <Sidebar userRole={userRole} onLogout={onLogout} onLinkClick={onResetView} />
      
      <main className="flex-1 lg:ml-[260px] h-full overflow-y-auto transition-all duration-300">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role') || 'staff');

  const [isEditing, setIsEditing] = useState(false);
  const [currentResident, setCurrentResident] = useState(null);

  const handleEditInitiated = (resident) => {
    setCurrentResident(resident);
    setIsEditing(true);
  };

  // This function clears the editing state.
  // We will use this when a form is saved AND when a sidebar link is clicked.
  const handleFinishEditing = () => {
    setIsEditing(false);
    setCurrentResident(null);
  };

  const handleLogin = (newRole, username) => {
    localStorage.setItem('role', newRole);
    localStorage.setItem('username', username);
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
      <Route 
        path="/login" 
        element={
          !token ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard/overview" replace />
        } 
      />

      <Route 
        path="/dashboard" 
        element={
          token ? (
            // 3. PASS handleFinishEditing AS onResetView HERE
            <DashboardLayout 
              userRole={role} 
              onLogout={handleLogout} 
              onResetView={handleFinishEditing} 
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route 
          path="overview" 
          element={
            role === 'admin' ? <DashboardStats userRole={role} /> : <Navigate to="/dashboard/residents" replace />
          } 
        />

        <Route 
          path="residents" 
          element={
            !isEditing ? (
              <ResidentList userRole={role} onEdit={handleEditInitiated} />
            ) : (
              <AddResidentForm 
                residentToEdit={currentResident} 
                onSuccess={handleFinishEditing} 
                onCancel={handleFinishEditing} 
              />
            )
          } 
        />

        <Route path="create" element={<AddResidentForm onSuccess={handleFinishEditing} />} />
        
        <Route path="users" element={<UserManagement />} />
        
        <Route index element={<Navigate to="/dashboard/overview" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}