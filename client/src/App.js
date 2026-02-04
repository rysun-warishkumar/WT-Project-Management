import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';

// Components
import Layout from './components/Layout/Layout';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import VerifyEmail from './pages/Auth/VerifyEmail';
import ResendVerification from './pages/Auth/ResendVerification';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import Terms from './pages/Legal/Terms';
import Privacy from './pages/Legal/Privacy';
import MobileDeviceNotice from './components/Common/MobileDeviceNotice';
import Dashboard from './pages/Dashboard/Dashboard';
import Clients from './pages/Clients/Clients';
import ClientDetail from './pages/Clients/ClientDetail';
import Projects from './pages/Projects/Projects';
import ProjectDetail from './pages/Projects/ProjectDetail';
import Quotations from './pages/Quotations/Quotations';
import QuotationDetail from './pages/Quotations/QuotationDetail';
import Invoices from './pages/Invoices/Invoices';
import InvoiceDetail from './pages/Invoices/InvoiceDetail';
import Files from './pages/Files/Files';
import Credentials from './pages/Credentials/Credentials';
import CredentialDetail from './pages/Credentials/CredentialDetail';
import Conversations from './pages/Conversations/Conversations';
import ConversationDetail from './pages/Conversations/ConversationDetail';
import Users from './pages/Users/Users';
import Roles from './pages/Roles/Roles';
import Reports from './pages/Reports/Reports';
import Guide from './pages/Guide/Guide';
import Settings from './pages/Settings/Settings';
import Subscriptions from './pages/Subscriptions/Subscriptions';
import Inquiries from './pages/Inquiries/Inquiries';
import Workspace from './pages/ProjectManagement/Workspace';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Styles
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route Component (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            <MobileDeviceNotice />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
            
            <Routes>
              {/* Public Routes */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />
              {/* Email verification should always be accessible, even if auth state is inconsistent */}
              <Route
                path="/verify-email"
                element={<VerifyEmail />}
              />
              <Route
                path="/resend-verification"
                element={
                  <PublicRoute>
                    <ResendVerification />
                  </PublicRoute>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <PublicRoute>
                    <ForgotPassword />
                  </PublicRoute>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <PublicRoute>
                    <ResetPassword />
                  </PublicRoute>
                }
              />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="clients" element={<Clients />} />
                <Route path="clients/:id" element={<ClientDetail />} />
                <Route path="projects" element={<Projects />} />
                <Route path="projects/:id" element={<ProjectDetail />} />
                <Route path="quotations" element={<Quotations />} />
                <Route path="quotations/:id" element={<QuotationDetail />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="invoices/:id" element={<InvoiceDetail />} />
                <Route path="files" element={<Files />} />
                <Route path="credentials" element={<Credentials />} />
                <Route path="credentials/:id" element={<CredentialDetail />} />
                <Route path="conversations" element={<Conversations />} />
                <Route path="conversations/:id" element={<ConversationDetail />} />
                <Route path="users" element={<Users />} />
                <Route path="roles" element={<Roles />} />
                <Route path="reports" element={<Reports />} />
                <Route path="guide" element={<Guide />} />
                <Route path="settings" element={<Settings />} />
                <Route path="subscriptions" element={<Subscriptions />} />
                <Route path="inquiries" element={<Inquiries />} />
              </Route>

              {/* Project Management Routes (separate layout) */}
              <Route
                path="/project-management/:workspaceId/*"
                element={
                  <ProtectedRoute>
                    <Workspace />
                  </ProtectedRoute>
                }
              />

              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
