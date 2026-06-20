import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Notification, Profile } from '../types';

interface NotifWithProfile extends Notification {
  profiles?: { full_name: string | null; email: string | null };
}

const TEMPLATES = [
  { label: 'MOT Reminder', title: 'MOT Due Soon', message: 'Your vehicle MOT is due soon. Please contact us to book your MOT appointment.' },
  { label: 'Service Reminder', title: 'Service Due', message: 'Your vehicle is due for a service. Book now to keep your car in top condition.' },
  { label: 'Warranty Expiring', title: 'Warranty Expiring Soon', message: 'Your vehicle warranty is expiring soon. Contact us to discuss renewal options.' },
  { label: 'New Vehicle Ready', title: 'Your Vehicle is Ready', message: 'Great news! Your vehicle is ready for collection. Please contact us to arrange pickup.' },
  { label: 'General Update', title: 'Update from Red Lion Motors', message: '' },
];

export default function Notifications() {
  const [searchParams] = useSearchParams();
  const [notifications, setNotifications] = useState<NotifWithProfile[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [targetId, setTargetId] = useState(searchParams.get('customer') ?? 'ALL');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [notifRes, custRes] = await Promise.all([
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('*').neq('role', 'admin').order('full_name'),
    ]);
    const profileMap = new Map((custRes.data ?? []).map((p: any) => [p.id, p]));
    const notifs = (notifRes.data ?? []).map((n: any) => ({
      ...n,
      profiles: profileMap.get(n.user_id) ?? null,
    }));
    setNotifications(notifs);
    setCustomers(custRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = notifications.filter(n =>
    [n.title, n.message, n.profiles?.full_name, n.profiles?.email].some(x => x?.toLowerCase().includes(search.toLowerCase()))
  );

  function applyTemplate(t: typeof TEMPLATES[0]) {
    setTitle(t.title);
    setMessage(t.message);
  }

  async function handleSend() {
    if (!title || !message) { setError('Title and message are required'); return; }
    setSending(true);
    setError('');
    setSuccess('');

    const targets = targetId === 'ALL' ? customers : customers.filter(c => c.id === targetId);
    let sent = 0;

    for (const customer of targets) {
      await supabase.from('notifications').insert({
        user_id: customer.id,
        title,
        message,
        type: 'admin_message',
        read: false,
        data: { screen: 'notifications' },
      });

      // Send push notification if token available
      if (customer.push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: customer.push_token, title, body: message, sound: 'default' }),
        }).catch(() => {});
      }
      sent++;
    }

    setSending(false);
    setSuccess(`Notification sent to ${sent} customer${sent !== 1 ? 's' : ''}`);
    setShowModal(false);
    setTitle('');
    setMessage('');
    load();
  }

  return (
    <>
      <div className="topbar">
        <h1>Notifications</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowModal(true); setError(''); setSuccess(''); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          Send Notification
        </button>
      </div>
      <div className="page">
        {success && <div className="success-msg" style={{ marginBottom: 16 }}>{success}</div>}
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search title, message, customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>{filtered.length} notifications</span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            {loading ? <div className="loading">Loading...</div> : filtered.length === 0 ? <div className="empty">No notifications found</div> : (
              <table>
                <thead><tr><th>Customer</th><th>Title</th><th>Message</th><th>Read</th><th>Sent</th></tr></thead>
                <tbody>
                  {filtered.map(n => (
                    <tr key={n.id}>
                      <td><strong>{n.profiles?.full_name || '—'}</strong><div style={{ fontSize: 11, color: 'var(--text3)' }}>{n.profiles?.email}</div></td>
                      <td><strong>{n.title}</strong></td>
                      <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</td>
                      <td><span className={`badge ${n.read ? 'badge-green' : 'badge-gray'}`}>{n.read ? 'Read' : 'Unread'}</span></td>
                      <td>{new Date(n.created_at).toLocaleDateString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Send Notification</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="error-msg">{error}</div>}

              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Quick Templates</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {TEMPLATES.map(t => (
                  <button key={t.label} className="btn btn-secondary btn-sm" onClick={() => applyTemplate(t)}>{t.label}</button>
                ))}
              </div>

              <div className="divider" />

              <div className="form-group">
                <label>Send To</label>
                <select value={targetId} onChange={e => setTargetId(e.target.value)}>
                  <option value="ALL">All Customers ({customers.length})</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title" />
              </div>
              <div className="form-group">
                <label>Message *</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Notification message..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
                {sending ? 'Sending...' : `Send to ${targetId === 'ALL' ? `All (${customers.length})` : '1 Customer'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
