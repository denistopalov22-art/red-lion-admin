import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ServiceBooking } from '../types';

interface BookingWithProfile extends ServiceBooking {
  profiles?: { full_name: string | null; email: string | null; push_token?: string | null };
  customer_vehicles?: { id: string; registration: string; vehicles?: { make: string; model: string } | null };
}

const STATUS_COLORS: Record<string, string> = {
  Pending: 'badge-amber', Confirmed: 'badge-blue', Completed: 'badge-green', Cancelled: 'badge-gray',
  pending: 'badge-amber', confirmed: 'badge-blue', completed: 'badge-green', cancelled: 'badge-gray',
};
const STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];

async function sendPush(pushToken: string | null | undefined, title: string, body: string) {
  if (!pushToken) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: pushToken, title, body }),
  }).catch(() => {});
}

export default function Bookings() {
  const [bookings, setBookings] = useState<BookingWithProfile[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [editingBooking, setEditingBooking] = useState<BookingWithProfile | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('service_bookings')
      .select('*, profiles(full_name,email,push_token), customer_vehicles(id,registration,vehicles(make,model))')
      .order('preferred_date', { ascending: true });
    setBookings(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = bookings.filter(b => {
    const name = b.profiles?.full_name?.toLowerCase() ?? '';
    const email = b.profiles?.email?.toLowerCase() ?? '';
    const reg = b.customer_vehicles?.registration?.toLowerCase() ?? '';
    const matchSearch = [name, email, reg, b.service_type.toLowerCase()].some(x => x.includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'ALL' || b.status.toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  function openEdit(b: BookingWithProfile) {
    setEditingBooking(b);
    setEditStatus(b.status);
    setEditNotes(b.admin_notes ?? '');
  }

  async function saveEdit() {
    if (!editingBooking) return;
    setSaving(true);
    const prevStatus = editingBooking.status;
    await supabase.from('service_bookings').update({ status: editStatus, admin_notes: editNotes }).eq('id', editingBooking.id);

    // Auto-create service history when marking as Completed
    if (editStatus === 'Completed' && prevStatus !== 'Completed') {
      const cvId = editingBooking.customer_vehicle_id || editingBooking.customer_vehicles?.id;
      if (cvId) {
        // Check not already created
        const { data: existing } = await supabase.from('service_history').select('id').eq('service_booking_id', editingBooking.id).maybeSingle();
        if (!existing) {
          await supabase.from('service_history').insert({
            customer_vehicle_id: cvId,
            service_booking_id: editingBooking.id,
            customer_id: editingBooking.user_id,
            service_date: editingBooking.preferred_date || new Date().toISOString().split('T')[0],
            service_type: editingBooking.service_type,
            work_done: editNotes || editingBooking.service_type,
            description: editNotes || `${editingBooking.service_type} completed`,
          });
        }
      }
    }

    // Send notification for status changes
    const userId = editingBooking.user_id;
    const pushToken = editingBooking.profiles?.push_token;
    const vehicleName = editingBooking.customer_vehicles?.vehicles
      ? `${editingBooking.customer_vehicles.vehicles.make} ${editingBooking.customer_vehicles.vehicles.model}`
      : editingBooking.customer_vehicles?.registration || 'your vehicle';
    const preferredDate = editingBooking.preferred_date
      ? new Date(editingBooking.preferred_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      : 'your appointment';

    let notifTitle = '';
    let notifBody = '';
    let notifType = '';

    if (editStatus === 'Confirmed' && prevStatus !== 'Confirmed') {
      notifTitle = 'Service Booking Confirmed';
      notifBody = `Your ${editingBooking.service_type} for ${vehicleName} on ${preferredDate} has been confirmed.${editNotes ? '\n\n' + editNotes : ''}`;
      notifType = 'booking_confirmed';
    } else if (editStatus === 'Completed' && prevStatus !== 'Completed') {
      notifTitle = 'Service Completed';
      notifBody = `Your ${editingBooking.service_type} for ${vehicleName} has been completed.${editNotes ? '\n\n' + editNotes : ''}`;
      notifType = 'booking_completed';
    } else if (editStatus === 'Cancelled' && prevStatus !== 'Cancelled') {
      notifTitle = 'Booking Cancelled';
      notifBody = `Your booking for ${vehicleName} has been cancelled.${editNotes ? '\n\n' + editNotes : ''}`;
      notifType = 'booking_cancelled';
    }

    if (notifTitle && userId) {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: notifTitle,
        message: notifBody,
        type: notifType,
        read: false,
        data: { screen: 'bookings' },
      });
      await sendPush(pushToken, notifTitle, notifBody);
    }

    setSaving(false);
    setEditingBooking(null);
    load();
  }

  async function quickConfirm(b: BookingWithProfile) {
    await supabase.from('service_bookings').update({ status: 'Confirmed' }).eq('id', b.id);
    const vehicleName = b.customer_vehicles?.vehicles
      ? `${b.customer_vehicles.vehicles.make} ${b.customer_vehicles.vehicles.model}`
      : b.customer_vehicles?.registration || 'your vehicle';
    const preferredDate = b.preferred_date
      ? new Date(b.preferred_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      : 'your appointment';
    if (b.user_id) {
      await supabase.from('notifications').insert({
        user_id: b.user_id,
        title: 'Service Booking Confirmed',
        message: `Your ${b.service_type} for ${vehicleName} on ${preferredDate} has been confirmed.`,
        type: 'booking_confirmed',
        read: false,
        data: { screen: 'bookings' },
      });
      await sendPush(b.profiles?.push_token, 'Service Booking Confirmed', `Your ${b.service_type} for ${vehicleName} on ${preferredDate} has been confirmed.`);
    }
    load();
  }

  const pendingCount = bookings.filter(b => b.status === 'Pending').length;

  return (
    <>
      <div className="topbar">
        <h1>Bookings {pendingCount > 0 && <span className="badge badge-amber" style={{ marginLeft: 8 }}>{pendingCount} pending</span>}</h1>
      </div>
      <div className="page">
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search customer, reg, type..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="ALL">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>{filtered.length} bookings</span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            {loading ? <div className="loading">Loading...</div> : filtered.length === 0 ? <div className="empty">No bookings found</div> : (
              <table>
                <thead>
                  <tr><th>Customer</th><th>Vehicle</th><th>Type</th><th>Date</th><th>Status</th><th>Notes</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id}>
                      <td><strong>{b.profiles?.full_name || '—'}</strong><div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.profiles?.email}</div></td>
                      <td>{b.customer_vehicles?.registration || '—'}</td>
                      <td><span className="tag">{b.service_type}</span></td>
                      <td>{new Date(b.preferred_date).toLocaleDateString('en-GB')}</td>
                      <td><span className={`badge ${STATUS_COLORS[b.status] ?? 'badge-gray'}`}>{b.status}</span></td>
                      <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text3)' }}>{b.admin_notes || b.message || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)}>Edit</button>
                          {b.status === 'Pending' && (
                            <button className="btn btn-primary btn-sm" onClick={() => quickConfirm(b)}>Confirm</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {editingBooking && (
        <div className="modal-overlay" onClick={() => setEditingBooking(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Update Booking</h3>
              <button className="btn-icon" onClick={() => setEditingBooking(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, fontSize: 13 }}>
                <strong>{editingBooking.profiles?.full_name || editingBooking.profiles?.email}</strong>
                {' · '}{editingBooking.service_type}
                {' · '}{new Date(editingBooking.preferred_date).toLocaleDateString('en-GB')}
                {editingBooking.message && <div style={{ marginTop: 6, color: 'var(--text3)' }}>Customer note: {editingBooking.message}</div>}
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {editStatus === 'Completed' && editingBooking.status !== 'Completed' && (
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    ✓ A service history record will be created automatically and the customer will be notified.
                  </p>
                )}
              </div>
              <div className="form-group">
                <label>Admin Notes (sent to customer on status change)</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} placeholder="e.g. Ready for collection at 3pm, extra work found..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingBooking(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save & Notify'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
