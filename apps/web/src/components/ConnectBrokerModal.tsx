/**
 * ConnectBrokerModal.tsx
 * Per-User Broker Connection Modal with Direct Developer Portal Links
 */
import React, { useState, useEffect } from 'react';
import { supabase, saveUserBrokerCredentials, fetchUserBrokerCredentials } from '../services/supabaseClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (brokerName: string, mode: 'PAPER' | 'LIVE') => void;
}

type BrokerType = 'ANGELONE' | 'ZERODHA' | 'UPSTOX' | 'DHAN' | 'FYERS' | 'PAPER';

interface BrokerMeta {
  id: BrokerType;
  name: string;
  icon: string;
  color: string;
  portalLink: string;
  portalLabel: string;
  guideSteps: string[];
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}

const BROKERS: BrokerMeta[] = [
  {
    id: 'ANGELONE',
    name: 'Angel One (SmartAPI)',
    icon: '🦅',
    color: '#ff6b35',
    portalLink: 'https://smartapi.angelone.in',
    portalLabel: 'Generate SmartAPI Key on Angel One',
    guideSteps: [
      '1. Log in to SmartAPI portal at smartapi.angelone.in',
      '2. Click "+ Create App" (Select Trading App)',
      '3. Copy your API Key & Client ID, and paste them below'
    ],
    fields: [
      { key: 'ANGELONE_CLIENT_ID', label: 'Angel One Client ID', placeholder: 'e.g. A123456' },
      { key: 'ANGELONE_CLIENT_SECRET', label: 'Angel One API Key (SmartAPI Key)', placeholder: 'e.g. your_smart_api_key' },
      { key: 'ANGELONE_PASSWORD', label: 'Angel One PIN / Password', placeholder: '••••', type: 'password' },
      { key: 'ANGELONE_TOTP_SECRET', label: 'Angel One TOTP Secret (from Authenticator)', placeholder: 'e.g. JBSWY3DPEHPK3PXP', type: 'password' },
    ]
  },
  {
    id: 'ZERODHA',
    name: 'Zerodha Kite',
    icon: '🔷',
    color: '#387ed1',
    portalLink: 'https://kite.trade',
    portalLabel: 'Generate Kite Connect Key on Zerodha',
    guideSteps: [
      '1. Log in to Developer Portal at kite.trade',
      '2. Click "Create New App"',
      '3. Copy your API Key & Access Token, and paste them below'
    ],
    fields: [
      { key: 'ZERODHA_API_KEY', label: 'Zerodha Kite API Key', placeholder: 'e.g. kite_api_key' },
      { key: 'ZERODHA_ACCESS_TOKEN', label: 'Zerodha Access Token', placeholder: 'e.g. access_token_here', type: 'password' },
      { key: 'ZERODHA_API_SECRET', label: 'Zerodha API Secret', placeholder: 'e.g. api_secret_here', type: 'password' },
    ]
  },
  {
    id: 'UPSTOX',
    name: 'Upstox Developer',
    icon: '⚡',
    color: '#7c3aed',
    portalLink: 'https://upstox.com/developer/api-dashboard',
    portalLabel: 'Generate Access Token on Upstox API Portal',
    guideSteps: [
      '1. Log in to Upstox Developer Dashboard',
      '2. Create an App under API Apps',
      '3. Copy your API Key & Access Token below'
    ],
    fields: [
      { key: 'UPSTOX_API_KEY', label: 'Upstox API Key', placeholder: 'e.g. upstox_key' },
      { key: 'UPSTOX_ACCESS_TOKEN', label: 'Upstox Access Token', placeholder: 'e.g. upstox_access_token', type: 'password' },
    ]
  },
  {
    id: 'DHAN',
    name: 'DhanHQ',
    icon: '🏦',
    color: '#0ea5e9',
    portalLink: 'https://dhanhq.co',
    portalLabel: 'Generate Access Token on DhanHQ Portal',
    guideSteps: [
      '1. Log in to DhanHQ Developer Portal',
      '2. Generate an Access Token under Token Management',
      '3. Copy your Client ID & Token below'
    ],
    fields: [
      { key: 'DHAN_CLIENT_ID', label: 'Dhan Client ID', placeholder: 'e.g. 1000123456' },
      { key: 'DHAN_ACCESS_TOKEN', label: 'Dhan Access Token', placeholder: 'e.g. dhan_token', type: 'password' },
    ]
  },
  {
    id: 'FYERS',
    name: 'Fyers API',
    icon: '🦊',
    color: '#e63946',
    portalLink: 'https://myapi.fyers.in',
    portalLabel: 'Generate App ID on Fyers Portal',
    guideSteps: [
      '1. Log in to Fyers API Portal at myapi.fyers.in',
      '2. Create an App',
      '3. Copy App ID & Access Token below'
    ],
    fields: [
      { key: 'FYERS_APP_ID', label: 'Fyers App ID', placeholder: 'e.g. XY12345-100' },
      { key: 'FYERS_ACCESS_TOKEN', label: 'Fyers Access Token', placeholder: 'e.g. fyers_token', type: 'password' },
    ]
  },
  {
    id: 'PAPER',
    name: 'Paper Trading (Demo Account)',
    icon: '📄',
    color: '#10b981',
    portalLink: '',
    portalLabel: '',
    guideSteps: [
      'Simulate trading with ₹1,00,000 virtual balance.',
      'No broker API key required! Perfect for zero-risk testing.'
    ],
    fields: []
  }
];

