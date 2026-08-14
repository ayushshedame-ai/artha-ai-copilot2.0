/**
 * AuthGate.tsx  — Supabase Auth Integration
 *
 * Checks for an active Supabase user session (Google OAuth / Email).
 * Renders SupabaseAuthModal when unauthenticated.
 */
import React, { useState, useEffect } from 'react';
import { supabase, getSession } from '../services/supabaseClient';
import SupabaseAuthModal from './SupabaseAuthModal';

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'linear-gradient(135deg, #04080f 0%, #0b0620 50%, #04080f 100%)',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  padding: 20,
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
};

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // 1. Initial session check
    getSession().then((session) => {
      if (session?.user) {
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
      }
      setLoading(false);
    });

    // 2. Listen for auth changes (Google OAuth callback, sign in, sign out)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div style={OVERLAY}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#a78bfa' }}>
            Authenticating with Artha Tech...
          </div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div style={OVERLAY}>
        <SupabaseAuthModal onSuccess={() => setAuthenticated(true)} />
      </div>
    );
  }

  return <>{children}</>;
}
