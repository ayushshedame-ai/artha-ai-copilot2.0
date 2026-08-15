/**
 * AuthGate.tsx  — Robust Supabase Auth Integration
 *
 * Prevents OAuth callback flickers, handles URL token hash parsing,
 * and seamlessly transitions after Google OAuth sign-in.
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
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
    let mounted = true;

    // Check if returning from OAuth redirect (has hash or query code/access_token)
    const hasAuthParams =
      window.location.hash.includes('access_token=') ||
      window.location.hash.includes('error=') ||
      window.location.search.includes('code=');

    // Subscribe to auth state changes FIRST (handles hash/PKCE parsing automatically)
    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setAuthenticated(true);
        // Clean URL hash/query after successful OAuth callback
        if (hasAuthParams) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else if (event === 'SIGNED_OUT' || (!hasAuthParams && event === 'INITIAL_SESSION')) {
        setAuthenticated(false);
      }

      setLoading(false);
    });

    // Fallback safety timeout if Supabase takes too long
    const timeoutId = setTimeout(() => {
      if (mounted && loading) {
        supabase.auth.getSession().then(({ data }) => {
          if (!mounted) return;
          if (data.session?.user) {
            setAuthenticated(true);
          } else {
            setAuthenticated(false);
          }
          setLoading(false);
        });
      }
    }, hasAuthParams ? 2500 : 800);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      authSubscription.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div style={OVERLAY}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>⚡</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#a78bfa', letterSpacing: '-0.3px' }}>
            Signing in to Artha Tech...
          </div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>
            Verifying your secure credentials
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
