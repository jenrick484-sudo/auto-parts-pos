import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PosProvider, usePos } from './context/PosContext';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';
import DashboardPage from './pages/DashboardPage';
import PosCheckoutPage from './pages/PosCheckoutPage';
import SalesLogPage from './pages/SalesLogPage';
import ReportsPage from './pages/ReportsPage';
import MasterItemsPage from './pages/MasterItemsPage';
import InventoryPage from './pages/InventoryPage';
import SuppliersPage from './pages/SuppliersPage';
import UsersPage from './pages/UsersPage';

function AppRoutes() {
  const { loggedInUser } = usePos();

  if (!loggedInUser) {
    return <LoginPage />;
  }

  const defaultRoute = loggedInUser.role === 'CASHIER' ? '/pos' : '/dashboard';

  return (
    <MainLayout>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pos" element={<PosCheckoutPage />} />
        <Route path="/sales-log" element={<SalesLogPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/master-items" element={<MasterItemsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </MainLayout>
  );
}

export default function App() {
  return (
    <PosProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </PosProvider>
  );
}
