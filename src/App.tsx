import { useState, type ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import SurveyDetailPage from './pages/SurveyDetailPage'
import SurveysPage from './pages/SurveysPage'
import { authApi } from './services/api'

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const token = authApi.ensureValidSession()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

const App = () => {
  const [, setAuthWatcher] = useState(0)

  const handleLogin = () => {
    setAuthWatcher((prev) => prev + 1)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <SurveysPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/surveys"
          element={
            <ProtectedRoute>
              <SurveysPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/surveys/:id"
          element={
            <ProtectedRoute>
              <SurveyDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
