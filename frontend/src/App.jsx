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

// --- 1. NEW: ADMIN-ONLY GUARD COMPONENT ---
// This blocks non-admins and kicks them back to the dashboard
const AdminRoute = ({ children }) => {
  const role = localStorage.getItem('role');
  if (role !== 'admin') {
    return <Navigate to="/dashboard/overview" replace />;
  }
  return children;
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
            <Route path="/" element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<DashboardStats />} />
            <Route path="residents" element={<ResidentList userRole={userRole} onEdit={handleEdit} />} />
            <Route path="create" element={<FormPage />} />
            
            {/* --- 2. WRAP THE ROUTE WITH ADMIN ROUTE --- */}
            <Route 
              path="users" 
              element={
                <AdminRoute>
                  <UserManagement />
                </AdminRoute>
              } 
            />
            {/* ------------------------------------------ */}
            
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
            <Login onLogin={() => navigate('/dashboard/overview')} />
          </PublicRoute>
        } 
      />
      
      {/* ProtectedRoute ensures they are Logged In */}
      <Route element={<ProtectedRoute />}>
         {/* AdminRoute (inside DashboardLayout) ensures they are Admin */}
         <Route path="/dashboard/*" element={<DashboardLayout />} />
         <Route path="*" element={<Navigate to="/dashboard/overview" replace />} />
      </Route>
    </Routes>
  );
}

export default App;