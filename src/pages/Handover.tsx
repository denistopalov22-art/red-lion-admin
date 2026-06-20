import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Profile, Vehicle } from '../types';

const STEPS = ['Customer', 'Vehicle', 'Purchase', 'MOT & Service', 'Warranty', 'Documents', 'Confirm'];

export default function Handover() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [customerId, setCustomerId] = useState(searchParams.get('customer') ?? '');
  const [vehicleId, setVehicleId] = useState('');
  const [registration, setRegistration] = useState('');
  const [vin, setVin] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [mileage, setMileage] = useState('');
  const [motDate, setMotDate] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [warrantyProvider, setWarrantyProvider] = useState('');
  const [warrantyPlan, setWarrantyPlan] = useState('');
  const [warrantyStart, setWarrantyStart] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [warrantyCoverage, setWarrantyCoverage] = useState<string[]>([]);

  const COVERAGE_OPTIONS = ['Engine','Gearbox','Turbo','Electrical','Suspension','Brakes','Air Conditioning','Fuel System','Cooling System','Steering','Drivetrain','Other'];
  function toggleWarrantyCoverage(item: string) {
    setWarrantyCoverage(prev => prev.includes(item) ? prev.filter(c => c !== item) : [...prev, item]);
  }
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('Invoice');
  const [docUrl, setDocUrl] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [docUploading, setDocUploading] = useState(false);
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    setError('');
    const fileName = `${Date.now()}-${file.name}`;
    const { data, error: uploadErr } = await supabase.storage.from('documents').upload(fileName, file, { upsert: true });
    if (uploadErr) { setError('Upload failed: ' + uploadErr.message); setDocUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(data.path);
    setDocUrl(publicUrl);
    setDocFileName(file.name);
    if (!docTitle) setDocTitle(file.name.replace(/\.[^.]+$/, ''));
    setDocUploading(false);
  }

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      try {
        // Load ALL profiles that are not admin — this includes every app-registered customer
        const [cRes, vRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .neq('role', 'admin')
            .order('full_name'),
          supabase
            .from('vehicles')
            .select('*')
            .in('status', ['AVAILABLE', 'RESERVED'])
            .order('make'),
        ]);
        setCustomers(cRes.data ?? []);
        setVehicles(vRes.data ?? []);
      } catch (err) {
        console.error('Failed to load handover data:', err);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (vehicleId && vehicles.length > 0) {
      const v = vehicles.find(x => x.stock_id === vehicleId);
      if (v) {
        if (v.registration) setRegistration(v.registration);
        if (v.price) setPurchasePrice(String(v.price));
        if (v.mileage) setMileage(String(v.mileage));
      }
    }
  }, [vehicleId, vehicles]);

  function canAdvance() {
    if (step === 0) return !!customerId;
    if (step === 1) return !!vehicleId || !!registration;
    if (step === 2) return !!purchaseDate && !!purchasePrice;
    return true;
  }

  async function handleComplete() {
    setSaving(true);
    setError('');
    try {
      // 1. Create customer_vehicle record
      const { data: cv, error: cvErr } = await supabase.from('customer_vehicles').insert({
        user_id: customerId,
        vehicle_id: vehicleId || null,
        registration,
        vin: vin || null,
        purchase_date: purchaseDate,
        purchase_price: parseFloat(purchasePrice),
        mileage_at_purchase: mileage ? parseInt(mileage) : null,
        mot_date: motDate || null,
        service_date: serviceDate || null,
        warranty_start: warrantyStart || null,
        warranty_expiry: warrantyExpiry || null,
      }).select().single();

      if (cvErr) throw new Error(cvErr.message);

      // 2. Update vehicle status to SOLD
      if (vehicleId) {
        await supabase.from('vehicles').update({ status: 'SOLD' }).eq('stock_id', vehicleId);
      }

      // 3. Create warranty record if provided
      if (warrantyProvider && warrantyStart && warrantyExpiry) {
        const warrantyIsActive = new Date(warrantyExpiry) >= new Date();
        await supabase.from('warranties').insert({
          customer_vehicle_id: cv.id,
          user_id: customerId,  // Link to customer so they can see it in the mobile app
          provider: warrantyProvider,
          plan_name: warrantyPlan || 'Standard',
          start_date: warrantyStart,
          expiry_date: warrantyExpiry,
          status: warrantyIsActive ? 'Active' : 'Expired',
          coverage_details: warrantyCoverage,
        });
      }

      // 4. Create document if provided
      if (docUrl || docTitle) {
        await supabase.from('documents').insert({
          customer_vehicle_id: cv.id,
          user_id: customerId,  // Link to customer so they can see it in the mobile app
          type: docType,
          title: docTitle || docType,
          file_url: docUrl || null,
          uploaded_at: new Date().toISOString(),
        });
      }

      // 5. Send notification if requested
      if (notifyCustomer) {
        const customer = customers.find(c => c.id === customerId);
        const vehicle = vehicles.find(v => v.stock_id === vehicleId);
        await supabase.from('notifications').insert({
          user_id: customerId,
          title: 'Vehicle Handover Complete',
          message: `Welcome to the Red Lion Motors family! Your ${vehicle ? `${vehicle.year ?? ''} ${vehicle.make} ${vehicle.model}` : registration} has been registered to your account.`,
          read: false,
        });
        // Send push if token available
        if (customer?.push_token) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: customer.push_token,
              title: 'Vehicle Handover Complete',
              body: `Your ${vehicle ? `${vehicle.make} ${vehicle.model}` : registration} is now in your garage!`,
            }),
          }).catch(() => {});
        }
      }

      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    }
    setSaving(false);
  }

  if (done) {
    const customer = customers.find(c => c.id === customerId);
    const vehicle = vehicles.find(v => v.stock_id === vehicleId);
    return (
      <>
        <div className="topbar"><h1>Vehicle Handover</h1></div>
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: 40 }}>
            <div style={{ width: 60, height: 60, background: 'var(--green-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" style={{ width: 28, height: 28 }}><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Handover Complete!</h2>
            <p style={{ color: 'var(--text3)', marginBottom: 20 }}>
              {vehicle ? `${vehicle.year ?? ''} ${vehicle.make} ${vehicle.model}` : registration} has been assigned to {customer?.full_name || customer?.email || 'the customer'}.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => navigate(`/customers/${customerId}`)}>View Customer</button>
              <button className="btn btn-primary" onClick={() => { setStep(0); setDone(false); setCustomerId(''); setVehicleId(''); }}>New Handover</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar"><h1>Vehicle Handover Wizard</h1></div>
      <div className="page">
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {/* Steps */}
          <div className="steps">
            {STEPS.map((s, i) => (
              <div key={s} className={`step${i === step ? ' active' : i < step ? ' done' : ''}`}>
                <div className="step-dot">{i < step ? '✓' : i + 1}</div>
                <div className="step-label">{s}</div>
              </div>
            ))}
          </div>

          <div className="card">
            {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

            {/* Step 0: Customer */}
            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Select Customer</h3>
                {loadingData ? (
                  <div style={{ color: 'var(--text3)', fontSize: 14 }}>Loading customers...</div>
                ) : (
                  <div className="form-group">
                    <label>Customer *</label>
                    <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
                      <option value="">— Select a customer ({customers.length} registered) —</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.full_name || c.email || c.id}
                          {c.email && c.full_name ? ` (${c.email})` : ''}
                        </option>
                      ))}
                    </select>
                    {customers.length === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                        No customers found. Ask the customer to register via the Red Lion Motors app first, or create one manually in the Customers page.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Vehicle */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Select Vehicle</h3>
                <div className="form-group">
                  <label>Vehicle from Stock</label>
                  <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                    <option value="">— Select from stock (optional) —</option>
                    {vehicles.map(v => (
                      <option key={v.stock_id} value={v.stock_id}>
                        {v.year ?? ''} {v.make} {v.model} — £{(v.price ?? 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Registration *</label>
                    <input value={registration} onChange={e => setRegistration(e.target.value)} placeholder="AB12 CDE" />
                  </div>
                  <div className="form-group">
                    <label>VIN</label>
                    <input value={vin} onChange={e => setVin(e.target.value)} placeholder="WBA..." />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Purchase */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Purchase Details</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Purchase Date *</label>
                    <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Purchase Price (£) *</label>
                    <input type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="25000" />
                  </div>
                  <div className="form-group">
                    <label>Mileage at Purchase</label>
                    <input type="number" value={mileage} onChange={e => setMileage(e.target.value)} placeholder="45000" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: MOT & Service */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>MOT & Service Dates</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>MOT Expiry Date</label>
                    <input type="date" value={motDate} onChange={e => setMotDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Next Service Due</label>
                    <input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Warranty */}
            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Warranty (Optional)</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Provider</label>
                    <input value={warrantyProvider} onChange={e => setWarrantyProvider(e.target.value)} placeholder="Warranty Wise" />
                  </div>
                  <div className="form-group">
                    <label>Plan Name</label>
                    <input value={warrantyPlan} onChange={e => setWarrantyPlan(e.target.value)} placeholder="Gold Cover" />
                  </div>
                  <div className="form-group">
                    <label>Start Date</label>
                    <input type="date" value={warrantyStart} onChange={e => setWarrantyStart(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input type="date" value={warrantyExpiry} onChange={e => setWarrantyExpiry(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Coverage ({warrantyCoverage.length} selected)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {COVERAGE_OPTIONS.map(option => {
                      const selected = warrantyCoverage.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleWarrantyCoverage(option)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 20,
                            border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                            background: selected ? 'var(--primary)' : 'transparent',
                            color: selected ? '#fff' : 'var(--text2)',
                            fontSize: 13,
                            cursor: 'pointer',
                            fontWeight: selected ? 600 : 400,
                          }}
                        >
                          {selected && '✓ '}{option}
                        </button>
                      );
                    })}
                  </div>
                  {warrantyCoverage.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Select the components covered by this warranty (optional).</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Documents */}
            {step === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Attach Document (Optional)</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Document Type</label>
                    <select value={docType} onChange={e => setDocType(e.target.value)}>
                      {['Invoice','MOT','HPI','Warranty','Service','Other'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Title</label>
                    <input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Purchase Invoice" />
                  </div>
                  <div className="form-group form-full">
                    <label>Upload File</label>
                    <div className="upload-area" onClick={() => document.getElementById('handover-file-input')?.click()} style={{ cursor: 'pointer' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24, marginBottom: 4 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <div style={{ fontSize: 13 }}>{docUploading ? 'Uploading...' : docFileName ? `✓ ${docFileName}` : 'Click to upload PDF or image'}</div>
                      {docFileName && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Click to replace</div>}
                      <input id="handover-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={handleDocUpload} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Confirm */}
            {step === 6 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Confirm Handover</h3>
                {[
                  ['Customer', customers.find(c => c.id === customerId)?.full_name || customers.find(c => c.id === customerId)?.email || customerId],
                  ['Vehicle', vehicles.find(v => v.stock_id === vehicleId) ? `${vehicles.find(v => v.stock_id === vehicleId)!.make} ${vehicles.find(v => v.stock_id === vehicleId)!.model}` : registration],
                  ['Registration', registration],
                  ['Purchase Date', purchaseDate],
                  ['Purchase Price', purchasePrice ? `£${parseFloat(purchasePrice).toLocaleString()}` : '—'],
                  ['MOT Date', motDate || '—'],
                  ['Service Date', serviceDate || '—'],
                  ['Warranty', warrantyProvider ? `${warrantyProvider} — ${warrantyPlan}` : 'None'],
                  ['Document', docTitle || docFileName ? `${docType}: ${docTitle || docFileName}` : 'None'],
                ].map(([k, v]) => (
                  <div className="info-row" key={k}><span className="key">{k}</span><span className="val">{v}</span></div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <input type="checkbox" id="notify" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)} style={{ width: 'auto' }} />
                  <label htmlFor="notify" style={{ cursor: 'pointer', color: 'var(--text2)', fontSize: 13 }}>Send welcome notification to customer</label>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => step === 0 ? navigate(-1) : setStep(s => s - 1)}>
              {step === 0 ? 'Cancel' : '← Back'}
            </button>
            {step < STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canAdvance() || loadingData}>
                Next →
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleComplete} disabled={saving}>
                {saving ? 'Completing...' : 'Complete Handover'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
