import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Document } from '../types';

interface DocWithVehicle extends Document {
  customer_vehicles?: {
    registration: string;
    profiles?: { full_name: string | null };
  };
}

const DOC_TYPES = ['Invoice', 'MOT', 'HPI', 'Warranty', 'Service', 'Other'];

export default function Documents() {
  const [docs, setDocs] = useState<DocWithVehicle[]>([]);
  const [cvs, setCvs] = useState<{ id: string; registration: string; user_id: string; profiles?: { full_name: string | null } }[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form
  const [cvId, setCvId] = useState('');
  const [type, setType] = useState('Invoice');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  async function load() {
    const [docsRes, cvsRes] = await Promise.all([
      supabase.from('documents').select('*, customer_vehicles(registration, profiles(full_name))').order('uploaded_at', { ascending: false }),
      supabase.from('customer_vehicles').select('id, registration, user_id, profiles(full_name)').order('registration'),
    ]);
    setDocs(docsRes.data ?? []);
    setCvs((cvsRes.data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = docs.filter(d => {
    const matchSearch = [d.title, d.type, d.customer_vehicles?.registration, d.customer_vehicles?.profiles?.full_name].some(x => x?.toLowerCase().includes(search.toLowerCase()));
    const matchType = typeFilter === 'ALL' || d.type === typeFilter;
    return matchSearch && matchType;
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fileName = `${Date.now()}-${file.name}`;
    const { data, error: uploadErr } = await supabase.storage.from('documents').upload(fileName, file, { upsert: true });
    if (uploadErr) { setError(uploadErr.message); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(data.path);
    setFileUrl(publicUrl);
    setFileName(file.name);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    setUploading(false);
  }

  async function handleSave() {
    if (!cvId) { setError('Please select a vehicle'); return; }
    setSaving(true);
    setError('');
    // Look up the user_id for the selected customer vehicle
    const selectedCv = cvs.find(cv => cv.id === cvId);
    const { error: err } = await supabase.from('documents').insert({
      customer_vehicle_id: cvId,
      user_id: selectedCv?.user_id || null,
      type,
      title: title || type,
      description: description || null,
      file_url: fileUrl || null,
      uploaded_at: new Date().toISOString(),
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowModal(false);
    setCvId(''); setType('Invoice'); setTitle(''); setDescription(''); setFileUrl(''); setFileName('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    load();
  }

  async function deleteDoc(id: string) {
    if (!confirm('Delete this document?')) return;
    await supabase.from('documents').delete().eq('id', id);
    load();
  }

  return (
    <>
      <div className="topbar">
        <h1>Documents</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowModal(true); setError(''); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Upload Document
        </button>
      </div>
      <div className="page">
        {saveSuccess && <div className="success-msg" style={{ marginBottom: 16 }}>✓ Document uploaded successfully</div>}
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search by title, type, customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="ALL">All Types</option>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>{filtered.length} documents</span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            {loading ? <div className="loading">Loading...</div> : filtered.length === 0 ? <div className="empty">No documents found</div> : (
              <table>
                <thead><tr><th>Type</th><th>Title</th><th>Customer</th><th>Vehicle</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {filtered.map(d => (
                    <tr key={d.id}>
                      <td><span className="tag">{d.type}</span></td>
                      <td><strong>{d.title || '—'}</strong>{d.description && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.description}</div>}</td>
                      <td>{d.customer_vehicles?.profiles?.full_name || '—'}</td>
                      <td>{d.customer_vehicles?.registration || '—'}</td>
                      <td>{new Date(d.uploaded_at).toLocaleDateString('en-GB')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {d.file_url
                            ? <a href={d.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View</a>
                            : <span style={{ fontSize: 11, color: 'var(--text3)' }}>No file</span>
                          }
                          <button className="btn btn-danger btn-sm" onClick={() => deleteDoc(d.id)}>Delete</button>
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
              <h3>Upload Document</h3>
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
                <div className="form-group">
                  <label>Document Type</label>
                  <select value={type} onChange={e => setType(e.target.value)}>
                    {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Purchase Invoice" />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." />
              </div>
              <div className="form-group">
                <label>Upload File</label>
                <div className="upload-area" onClick={() => document.getElementById('file-input')?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <div style={{ fontSize: 13 }}>{uploading ? 'Uploading...' : fileName ? `✓ ${fileName}` : 'Click to upload PDF or image'}</div>
                  {fileName && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Click to replace</div>}
                  <input id="file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={handleFileUpload} />
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || uploading}>{saving ? 'Saving...' : 'Save Document'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
