import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import CustomerModal from '../components/CustomerModal';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  async function load() {
    const { data } = await supabase.from('profiles').select('*').neq('role', 'admin').order('created_at', { ascending: false });
    setCustomers(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c =>
    [c.full_name, c.email, c.phone].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  function openNew() { setEditing(null); setShowModal(true); }
  function openEdit(c: Profile) { setEditing(c); setShowModal(true); }

  return (
    <>
      <div className="topbar">
        <h1>Customers</h1>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Customer
        </button>
      </div>
      <div className="page">
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search by name, email or phone..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>{filtered.length} customers</span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="empty">No customers found</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Joined</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.full_name || '—'}</strong></td>
                      <td>{c.email || '—'}</td>
                      <td>{c.phone || '—'}</td>
                      <td>{new Date(c.created_at).toLocaleDateString('en-GB')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/customers/${c.id}`)}>View</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Edit</button>
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

      {showModal && (
        <CustomerModal
          customer={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </>
  );
}