export default function ConnectBrokerModal({ isOpen, onClose, onSuccess }: Props) {
  const [selectedBroker, setSelectedBroker] = useState<BrokerType>('ANGELONE');
  const [tradingMode, setTradingMode] = useState<'PAPER' | 'LIVE'>('LIVE');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeMeta = BROKERS.find(b => b.id === selectedBroker) || BROKERS[0];

  useEffect(() => {
    if (isOpen) {
      // Load saved broker settings from Supabase if present
      supabase.auth.getUser().then(async ({ data }) => {
        if (data.user) {
          const creds = await fetchUserBrokerCredentials(data.user.id);
          if (creds) {
            setSelectedBroker(creds.broker_name as BrokerType);
            setTradingMode(creds.trading_mode || 'LIVE');
            setFieldValues(creds.credentials_json || {});
          }
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (key: string, val: string) => {
    setFieldValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setMsg({ type: 'error', text: 'You must be logged in with Google to save broker credentials.' });
        setLoading(false);
        return;
      }

      const success = await saveUserBrokerCredentials({
        user_id: data.user.id,
        broker_name: selectedBroker,
        credentials_json: fieldValues,
        trading_mode: selectedBroker === 'PAPER' ? 'PAPER' : tradingMode,
        is_active: true,
      });

      if (success) {
        setMsg({ type: 'success', text: `✅ Successfully connected to ${activeMeta.name}!` });
        setTimeout(() => {
          onSuccess(selectedBroker, selectedBroker === 'PAPER' ? 'PAPER' : tradingMode);
          onClose();
        }, 1200);
      } else {
        setMsg({ type: 'error', text: 'Failed to save credentials in database.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Error saving broker credentials.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 650,
        background: '#0d1117',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: 20,
        padding: '24px 28px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
        color: '#fff',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>
              🔗 Connect Broker Account
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
              Link your broker account to view your live portfolio directly under your Google Account
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
              width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16
            }}
          >
            ✕
          </button>
        </div>

        {/* Broker Tabs */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 8, marginBottom: 20
        }}>
          {BROKERS.map(b => {
            const active = selectedBroker === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => { setSelectedBroker(b.id); setMsg(null); }}
                style={{
                  padding: '10px 8px',
                  borderRadius: 12,
                  border: `1px solid ${active ? b.color : 'rgba(255,255,255,0.08)'}`,
                  background: active ? `rgba(${b.id === 'ANGELONE' ? '255,107,53' : '99,102,241'}, 0.15)` : 'rgba(255,255,255,0.02)',
                  color: active ? '#fff' : '#9ca3af',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: active ? 700 : 500,
                  fontSize: 12,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 2 }}>{b.icon}</div>
                {b.name.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {/* Selected Broker Configuration Card */}
        <form onSubmit={handleSave} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{activeMeta.icon}</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: activeMeta.color }}>
                  {activeMeta.name}
                </h3>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Saved securely in Supabase for your Google Account</span>
              </div>
            </div>

            {selectedBroker !== 'PAPER' && (
              <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.4)', padding: 3, borderRadius: 8 }}>
                <button
                  type="button"
                  onClick={() => setTradingMode('LIVE')}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none',
                    background: tradingMode === 'LIVE' ? '#10b981' : 'transparent',
                    color: tradingMode === 'LIVE' ? '#fff' : '#9ca3af',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  🔴 LIVE
                </button>
                <button
                  type="button"
                  onClick={() => setTradingMode('PAPER')}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none',
                    background: tradingMode === 'PAPER' ? '#6366f1' : 'transparent',
                    color: tradingMode === 'PAPER' ? '#fff' : '#9ca3af',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  🧪 PAPER
                </button>
              </div>
            )}
          </div>

          {/* Official Broker Developer Portal Link Banner */}
          {activeMeta.portalLink && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(167,139,250,0.15) 100%)',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 16
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', marginBottom: 6 }}>
                🔑 Don't have your {activeMeta.name} API Key yet?
              </div>
              <a
                href={activeMeta.portalLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#6366f1',
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
                }}
              >
                <span>🚀 {activeMeta.portalLabel}</span>
                <span>↗</span>
              </a>
              <div style={{ marginTop: 10, fontSize: 11, color: '#d1d5db', lineHeight: 1.5 }}>
                {activeMeta.guideSteps.map((step, idx) => (
                  <div key={idx}>{step}</div>
                ))}
              </div>
            </div>
          )}

          {/* Form Fields */}
          {activeMeta.fields.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {activeMeta.fields.map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type || 'text'}
                    value={fieldValues[f.key] || ''}
                    onChange={(e) => handleInputChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(0,0,0,0.5)',
                      color: '#fff',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#10b981', fontSize: 14, fontWeight: 600 }}>
              ✅ Paper Trading mode is ready! Virtual ₹1,00,000 balance enabled.
            </div>
          )}

          {/* Status Message */}
          {msg && (
            <div style={{
              marginTop: 14, padding: '10px 12px', borderRadius: 8,
              background: msg.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${msg.type === 'success' ? '#10b981' : '#ef4444'}`,
              color: msg.type === 'success' ? '#6ee7b7' : '#fca5a5',
              fontSize: 12,
            }}>
              {msg.text}
            </div>
          )}

          {/* Submit Button */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#9ca3af', fontSize: 13, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 22px', borderRadius: 8, border: 'none',
                background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Saving to Supabase...' : 'Save & Connect Portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
