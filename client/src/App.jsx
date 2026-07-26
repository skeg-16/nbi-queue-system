import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Register from './pages/Register';
import Display from './pages/Display';
import Staff from './pages/Staff';
import Records from './pages/Records';
import Feedback from './pages/FeedbackForms';
import FeedbackReports from './pages/FeedbackReports';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import ManageUsers from './pages/ManageUsers';


export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="/login" element={<Login />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route path="/monitor-d9k4" element={<Display />} />

            <Route
              path="/kiosk-x7f2"
              element={
                <ProtectedRoute>
                  <Register />
                </ProtectedRoute>
              }
            />
            <Route
              path="/panel-q1a8"
              element={
                <ProtectedRoute>
                  <Staff />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ledger-m3z6"
              element={
                <ProtectedRoute>
                  <Records />
                </ProtectedRoute>
              }
            />
            <Route
              path="/csat-f5w9/:lang"
              element={
                <ProtectedRoute>
                  <Feedback />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manage-users"
              element={
                <ProtectedRoute adminOnly>
                  <ManageUsers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/feedback-reports"
              element={
                <ProtectedRoute adminOnly>
                  <FeedbackReports />
                </ProtectedRoute>
              }
            />
          
            </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}