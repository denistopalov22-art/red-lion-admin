import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ServiceHistory } from '../types';

interface ServiceWithDetails extends ServiceHistory {
  customer_vehicles?: {
    registration: string;
    profiles?: { full_name: string | null };
  };
}

export default function ServiceHistoryPage() {
  const [records, setRecords] = useState<ServiceWithDetails[]>([]);
  const [cvs, setCvs] = useState<{ id: string; registration: string; profiles?: { full_name: string | null } }[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ServiceWithDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [cvId, setCvId] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [mileage, setMileage] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [invoiceFileName, setInvoiceFileName] = useState('');
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const [serviceType, setServiceType] = useState('Full Service');
  const [cost, setCost] = useState('');

  async function load() {
    const [recRes, cvsRes] = await Promise.all([
      supabase.from('service_history').select('*, customer_vehicles(registration, profiles(full_name))').order('service_date', { ascending: false }),
      supabase.from('customer_vehicles').select('id, registration, profiles(full_name)'),
    ]);
    setRecords(recRes.data ?? []);
    setCvs((cvsRes.data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = records.filter(r => {
    return [r.work_done, r.customer_vehicles?.registration, r.customer_vehicles?.profiles?.full_name].some(x => x?.toLowerCase().includes(search.toLowerCase()));
  });

  async function handleInvoiceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setInvoiceUploading(true);
    setError('');
    const fileName = `invoices/${Date.now()}-${file.name}`;
    const { data, error: uploadErr } = await supabase.storage.from('documents').upload(fileName, file, { upsert: true });
    if (uploadErr) { setError('Upload failed: ' + uploadErr.message); setInvoiceUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(data.path);
    setInvoiceUrl(publicUrl);
    setInvoiceFileName(file.name);
    setInvoiceUploading(false);
  }

  function openNew() {
    setEditing(null);
    setCvId(''); setServiceDate(new Date().toISOString().split('T')[0]); setMileage(''); setWorkDone(''); setInvoiceUrl(''); setInvoiceFileName(''); setServiceType('Full Service'); setCost('');
    setError('');
    setShowModal(true);
  }

  function openEdit(r: ServiceWithDetails) {
    setEditing(r);
    setCvId(r.customer_vehicle_id);
    setServiceDate(r.service_date);
    setMileage(r.mileage ? String(r.mileage) : '');
    setWorkDone(r.work_done);
    setInvoiceUrl(r.invoice_url ?? '');
    setInvoiceFileName('');
    setServiceType((r as any).service_type ?? 'Full Service');
    setCost((r as any).cost ? String((r as any).cost) : '');
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!cvId || !workDone) { setError('Vehicle and work done are required'); return; }
    setSaving(true);
    setError('');
    const payload = {
      customer_vehicle_id: cvId,
      service_date: serviceDate,
      mileage: mileage ? parseInt(mileage) : null,
      work_done: workDone,
      invoice_url: invoiceUrl || null,
      service_type: serviceType || null,
      cost: cost ? parseFloat(cost) : null,
    };
    let err;
    if (editing) {
      ({ error: err } = await supabase.from('service_history').update(payload).eq('id', editing.id));
    } else {
      ({ error: err } = await supabase.from('service_history').insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowModal(false);
    load();
  }

  async function deleteRecord(id: string) {
    if (!confirm('Delete this service record?')) return;
    await supabase.from('service_history').delete().eq('id', id);
    load();
  }

  return (
    <>
      <div className="topbar">
        <h1>Service History</h1>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Service Record
        </button>
      </div>
      <div className="page">
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search work done, vehicle, customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>{filtered.length} records</span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            {loading ? <div className="loading">Loading...</div> : filtered.length === 0 ? <div className="empty">No service records found</div> : (
              <table>
                <thead><tr><th>Date</th><th>Customer</th><th>Vehicle</th><th>Mileage</th><th>Work Done</th><th></th></tr></thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td>{new Date(r.service_date).toLocaleDateString('en-GB')}</td>
                      <td><strong>{r.customer_vehicles?.profiles?.full_name || '—'}</strong></td>
                      <td>{r.customer_vehicles?.registration || '—'}</td>
                      <td>{r.mileage ? r.mileage.toLocaleString() + ' mi' : '—'}</td>
                      <td style={{ maxWidth: 300 }}>{r.work_done}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {r.invoice_url && <a href={r.invoice_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Invoice</a>}
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteRecord(r.id)}>Delete</button>
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Service Record' : 'Add Service Record'}</h3>
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
                <div className="form-group"><label>Service Date *</label><input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} /></div>
                <div className="form-group"><label>Mileage</label><input type="number" value={mileage} onChange={e => setMileage(e.target.value)} placeholder="45000" /></div>
                <div className="form-group"><label>Service Type</label><select value={serviceType} onChange={e => setServiceType(e.target.value)}>{['Full Service','Interim Service','Oil Change','MOT','Brake Service','Tyre Change','Diagnostic','Repair','Other'].map(t => <option key={t}>{t}</option>)}</select></div>
                <div className="form-group"><label>Cost (£)</label><input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="250.00" /></div>
                <div className="form-group form-full"><label>Work Done *</label><textarea value={workDone} onChange={e => setWorkDone(e.target.value)} rows={3} placeholder="Full service, oil change, brake pads replaced..." /></div>
                <div className="form-group form-full">
                  <label>Invoice / Receipt</label>
                  <div className="upload-area" onClick={() => document.getElementById('invoice-file-input')?.click()} style={{ cursor: 'pointer' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20, marginBottom: 4 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <div style={{ fontSize: 13 }}>{invoiceUploading ? 'Uploading...' : invoiceFileName ? `✓ ${invoiceFileName}` : invoiceUrl ? '✓ File uploaded' : 'Click to upload invoice or receipt'}</div>
                    {(invoiceFileName || invoiceUrl) && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Click to replace</div>}
                    <input id="invoice-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleInvoiceUpload} />
                  </div>
                </div>
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
