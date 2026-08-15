/**
 * supabaseClient.ts
 * Supabase Auth & Database Client for Artha Tech Copilot
 */
import { createClient, User, Session } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mqawiszqrwipjczqogpr.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xYXdpc3pxcndpcGpjenFvZ3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUyOTYsImV4cCI6MjEwMjMxMTI5Nn0.hOGIS-UP8L-YBmsssiXnII-HrJvUwKNSTu9Zua5rIlY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Types ─────────────────────────────────────────────────────────────────────
export interface UserPortfolio {
  user_id: string;
  cash_balance: number;
  holdings_json: any[];
  positions_json: any[];
  paper_trades_json: any[];
  updated_at?: string;
}

export interface UserBrokerCredentials {
  user_id: string;
  broker_name: 'ANGELONE' | 'ZERODHA' | 'UPSTOX' | 'DHAN' | 'FYERS' | 'PAPER';
  credentials_json: Record<string, string>;
  trading_mode: 'PAPER' | 'LIVE';
  is_active?: boolean;
  updated_at?: string;
}

// ── Auth Helpers ──────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, pass: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
  });
  if (error) throw error;
  return data;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ── Portfolio Storage Helpers ──────────────────────────────────────────────────
export async function fetchUserPortfolio(userId: string): Promise<UserPortfolio | null> {
  try {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('[Supabase] Error fetching portfolio:', error.message);
    }
    return data || null;
  } catch (err) {
    console.error('[Supabase] Exception fetching portfolio:', err);
    return null;
  }
}

export async function saveUserPortfolio(portfolio: UserPortfolio): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('portfolios')
      .upsert({
        ...portfolio,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('[Supabase] Save portfolio failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Exception saving portfolio:', err);
    return false;
  }
}

// ── Broker Credentials Storage Helpers ─────────────────────────────────────────
export async function fetchUserBrokerCredentials(userId: string): Promise<UserBrokerCredentials | null> {
  try {
    const { data, error } = await supabase
      .from('broker_credentials')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('[Supabase] Error fetching broker credentials:', error.message);
    }
    return data || null;
  } catch (err) {
    console.error('[Supabase] Exception fetching broker credentials:', err);
    return null;
  }
}

export async function saveUserBrokerCredentials(credentials: UserBrokerCredentials): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('broker_credentials')
      .upsert({
        ...credentials,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('[Supabase] Save broker credentials failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Exception saving broker credentials:', err);
    return false;
  }
}
