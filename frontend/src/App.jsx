import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import DashboardStats from './components/DashboardStats';
import ResidentList from './components/ResidentList';
import AddResidentForm from './components/AddResidentForm';
import UserManagement from './components/UserManagement';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';

// --- 1. UPDATED ADMIN ROUTE ---
// Redirects to 'residents' instead of 'overview' to avoid infinite loops
const AdminRoute = ({ children }) => {
  const role = localStorage.getItem('role');
  if (role !== 'admin') {
    return <Navigate to="/dashboard/residents" replace />;
  }
  return children;
};

// --- 2. NEW: SMART DASHBOARD REDIRECT ---
// Decides the landing page based on user role
const DashboardHome = () => {
  const role = localStorage.getItem('role');
  return role === 'admin' 
    ? <Navigate to="overview" replace /> 
    : <Navigate to="residents" replace />;
};

function DashboardLayout() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const [residentToEdit, setResidentToEdit] = useState(null);

  const handleEdit = (resident) => {
    setResidentToEdit(resident);
    navigate('/dashboard/create');
  };

  const FormPage = () => (
    <AddResidentForm 
      residentToEdit={residentToEdit}
      onSuccess={() => {
        setResidentToEdit(null);
        navigate('/dashboard/residents');
      }}
      onCancel={() => {
        setResidentToEdit(null);
        navigate('/dashboard/residents');
      }}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar userRole={userRole} />

      <main className="lg:ml-72 min-h-screen p-6 pt-20 lg:pt-8 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          <Routes>
            {/* Use the smart redirect for the base /dashboard path */}
            <Route path="/" element={<DashboardHome />} />
            
            {/* PROTECTED OVERVIEW: Only for Admins */}
            <Route 
              path="overview" 
              element={
                <AdminRoute>
                  <DashboardStats />
                </AdminRoute>
              } 
            />

            <Route path="residents" element={<ResidentList userRole={userRole} onEdit={handleEdit} />} />
            <Route path="create" element={<FormPage />} />
            
            {/* PROTECTED USER MANAGEMENT: Only for Admins */}
            <Route 
              path="users" 
              element={
                <AdminRoute>
                  <UserManagement />
                </AdminRoute>
              } 
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login onLogin={() => {
                // Determine destination on login
                const role = localStorage.getItem('role');
                navigate(role === 'admin' ? '/dashboard/overview' : '/dashboard/residents');
            }} />
          </PublicRoute>
        } 
      />
      
      <Route element={<ProtectedRoute />}>
         <Route path="/dashboard/*" element={<DashboardLayout />} />
         {/* Catch-all for logged in users: send them to their specific home */}
         <Route path="*" element={<DashboardHome />} />
      </Route>
    </Routes>
  );
}

export default App;