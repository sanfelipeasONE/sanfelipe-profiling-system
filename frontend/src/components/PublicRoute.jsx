import { Navigate } from 'react-router-dom';

export default function PublicRoute({ children }) {
  const token = localStorage.getItem('token');

  // If user is ALREADY logged in, send them to Dashboard
  if (token) {
    return <Navigate to="/dashboard/overview" replace />;
  }

  // If not logged in, show the Login page (children)
  return children;
}