import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import DashboardStats from './components/DashboardStats';
import ResidentList from './components/ResidentList';
import AddResidentForm from './components/AddResidentForm';
import ProtectedRoute from './components/ProtectedRoute';
import { useState } from 'react';

function DashboardLayout() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const [residentToEdit, setResidentToEdit] = useState(null);

  const handleEdit = (resident) => {
    setResidentToEdit(resident);
    navigate('/dashboard/create');
  };

  const FormPage = () => (
    // Replaced the wrapper with a cleaner one
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
      
      {/* 1. SIDEBAR (Fixed Position) */}
      <Sidebar userRole={userRole} />

      {/* 2. MAIN CONTENT WRAPPER 
          - lg:ml-72 : Pushes content right on Desktop so sidebar doesn't cover it.
          - pt-20 : Pushes content down on Mobile so header doesn't cover it.
      */}
      <main className="lg:ml-72 min-h-screen p-6 pt-20 lg:pt-8 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<DashboardStats />} />
            <Route path="residents" element={<ResidentList userRole={userRole} onEdit={handleEdit} />} />
            <Route path="create" element={<FormPage />} />
          </Routes>
        </div>
      </main>

    </div>
  );
}

// --- MAIN APP ROUTER ---
function App() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={() => navigate('/dashboard')} />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
         <Route path="/dashboard/*" element={<DashboardLayout />} />
         <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default App;