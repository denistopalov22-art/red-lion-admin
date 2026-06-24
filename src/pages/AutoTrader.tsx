import { useState, useEffect } from 'react';

interface SyncStatus {
  configured: boolean;
  advertiserId: string | null;
  lastSync: string | null;
  lastSyncCount: number;
  lastError: string | null;
  isRunning: boolean;
  webhookReceived: number;
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://redlionapp-o7ekd5eh.manus.space';

export default function AutoTrader() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [authResult, setAuthResult] = useState<{ authenticated: boolean; timestamp?: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testingAuth, setTestingAuth] = useState(false);

  async function fetchStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/autotrader/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Server may not be reachable in dev
    } finally {
      setLoading(false);
    }
  }

  async function testAuth() {
    setTestingAuth(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/autotrader/test-auth`);
      const data = await res.json();
      setAuthResult(data);
      if (data.authenticated) {
        setMessage({ type: 'success', text: 'AutoTrader credentials are active and working.' });
      } else {
        setMessage({ type: 'error', text: 'AutoTrader credentials not yet active. This is normal — sandbox credentials can take a few hours to activate. Try again later.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not reach the server. Make sure the app server is running.' });
    } finally {
      setTestingAuth(false);
    }
  }

  async function triggerSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/autotrader/sync`, { method: 'POST' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Baseline sync started. This may take a minute. Refresh this page to see the updated count.' });
        // Refresh status after 5 seconds
        setTimeout(fetchStatus, 5000);
      } else {
        setMessage({ type: 'error', text: 'Failed to trigger sync. Check server logs.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not reach the server.' });
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  const webhookUrl = `${API_BASE}/api/autotrader/webhook`;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>AutoTrader Connect</h1>
          <p style={{ color: 'var(--text3)', marginTop: 4 }}>
            Real-time stock synchronisation from AutoTrader to your forecourt
          </p>
        </div>
        <button className="btn btn-primary" onClick={fetchStatus}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 20,
          background: message.type === 'success' ? 'var(--green-bg, #f0fdf4)' : 'var(--red-bg, #fef2f2)',
          color: message.type === 'success' ? 'var(--green, #16a34a)' : 'var(--red, #dc2626)',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          fontSize: 14,
        }}>
          {message.text}
        </div>
      )}

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: loading ? '#f59e0b' : (status?.configured ? '#22c55e' : '#ef4444'),
            }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>
              {loading ? 'Loading...' : status?.configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Advertiser ID</div>
          <div style={{ fontWeight: 600, fontSize: 16, fontFamily: 'monospace' }}>
            {status?.advertiserId || '—'}
          </div>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Sync</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {status?.lastSync
              ? new Date(status.lastSync).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : 'Never'}
          </div>
          {status?.lastSyncCount ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{status.lastSyncCount} vehicles synced</div>
          ) : null}
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Webhooks Received</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{status?.webhookReceived ?? 0}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>since last restart</div>
        </div>
      </div>

      {/* Error banner */}
      {status?.lastError && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 20,
          background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: 14,
        }}>
          <strong>Last Error:</strong> {status.lastError}
        </div>
      )}

      {/* Webhook URL */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '20px 24px' }}>
          <h3 style={{ marginBottom: 4, fontSize: 16 }}>Webhook URL</h3>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>
            Send this URL to <strong>integration.management@autotrader.co.uk</strong> to enable real-time stock updates.
            Without it, AutoTrader will only send up to 3 updates per day.
          </p>
          <div style={{
            background: 'var(--bg2, #f5f5f5)',
            borderRadius: 6,
            padding: '10px 14px',
            fontFamily: 'monospace',
            fontSize: 13,
            wordBreak: 'break-all',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <span>{webhookUrl}</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                setMessage({ type: 'success', text: 'Webhook URL copied to clipboard!' });
              }}
              style={{ flexShrink: 0 }}
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '20px 24px' }}>
          <h3 style={{ marginBottom: 4, fontSize: 16 }}>Actions</h3>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
            Test your credentials and manually trigger a full stock sync from AutoTrader.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <>
              <style>{`@keyframes at-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <button
                className="btn btn-secondary"
                onClick={testAuth}
                disabled={testingAuth}
                style={{ minWidth: 160, opacity: testingAuth ? 0.75 : 1 }}
              >
                {testingAuth ? (
                  <>
                    <svg
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      style={{ width: 16, height: 16, animation: 'at-spin 0.8s linear infinite', flexShrink: 0 }}
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Checking...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                    </svg>
                    Test Credentials
                  </>
                )}
              </button>
            </>
            <button
              className="btn btn-primary"
              onClick={triggerSync}
              disabled={syncing || status?.isRunning}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              {syncing || status?.isRunning ? 'Syncing...' : 'Run Baseline Sync'}
            </button>
          </div>

          {authResult && (
            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 6, fontSize: 13,
              background: authResult.authenticated ? '#f0fdf4' : '#fef2f2',
              color: authResult.authenticated ? '#16a34a' : '#dc2626',
              border: `1px solid ${authResult.authenticated ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {authResult.authenticated
                ? '✓ Credentials verified — AutoTrader sandbox is active'
                : '✗ Credentials not yet active — sandbox credentials can take a few hours to activate after issuance'}
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="card">
        <div style={{ padding: '20px 24px' }}>
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>How It Works</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { step: '1', title: 'Baseline Sync', desc: 'On startup, all your AutoTrader stock is fetched and saved to the database.' },
              { step: '2', title: 'Real-Time Webhook', desc: 'AutoTrader sends a notification every time you add, update, or remove a vehicle.' },
              { step: '3', title: 'Instant Update', desc: 'The app forecourt reflects changes within seconds — no manual uploads needed.' },
              { step: '4', title: 'PUBLISHED Only', desc: 'Only vehicles with status PUBLISHED on your advertiser advert are shown to customers.' },
            ].map(item => (
              <div key={item.step} style={{ display: 'flex', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: 'var(--red, #c0392b)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 13, flexShrink: 0,
                }}>
                  {item.step}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
