import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // Return empty rendering or a loading state while checks are performed
    return null;
  }

  if (!isAuthenticated) {
    console.log("[ProtectedRoute] Unauthenticated access attempt. Redirecting to landing page.");
    return <Navigate to="/" replace />;
  }

  return children;
}
