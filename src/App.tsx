import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerProfile from './pages/CustomerProfile';
import Vehicles from './pages/Vehicles';
import Handover from './pages/Handover';
import Documents from './pages/Documents';
import Warranties from './pages/Warranties';
import ServiceHistory from './pages/ServiceHistory';
import Bookings from './pages/Bookings';
import Notifications from './pages/Notifications';
import AutoTrader from './pages/AutoTrader';

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile && profile.role !== 'admin') return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h1 style={{ color: 'var(--red)', marginBottom: 12 }}>Access Denied</h1>
        <p>This portal is for Red Lion Motors staff only.</p>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => window.location.href = '/login'}>Sign Out</button>
      </div>
    </div>
  );
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAdmin><Layout /></RequireAdmin>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerProfile />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="handover" element={<Handover />} />
        <Route path="documents" element={<Documents />} />
        <Route path="warranties" element={<Warranties />} />
        <Route path="service-history" element={<ServiceHistory />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="autotrader" element={<AutoTrader />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
