import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Warranty } from '../types';

interface WarrantyWithDetails extends Warranty {
  customer_vehicles?: {
    registration: string;
    profiles?: { full_name: string | null };
  };
}

const COVERAGE_OPTIONS = [
  'Engine',
  'Gearbox',
  'Turbo',
  'Electrical',
  'Suspension',
  'Brakes',
  'Air Conditioning',
  'Fuel System',
  'Cooling System',
  'Steering',
  'Drivetrain',
  'Other',
];

export default function Warranties() {
  const [warranties, setWarranties] = useState<WarrantyWithDetails[]>([]);
  const [cvs, setCvs] = useState<{ id: string; registration: string; profiles?: { full_name: string | null } }[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WarrantyWithDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [cvId, setCvId] = useState('');
  const [provider, setProvider] = useState('');
  const [planName, setPlanName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedCoverage, setSelectedCoverage] = useState<string[]>([]);

  async function load() {
    const [wRes, cvsRes] = await Promise.all([
      supabase.from('warranties').select('*, customer_vehicles(registration, profiles(full_name))').order('expiry_date', { ascending: true }),
      supabase.from('customer_vehicles').select('id, registration, profiles(full_name)'),
    ]);
    setWarranties(wRes.data ?? []);
    setCvs((cvsRes.data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const today = new Date();
  const filtered = warranties.filter(w => {
    const isActive = new Date(w.expiry_date) >= today;
    const matchSearch = [w.provider, w.plan_name, w.customer_vehicles?.registration, w.customer_vehicles?.profiles?.full_name].some(x => x?.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === 'ALL' || (filter === 'ACTIVE' ? isActive : !isActive);
    return matchSearch && matchFilter;
  });

  function parseCoverage(raw: any): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      // Handle Postgres array string format: {Engine,Gearbox}
      return raw.replace(/^\{|\}$/g, '').split(',').map((s: string) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
    }
    return [];
  }

  function toggleCoverage(item: string) {
    setSelectedCoverage(prev =>
      prev.includes(item) ? prev.filter(c => c !== item) : [...prev, item]
    );
  }

  function openNew() {
    setEditing(null);
    setCvId(''); setProvider(''); setPlanName(''); setStartDate(''); setExpiryDate(''); setSelectedCoverage([]);
    setError('');
    setShowModal(true);
  }

  function openEdit(w: WarrantyWithDetails) {
    setEditing(w);
    setCvId(w.customer_vehicle_id);
    setProvider(w.provider);
    setPlanName(w.plan_name);
    setStartDate(w.start_date);
    setExpiryDate(w.expiry_date);
    setSelectedCoverage(parseCoverage(w.coverage_details));
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!cvId || !provider || !startDate || !expiryDate) { setError('Please fill all required fields'); return; }
    if (new Date(expiryDate) <= new Date(startDate)) { setError('Expiry date must be after the start date'); return; }
    setSaving(true);
    setError('');
    // Look up the user_id for this customer vehicle so the customer can see their warranty in the mobile app
    const { data: cvData } = await supabase.from('customer_vehicles').select('user_id').eq('id', cvId).single();
    const isActive = new Date(expiryDate) >= new Date();
    const payload = {
      customer_vehicle_id: cvId,
      user_id: cvData?.user_id ?? null,
      provider,
      plan_name: planName || 'Standard',
      start_date: startDate,
      expiry_date: expiryDate,
      status: isActive ? 'Active' : 'Expired',
      coverage_details: selectedCoverage,
    };
    let err;
    if (editing) {
      ({ error: err } = await supabase.from('warranties').update(payload).eq('id', editing.id));
    } else {
      ({ error: err } = await supabase.from('warranties').insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowModal(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    load();
  }

  async function deleteWarranty(id: string) {
    if (!confirm('Delete this warranty?')) return;
    await supabase.from('warranties').delete().eq('id', id);
    load();
  }

  function daysUntil(date: string) {
    const diff = Math.ceil((new Date(date).getTime() - today.getTime()) / 86400000);
    return diff;
  }

  return (
    <>
      <div className="topbar">
        <h1>Warranties</h1>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Warranty
        </button>
      </div>
      <div className="page">
        {saveSuccess && <div className="success-msg" style={{ marginBottom: 16 }}>✓ Warranty saved successfully</div>}
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search provider, customer, vehicle..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['ALL', 'ACTIVE', 'EXPIRED'] as const).map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>{filtered.length} warranties</span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            {loading ? <div className="loading">Loading...</div> : filtered.length === 0 ? <div className="empty">No warranties found</div> : (
              <table>
                <thead><tr><th>Customer</th><th>Vehicle</th><th>Provider</th><th>Plan</th><th>Coverage</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filtered.map(w => {
                    const days = daysUntil(w.expiry_date);
                    const isActive = days >= 0;
                    const coverageItems = parseCoverage(w.coverage_details);
                    return (
                      <tr key={w.id}>
                        <td><strong>{w.customer_vehicles?.profiles?.full_name || '—'}</strong></td>
                        <td>{w.customer_vehicles?.registration || '—'}</td>
                        <td>{w.provider}</td>
                        <td>{w.plan_name}</td>
                        <td>
                          {coverageItems.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 200 }}>
                              {coverageItems.slice(0, 3).map(c => (
                                <span key={c} style={{
                                  fontSize: 11,
                                  padding: '2px 7px',
                                  borderRadius: 10,
                                  background: 'var(--surface2)',
                                  color: 'var(--text2)',
                                  whiteSpace: 'nowrap',
                                }}>{c}</span>
                              ))}
                              {coverageItems.length > 3 && (
                                <span style={{ fontSize: 11, color: 'var(--text3)' }}>+{coverageItems.length - 3} more</span>
                              )}
                            </div>
                          ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
                        </td>
                        <td>{new Date(w.expiry_date).toLocaleDateString('en-GB')}</td>
                        <td>
                          {isActive ? (
                            <span className={`badge ${days <= 30 ? 'badge-amber' : 'badge-green'}`}>
                              {days <= 30 ? `${days}d left` : 'Active'}
                            </span>
                          ) : (
                            <span className="badge badge-red">Expired</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(w)}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteWarranty(w.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
              <h3>{editing ? 'Edit Warranty' : 'Add Warranty'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="error-msg">{error}</div>}
              <div className="form-group">
                <label>Customer Vehicle *</label>
                <select value={cvId} onChange={e => setCvId(e.target.value)}>
                  <option value="">— Select customer vehicle ({cvs.length} assigned) —</option>
                  {cvs.map(cv => <option key={cv.id} value={cv.id}>{cv.profiles?.full_name || 'Unknown Customer'} — {cv.registration}</option>)}
                </select>
                {cvs.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                    No vehicles assigned yet. Complete a Handover first to assign a vehicle to a customer.
                  </p>
                )}
              </div>
              <div className="form-grid">
                <div className="form-group"><label>Provider *</label><input value={provider} onChange={e => setProvider(e.target.value)} placeholder="Warranty Wise" /></div>
                <div className="form-group"><label>Plan Name</label><input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Gold Cover" /></div>
                <div className="form-group"><label>Start Date *</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div className="form-group"><label>Expiry Date *</label><input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
              </div>
              <div className="form-group">
                <label>Coverage ({selectedCoverage.length} selected)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {COVERAGE_OPTIONS.map(option => {
                    const selected = selectedCoverage.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleCoverage(option)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 20,
                          border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                          background: selected ? 'var(--primary)' : 'transparent',
                          color: selected ? '#fff' : 'var(--text2)',
                          fontSize: 13,
                          cursor: 'pointer',
                          fontWeight: selected ? 600 : 400,
                          transition: 'all 0.15s',
                        }}
                      >
                        {selected && '✓ '}{option}
                      </button>
                    );
                  })}
                </div>
                {selectedCoverage.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                    Select the components covered by this warranty.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
