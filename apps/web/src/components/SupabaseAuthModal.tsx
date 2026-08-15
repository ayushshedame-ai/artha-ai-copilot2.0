/**
 * SupabaseAuthModal.tsx
 * Premium Google OAuth + Email authentication modal for Artha Tech Copilot
 */
import React, { useState } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../services/supabaseClient';

interface Props {
  onSuccess?: () => void;
}

export default function SupabaseAuthModal({ onSuccess }: Props) {
  const [tab, setTab] = useState<'google' | 'email'>('google');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to initialize Google Sign In');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        if (onSuccess) onSuccess();
      } else {
        await signUpWithEmail(email, password);
        setInfoMsg('Account created! Check your email inbox to confirm your registration.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: 420,
      margin: '0 auto',
      background: 'rgba(17, 24, 39, 0.95)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: 20,
      padding: '32px 28px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(99, 102, 241, 0.15)',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 42, marginBottom: 8 }}>⚡</div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>
          Artha Tech Copilot
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af' }}>
          Sign in to access your private, isolated portfolio & trading vault
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: 'rgba(0, 0, 0, 0.3)',
        padding: 4,
        borderRadius: 12,
        marginBottom: 20,
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <button
          type="button"
          onClick={() => { setTab('google'); setErrorMsg(null); }}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 8,
            background: tab === 'google' ? '#6366f1' : 'transparent',
            color: tab === 'google' ? '#fff' : '#9ca3af',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Google Login
        </button>
        <button
          type="button"
          onClick={() => { setTab('email'); setErrorMsg(null); }}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 8,
            background: tab === 'email' ? '#6366f1' : 'transparent',
            color: tab === 'email' ? '#fff' : '#9ca3af',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Email & Password
        </button>
      </div>

      {/* Error & Info Alerts */}
      {errorMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          fontSize: 12,
          marginBottom: 16,
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#6ee7b7',
          fontSize: 12,
          marginBottom: 16,
        }}>
          ✅ {infoMsg}
        </div>
      )}

      {/* Tab 1: Google OAuth */}
      {tab === 'google' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              width: '100%',
              padding: '14px 20px',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: '#ffffff',
              color: '#1f2937',
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              transition: 'transform 0.15s ease, background 0.15s ease',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            {loading ? 'Connecting to Google...' : 'Continue with Google'}
          </button>
          <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textAlign: 'center', lineHeight: 1.5 }}>
            By continuing, your user profile and portfolio database will be securely created under your Google account.
          </p>
        </div>
      )}

      {/* Tab 2: Email & Password */}
      {tab === 'email' && (
        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(0, 0, 0, 0.4)',
                color: '#fff',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(0, 0, 0, 0.4)',
                color: '#fff',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 10,
              border: 'none',
              background: '#6366f1',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 6,
            }}
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#9ca3af' }}>
            {mode === 'login' ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Sign Up
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Log In
                </button>
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
