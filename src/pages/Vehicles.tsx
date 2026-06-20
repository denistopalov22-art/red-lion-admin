import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Vehicle, VehicleStatus } from '../types';

const STATUS_COLORS: Record<VehicleStatus, string> = {
  AVAILABLE: 'badge-green', RESERVED: 'badge-amber', SOLD: 'badge-blue', DELIVERED: 'badge-gray', HIDDEN: 'badge-gray',
};

const STATUSES: VehicleStatus[] = ['AVAILABLE', 'RESERVED', 'SOLD', 'DELIVERED', 'HIDDEN'];

interface VehicleForm {
  make: string; model: string; variant: string; year: string; mileage: string;
  fuel: string; transmission: string; body_type: string; colour: string;
  price: string; monthly_price: string; registration: string; description: string;
  status: VehicleStatus; featured: boolean;
}

const emptyForm: VehicleForm = {
  make: '', model: '', variant: '', year: new Date().getFullYear().toString(), mileage: '',
  fuel: 'Petrol', transmission: 'Manual', body_type: 'Saloon', colour: '',
  price: '', monthly_price: '', registration: '', description: '', status: 'AVAILABLE', featured: false,
};

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const { data } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    setVehicles(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = vehicles.filter(v => {
    const matchSearch = [v.make, v.model, v.registration, v.colour].some(x => x?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      make: v.make, model: v.model, variant: v.variant ?? '', year: String(v.year),
      mileage: String(v.mileage), fuel: v.fuel, transmission: v.transmission,
      body_type: v.body_type, colour: v.colour, price: String(v.price),
      monthly_price: v.monthly_price ? String(v.monthly_price) : '',
      registration: v.registration ?? '', description: v.description ?? '',
      status: v.status, featured: v.featured,
    });
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const payload = {
      make: form.make, model: form.model, variant: form.variant || null,
      year: parseInt(form.year), mileage: parseInt(form.mileage),
      fuel: form.fuel, transmission: form.transmission, body_type: form.body_type,
      colour: form.colour, price: parseFloat(form.price),
      monthly_price: form.monthly_price ? parseFloat(form.monthly_price) : null,
      registration: form.registration || null, description: form.description || null,
      status: form.status, featured: form.featured,
    };
    let err;
    if (editing) {
      ({ error: err } = await supabase.from('vehicles').update(payload).eq('stock_id', editing.stock_id));
    } else {
      ({ error: err } = await supabase.from('vehicles').insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowModal(false);
    load();
  }

  async function updateStatus(id: string, status: VehicleStatus) {
    await supabase.from('vehicles').update({ status }).eq('stock_id', id);
    load();
  }

  function f(key: keyof VehicleForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
  }

  return (
    <>
      <div className="topbar">
        <h1>Vehicles</h1>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Vehicle
        </button>
      </div>
      <div className="page">
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search make, model, reg..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="ALL">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>{filtered.length} vehicles</span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            {loading ? <div className="loading">Loading...</div> : filtered.length === 0 ? <div className="empty">No vehicles found</div> : (
              <table>
                <thead>
                  <tr><th>Vehicle</th><th>Reg</th><th>Year</th><th>Mileage</th><th>Price</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(v => (
                    <tr key={v.stock_id}>
                      <td><strong>{v.make} {v.model}</strong>{v.variant && <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{v.variant}</span>}</td>
                      <td>{v.registration || '—'}</td>
                      <td>{v.year}</td>
                      <td>{v.mileage.toLocaleString()} mi</td>
                      <td>£{v.price.toLocaleString()}</td>
                      <td><span className={`badge ${STATUS_COLORS[v.status]}`}>{v.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>Edit</button>
                          <select value={v.status} onChange={e => updateStatus(v.stock_id, e.target.value as VehicleStatus)} style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="error-msg">{error}</div>}
              <div className="form-grid">
                <div className="form-group"><label>Make *</label><input value={form.make} onChange={f('make')} placeholder="BMW" required /></div>
                <div className="form-group"><label>Model *</label><input value={form.model} onChange={f('model')} placeholder="3 Series" required /></div>
                <div className="form-group"><label>Variant</label><input value={form.variant} onChange={f('variant')} placeholder="M Sport" /></div>
                <div className="form-group"><label>Registration</label><input value={form.registration} onChange={f('registration')} placeholder="AB12 CDE" /></div>
                <div className="form-group"><label>Year *</label><input type="number" value={form.year} onChange={f('year')} /></div>
                <div className="form-group"><label>Mileage *</label><input type="number" value={form.mileage} onChange={f('mileage')} placeholder="45000" /></div>
                <div className="form-group"><label>Fuel</label>
                  <select value={form.fuel} onChange={f('fuel')}>
                    {['Petrol','Diesel','Electric','Hybrid','PHEV'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Transmission</label>
                  <select value={form.transmission} onChange={f('transmission')}>
                    {['Manual','Automatic','Semi-Auto'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Body Type</label>
                  <select value={form.body_type} onChange={f('body_type')}>
                    {['Saloon','Hatchback','Estate','SUV','Coupe','Convertible','Van','Other'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Colour</label><input value={form.colour} onChange={f('colour')} placeholder="Midnight Black" /></div>
                <div className="form-group"><label>Price (£) *</label><input type="number" value={form.price} onChange={f('price')} placeholder="25000" /></div>
                <div className="form-group"><label>Monthly Price (£)</label><input type="number" value={form.monthly_price} onChange={f('monthly_price')} placeholder="299" /></div>
                <div className="form-group"><label>Status</label>
                  <select value={form.status} onChange={f('status')}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.featured} onChange={f('featured')} style={{ width: 'auto' }} />
                    Featured on app
                  </label>
                </div>
                <div className="form-group form-full"><label>Description</label><textarea value={form.description} onChange={f('description')} rows={3} placeholder="Vehicle description..." /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Vehicle'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
