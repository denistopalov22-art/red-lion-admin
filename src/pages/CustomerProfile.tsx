import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Profile, CustomerVehicle, Document, ServiceHistory, Warranty, ServiceBooking } from '../types';

interface CVWithVehicle extends CustomerVehicle {
  vehicles?: { make: string; model: string; year: number } | null;
  documents?: Document[];
  service_history?: ServiceHistory[];
  warranties?: Warranty[];
}

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cvs, setCvs] = useState<CVWithVehicle[]>([]);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [tab, setTab] = useState<'vehicles' | 'documents' | 'warranty' | 'service' | 'bookings'>('vehicles');
  const [loading, setLoading] = useState(true);

  // Edit profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Upload document state
  const [showDocModal, setShowDocModal] = useState(false);
  const [docCvId, setDocCvId] = useState('');
  const [docType, setDocType] = useState('Invoice');
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [docUploading, setDocUploading] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [docError, setDocError] = useState('');

  async function load() {
    if (!id) return;
    const [profileRes, cvsRes, bookingsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('customer_vehicles').select(`*, vehicles(make,model,year), documents(*), service_history(*), warranties(*)`).eq('user_id', id).order('created_at', { ascending: false }),
      supabase.from('service_bookings').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    ]);
    setProfile(profileRes.data);
    setCvs(cvsRes.data ?? []);
    setBookings(bookingsRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function startEditProfile() {
    if (!profile) return;
    setEditName(profile.full_name ?? '');
    setEditPhone(profile.phone ?? '');
    setEditAddress((profile as any).address ?? '');
    setEditingProfile(true);
  }

  async function saveProfile() {
    if (!id) return;
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({
      full_name: editName || null,
      phone: editPhone || null,
      address: editAddress || null,
    }).eq('id', id);
    setSavingProfile(false);
    if (!error) {
      setEditingProfile(false);
      load();
    }
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    setDocError('');
    const fileName = `${id}/${Date.now()}-${file.name}`;
    const { data, error: uploadErr } = await supabase.storage.from('documents').upload(fileName, file, { upsert: true });
    if (uploadErr) { setDocError('Upload failed: ' + uploadErr.message); setDocUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(data.path);
    setDocUrl(publicUrl);
    setDocFileName(file.name);
    if (!docTitle) setDocTitle(file.name.replace(/\.[^.]+$/, ''));
    setDocUploading(false);
  }

  async function saveDoc() {
    if (!docCvId) { setDocError('Please select a vehicle'); return; }
    if (!docUrl) { setDocError('Please upload a file first'); return; }
    setSavingDoc(true);
    setDocError('');
    // Include user_id so the customer can see their document in the mobile app
    const { error } = await supabase.from('documents').insert({
      customer_vehicle_id: docCvId,
      user_id: id,  // The customer's user ID (from URL params)
      type: docType,
      title: docTitle || docType,
      file_url: docUrl,
      uploaded_at: new Date().toISOString(),
    });
    setSavingDoc(false);
    if (error) { setDocError(error.message); return; }
    setShowDocModal(false);
    setDocCvId(''); setDocType('Invoice'); setDocTitle(''); setDocUrl(''); setDocFileName(''); setDocError('');
    load();
  }

  async function deleteDoc(docId: string) {
    if (!confirm('Delete this document?')) return;
    await supabase.from('documents').delete().eq('id', docId);
    load();
  }

  async function updateBookingStatus(bookingId: string, status: string) {
    await supabase.from('service_bookings').update({ status }).eq('id', bookingId);
    load();
  }

  if (loading) return <div className="loading">Loading profile...</div>;
  if (!profile) return <div className="page"><div className="error-msg">Customer not found</div></div>;

  const allDocs = cvs.flatMap(cv => cv.documents ?? []);
  const allService = cvs.flatMap(cv => cv.service_history ?? []);
  const allWarranties = cvs.flatMap(cv => cv.warranties ?? []);

  function statusBadge(status: string) {
    const map: Record<string, string> = { Pending: 'badge-amber', Confirmed: 'badge-blue', Completed: 'badge-green', Cancelled: 'badge-gray' };
    return <span className={`badge ${map[status] ?? 'badge-gray'}`}>{status}</span>;
  }

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate('/customers')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1>{profile.full_name || 'Customer Profile'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/handover?customer=${id}`)}>+ Handover</button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/notifications?customer=${id}`)}>Send Notification</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setShowDocModal(true); setDocCvId(cvs[0]?.id ?? ''); }}>Upload Document</button>
        </div>
      </div>
      <div className="page">
        <div className="profile-grid">
          {/* Left: customer info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer Details</div>
                {!editingProfile && (
                  <button className="btn btn-ghost btn-sm" onClick={startEditProfile}>Edit</button>
                )}
              </div>

              {editingProfile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Full Name</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Phone</label>
                    <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+44 7700 000000" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Address</label>
                    <input value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="123 Main St, Town, AB1 2CD" />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingProfile(false)}>Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save'}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="info-row"><span className="key">Name</span><span className="val">{profile.full_name || '—'}</span></div>
                  <div className="info-row"><span className="key">Email</span><span className="val">{profile.email || '—'}</span></div>
                  <div className="info-row"><span className="key">Phone</span><span className="val">{profile.phone || '—'}</span></div>
                  <div className="info-row"><span className="key">Address</span><span className="val">{(profile as any).address || '—'}</span></div>
                  <div className="info-row"><span className="key">Joined</span><span className="val">{new Date(profile.created_at).toLocaleDateString('en-GB')}</span></div>
                  <div className="info-row"><span className="key">Vehicles</span><span className="val">{cvs.length}</span></div>
                </>
              )}
            </div>
          </div>

          {/* Right: tabs */}
          <div>
            <div className="tabs">
              {(['vehicles', 'documents', 'warranty', 'service', 'bookings'] as const).map(t => (
                <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                  {t === 'vehicles' ? `Vehicles (${cvs.length})` :
                   t === 'documents' ? `Documents (${allDocs.length})` :
                   t === 'warranty' ? `Warranty (${allWarranties.length})` :
                   t === 'service' ? `Service (${allService.length})` :
                   `Bookings (${bookings.length})`}
                </div>
              ))}
            </div>

            {tab === 'vehicles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cvs.length === 0 ? (
                  <div className="empty">No vehicles linked. <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={() => navigate(`/handover?customer=${id}`)}>Start Handover</button></div>
                ) : cvs.map(cv => (
                  <div className="card" key={cv.id}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>
                      {cv.vehicles ? `${cv.vehicles.year} ${cv.vehicles.make} ${cv.vehicles.model}` : cv.registration}
                    </div>
                    <div className="form-grid">
                      <div className="info-row"><span className="key">Reg</span><span className="val">{cv.registration}</span></div>
                      <div className="info-row"><span className="key">VIN</span><span className="val">{cv.vin || '—'}</span></div>
                      <div className="info-row"><span className="key">Purchase Date</span><span className="val">{cv.purchase_date ? new Date(cv.purchase_date).toLocaleDateString('en-GB') : '—'}</span></div>
                      <div className="info-row"><span className="key">Purchase Price</span><span className="val">{cv.purchase_price ? `£${cv.purchase_price.toLocaleString()}` : '—'}</span></div>
                      <div className="info-row"><span className="key">Mileage</span><span className="val">{cv.mileage_at_purchase ? cv.mileage_at_purchase.toLocaleString() + ' mi' : '—'}</span></div>
                      <div className="info-row"><span className="key">MOT Due</span><span className="val">{cv.mot_date ? new Date(cv.mot_date).toLocaleDateString('en-GB') : '—'}</span></div>
                      <div className="info-row"><span className="key">Service Due</span><span className="val">{cv.service_date ? new Date(cv.service_date).toLocaleDateString('en-GB') : '—'}</span></div>
                      {(cv as any).finance_provider && <div className="info-row"><span className="key">Finance</span><span className="val">{(cv as any).finance_provider}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'documents' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => { setShowDocModal(true); setDocCvId(cvs[0]?.id ?? ''); }}>
                    + Upload Document
                  </button>
                </div>
                <div className="card" style={{ padding: 0 }}>
                  <table>
                    <thead><tr><th>Type</th><th>Title</th><th>Date</th><th></th></tr></thead>
                    <tbody>
                      {allDocs.length === 0 ? (
                        <tr><td colSpan={4}><div className="empty">No documents uploaded yet</div></td></tr>
                      ) : allDocs.map(d => (
                        <tr key={d.id}>
                          <td><span className="tag">{d.type}</span></td>
                          <td><strong>{d.title || '—'}</strong></td>
                          <td>{new Date(d.uploaded_at).toLocaleDateString('en-GB')}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View</a>}
                              <button className="btn btn-danger btn-sm" onClick={() => deleteDoc(d.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'warranty' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {allWarranties.length === 0 ? (
                  <div className="empty">No warranties. <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={() => navigate('/warranties')}>Add Warranty</button></div>
                ) : allWarranties.map(w => (
                  <div className="card" key={w.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <strong>{w.provider} — {w.plan_name}</strong>
                      <span className={`badge ${new Date(w.expiry_date) > new Date() ? 'badge-green' : 'badge-red'}`}>
                        {new Date(w.expiry_date) > new Date() ? 'Active' : 'Expired'}
                      </span>
                    </div>
                    <div className="info-row"><span className="key">Start</span><span className="val">{new Date(w.start_date).toLocaleDateString('en-GB')}</span></div>
                    <div className="info-row"><span className="key">Expiry</span><span className="val">{new Date(w.expiry_date).toLocaleDateString('en-GB')}</span></div>
                    {w.coverage_details?.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>{w.coverage_details.join(' · ')}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'service' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/service-history')}>+ Add Service Record</button>
                </div>
                <div className="card" style={{ padding: 0 }}>
                  <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Mileage</th><th>Work Done</th><th></th></tr></thead>
                    <tbody>
                      {allService.length === 0 ? (
                        <tr><td colSpan={5}><div className="empty">No service history</div></td></tr>
                      ) : allService.map(s => (
                        <tr key={s.id}>
                          <td>{new Date(s.service_date).toLocaleDateString('en-GB')}</td>
                          <td><span className="tag">{(s as any).service_type || 'Service'}</span></td>
                          <td>{s.mileage ? s.mileage.toLocaleString() + ' mi' : '—'}</td>
                          <td><strong>{s.work_done || (s as any).description || '—'}</strong></td>
                          <td>{s.invoice_url && <a href={s.invoice_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Invoice</a>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'bookings' && (
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead><tr><th>Type</th><th>Date</th><th>Status</th><th>Message</th><th></th></tr></thead>
                  <tbody>
                    {bookings.length === 0 ? (
                      <tr><td colSpan={5}><div className="empty">No bookings</div></td></tr>
                    ) : bookings.map(b => (
                      <tr key={b.id}>
                        <td><span className="tag">{b.service_type}</span></td>
                        <td>{new Date(b.preferred_date).toLocaleDateString('en-GB')}</td>
                        <td>{statusBadge(b.status)}</td>
                        <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.message || '—'}</td>
                        <td>
                          {b.status === 'Pending' && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-primary btn-sm" onClick={() => updateBookingStatus(b.id, 'Confirmed')}>Confirm</button>
                              <button className="btn btn-danger btn-sm" onClick={() => updateBookingStatus(b.id, 'Cancelled')}>Cancel</button>
                            </div>
                          )}
                          {b.status === 'Confirmed' && (
                            <button className="btn btn-primary btn-sm" onClick={() => updateBookingStatus(b.id, 'Completed')}>Complete</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Document Modal */}
      {showDocModal && (
        <div className="modal-overlay" onClick={() => setShowDocModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Document</h3>
              <button className="btn-icon" onClick={() => setShowDocModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {docError && <div className="error-msg">{docError}</div>}
              {cvs.length > 1 && (
                <div className="form-group">
                  <label>Vehicle *</label>
                  <select value={docCvId} onChange={e => setDocCvId(e.target.value)}>
                    <option value="">— Select vehicle —</option>
                    {cvs.map(cv => <option key={cv.id} value={cv.id}>{cv.vehicles ? `${cv.vehicles.year} ${cv.vehicles.make} ${cv.vehicles.model}` : cv.registration}</option>)}
                  </select>
                </div>
              )}
              <div className="form-grid">
                <div className="form-group">
                  <label>Document Type</label>
                  <select value={docType} onChange={e => setDocType(e.target.value)}>
                    {['Invoice', 'MOT', 'HPI', 'Warranty', 'Service', 'Other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Title</label>
                  <input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Document title" />
                </div>
                <div className="form-group form-full">
                  <label>Upload File *</label>
                  <div className="upload-area" onClick={() => document.getElementById('profile-doc-input')?.click()} style={{ cursor: 'pointer' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24, marginBottom: 4 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <div style={{ fontSize: 13 }}>{docUploading ? 'Uploading...' : docFileName ? `✓ ${docFileName}` : 'Click to upload PDF or image'}</div>
                    {docFileName && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Click to replace</div>}
                    <input id="profile-doc-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={handleDocUpload} />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDocModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveDoc} disabled={savingDoc || docUploading}>{savingDoc ? 'Saving...' : 'Save Document'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
