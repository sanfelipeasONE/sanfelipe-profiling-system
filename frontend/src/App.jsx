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
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role') || 'staff');

  // --- EDITING STATE LOGIC ---
  // This tracks if we are currently editing a resident and who it is.
  const [isEditing, setIsEditing] = useState(false);
  const [currentResident, setCurrentResident] = useState(null);

  /**
   * handleEditInitiated
   * Triggered when the Edit button is clicked in ResidentList.
   */
  const handleEditInitiated = (resident) => {
    setCurrentResident(resident);
    setIsEditing(true); // This switches the view in the Route
  };

  /**
   * handleFinishEditing
   * Returns the view to the list after a successful save or cancel.
   */
  const handleFinishEditing = () => {
    setIsEditing(false);
    setCurrentResident(null);
  };

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
      {/* PUBLIC ROUTE: Login */}
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

      {/* PROTECTED ROUTES: Dashboard */}
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
        {/* Sub-route: Overview (Admin Only) */}
        <Route 
          path="overview" 
          element={
            role === 'admin' ? (
              <DashboardStats userRole={role} />
            ) : (
              <Navigate to="/dashboard/residents" replace />
            )
          } 
        />

        {/* Sub-route: Residents
            Uses a conditional to show either the LIST or the EDIT FORM
        */}
        <Route 
          path="residents" 
          element={
            !isEditing ? (
              <ResidentList 
                userRole={role} 
                onEdit={handleEditInitiated} 
              />
            ) : (
              <AddResidentForm 
                residentToEdit={currentResident} 
                onSuccess={handleFinishEditing} 
                onCancel={handleFinishEditing} 
              />
            )
          } 
        />

        {/* Sub-route: Register (Always a fresh form) */}
        <Route path="create" element={<AddResidentForm onSuccess={handleFinishEditing} />} />
        
        {/* Sub-route: User Management */}
        <Route path="users" element={<UserManagement />} />
        
        <Route index element={<Navigate to="/dashboard/overview" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}