import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LandingPage } from './pages/LandingPage'
import { DinerCheckInPage } from './pages/diner/DinerCheckInPage'
import { DinerStatusPage } from './pages/diner/DinerStatusPage'
import { LoginPage } from './pages/auth/LoginPage'
import { HostDashboardPage } from './pages/host/HostDashboardPage'
import { ReportsPage } from './pages/host/ReportsPage'
import { UsersPage } from './pages/admin/UsersPage'

// Protected Route Component for staff
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Diner Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/branch/:branchId/check-in" element={<DinerCheckInPage />} />
          <Route path="/branch/:branchId/queue/:entryId" element={<DinerStatusPage />} />

          {/* Staff Auth Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Staff Operations */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <HostDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/users"
            element={
              <ProtectedRoute>
                <UsersPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
