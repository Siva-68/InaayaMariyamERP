import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import AppShell from '@/components/Navigation/AppShell';
import LoginPage from '@/pages/LoginPage';
import NewBillPage from '@/pages/NewBillPage';
import PastInvoicesPage from '@/pages/PastInvoicesPage';
import ProductsPage from '@/pages/ProductsPage';
import DashboardPage from '@/pages/DashboardPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public login route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root redirect to New Bill */}
          <Route path="/" element={<Navigate to="/bill/new" replace />} />

          {/* Protected main navigation routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/bill/new" element={<NewBillPage />} />
            <Route path="/invoices" element={<PastInvoicesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/bill/new" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
