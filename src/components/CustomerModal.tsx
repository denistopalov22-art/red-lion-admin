import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface Props {
  customer: Profile | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function CustomerModal({ customer, onClose, onSaved }: Props) {
  const [name, setName] = useState(customer?.full_name ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    if (customer) {
      // Editing existing customer — just update the profile row
      const { error: err } = await supabase
        .from('profiles')
        .update({ full_name: name, phone })
        .eq('id', customer.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      // Creating a new customer
      // First check if a profile already exists for this email
      const { data: existing } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (existing) {
        // Profile exists — just update the name/phone
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ full_name: name, phone, role: 'customer' })
          .eq('id', existing.id);
        if (updateErr) { setError(updateErr.message); setSaving(false); return; }
      } else {
        // No profile exists — try to create auth user + profile
        if (!password) { setError('Password is required for new customers'); setSaving(false); return; }
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) { setError(signUpErr.message); setSaving(false); return; }
        if (signUpData.user) {
          const { error: profileErr } = await supabase
            .from('profiles')
            .upsert({ id: signUpData.user.id, full_name: name, email, phone, role: 'customer' });
          if (profileErr) { setError(profileErr.message); setSaving(false); return; }
        }
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{customer ? 'Edit Customer' : 'New Customer'}</h3>
          <button className="btn-icon" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-msg">{error}</div>}
            <div className="form-grid">
              <div className="form-group form-full">
                <label>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" required />
              </div>
              {!customer && (
                <>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" required />
                  </div>
                  <div className="form-group">
                    <label>Password <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(only needed for new customers)</span></label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank if already registered in app" />
                  </div>
                  <div className="form-group form-full" style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 6, fontSize: 12, color: 'var(--text3)' }}>
                    <strong style={{ color: 'var(--text2)' }}>Tip:</strong> If the customer already registered via the Red Lion Motors app, just enter their email and name — no password needed. Their account will be linked automatically.
                  </div>
                </>
              )}
              <div className="form-group">
                <label>Phone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7700 900000" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
