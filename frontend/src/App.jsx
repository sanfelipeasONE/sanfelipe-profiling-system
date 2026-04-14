import { useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';

// --- REAL COMPONENT IMPORTS ---
import Login from './components/auth/Login';
import Sidebar from './components/common/Sidebar';
import DashboardStats from './components/dashboard/DashboardStats';
import ResidentList from './components/residents/ResidentList';
import AddResidentForm from './components/residents/AddResidentForm';
import UserManagement from './components/users/UserManagement';
import ArchivedResidents from './components/residents/ArchivedResidents';
import QRScanner from './components/pages/QRScanner';
import ResidentQRPage from "./components/pages/ResidentQRPage";
import PublicResidentPage from './pages/public/PublicResidentPage';
import PublicLandingPage from './pages/public/PublicLandingPage';
import AssistanceFlow from './components/assistance/AssistanceFlow';

const DashboardLayout = ({ userRole, onLogout, onResetView }) => {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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
      {/* PUBLIC ROUTES */}
      <Route path="/" element={<PublicLandingPage />} />
      <Route path="/public/id/:code" element={<PublicResidentPage />} />

      {/* LOGIN */}
      <Route
        path="/login"
        element={
          !token ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard/overview" replace />
        }
      />

      {/* PROTECTED DASHBOARD */}
      <Route
        path="/dashboard"
        element={
          token ? (
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
            role === "admin" || role === "admin_limited" || role === "super_admin"
              ? <DashboardStats userRole={role} />
              : <Navigate to="/dashboard/residents" replace />
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

        <Route
          path="residents/:code/qr"
          element={
            role?.toLowerCase() === "admin" || role?.toLowerCase() === "super_admin"
              ? <ResidentQRPage />
              : <Navigate to="/dashboard/residents" replace />
          }
        />

        <Route
          path="create"
          element={<AddResidentForm onSuccess={handleFinishEditing} />}
        />

        <Route path="users" element={<UserManagement />} />
        <Route path="archived" element={<ArchivedResidents />} />

        <Route
          path="scan"
          element={
            role?.toLowerCase() === "admin" || role?.toLowerCase() === "super_admin"
              ? <QRScanner />
              : <Navigate to="/dashboard/residents" replace />
          }
        />
        
        <Route
          path="assistance"
          element={
            role?.toLowerCase() === "admin" || role?.toLowerCase() === "super_admin"
              ? <AssistanceFlow />
              : <Navigate to="/dashboard/residents" replace />
          }
        />

        <Route index element={<Navigate to="/dashboard/overview" replace />} />
      </Route>

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}