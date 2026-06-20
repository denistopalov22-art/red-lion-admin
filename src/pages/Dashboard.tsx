import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Stats {
  totalCustomers: number;
  vehiclesInStock: number;
  vehiclesSold: number;
  activeWarranties: number;
  upcomingMOT: number;
  upcomingService: number;
  pendingBookings: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalCustomers: 0, vehiclesInStock: 0, vehiclesSold: 0, activeWarranties: 0, upcomingMOT: 0, upcomingService: 0, pendingBookings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0];
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const [customers, inStock, sold, warranties, motDue, serviceDue, bookings] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('role', 'admin'),
        supabase.from('vehicles').select('stock_id', { count: 'exact', head: true }).eq('status', 'AVAILABLE'),
        supabase.from('vehicles').select('stock_id', { count: 'exact', head: true }).in('status', ['SOLD', 'DELIVERED']),
        supabase.from('warranties').select('id', { count: 'exact', head: true }).gte('expiry_date', today),
        supabase.from('customer_vehicles').select('id', { count: 'exact', head: true }).gte('mot_date', today).lte('mot_date', in30),
        supabase.from('customer_vehicles').select('id', { count: 'exact', head: true }).gte('service_date', today).lte('service_date', in30),
        supabase.from('service_bookings').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
      ]);

      setStats({
        totalCustomers: customers.count ?? 0,
        vehiclesInStock: inStock.count ?? 0,
        vehiclesSold: sold.count ?? 0,
        activeWarranties: warranties.count ?? 0,
        upcomingMOT: motDue.count ?? 0,
        upcomingService: serviceDue.count ?? 0,
        pendingBookings: bookings.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const statItems = [
    { label: 'Total Customers', value: stats.totalCustomers, sub: 'registered', color: 'var(--blue)' },
    { label: 'Vehicles In Stock', value: stats.vehiclesInStock, sub: 'available', color: 'var(--green)' },
    { label: 'Vehicles Sold', value: stats.vehiclesSold, sub: 'sold / delivered', color: 'var(--text)' },
    { label: 'Active Warranties', value: stats.activeWarranties, sub: 'not expired', color: 'var(--green)' },
    { label: 'MOT Due (30d)', value: stats.upcomingMOT, sub: 'next 30 days', color: stats.upcomingMOT > 0 ? 'var(--amber)' : 'var(--text)' },
    { label: 'Service Due (30d)', value: stats.upcomingService, sub: 'next 30 days', color: stats.upcomingService > 0 ? 'var(--amber)' : 'var(--text)' },
    { label: 'Pending Bookings', value: stats.pendingBookings, sub: 'awaiting action', color: stats.pendingBookings > 0 ? 'var(--red)' : 'var(--text)' },
  ];

  const quickActions = [
    { label: 'New Customer', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>, action: () => navigate('/customers') },
    { label: 'Vehicle Handover', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.39 0 4.56.93 6.17 2.44"/><path d="M21 3v4h-4"/></svg>, action: () => navigate('/handover') },
    { label: 'Add Service', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>, action: () => navigate('/service-history') },
    { label: 'Upload Document', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>, action: () => navigate('/documents') },
    { label: 'Send Notification', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, action: () => navigate('/notifications') },
  ];

  return (
    <>
      <div className="topbar">
        <h1>Dashboard</h1>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
      <div className="page">
        {loading ? (
          <div className="loading">Loading stats...</div>
        ) : (
          <>
            <div className="stats-grid">
              {statItems.map(s => (
                <div className="stat-card" key={s.label}>
                  <div className="label">{s.label}</div>
                  <div className="value" style={{ color: s.color }}>{s.value}</div>
                  <div className="sub">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="section-header">
              <h2>Quick Actions</h2>
            </div>
            <div className="quick-actions">
              {quickActions.map(a => (
                <div key={a.label} className="quick-action" onClick={a.action}>
                  {a.icon}
                  <span>{a.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
