-- ==============================================================================
-- Supabase Schema Migration — Artha Tech Copilot
-- Run this script in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Profiles Table (Stores user profile metadata from Google / Email auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Portfolios Table (Isolated user portfolios, cash balance, holdings, paper trades)
CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cash_balance NUMERIC DEFAULT 100000.00 NOT NULL,
  holdings_json JSONB DEFAULT '[]'::jsonb,
  positions_json JSONB DEFAULT '[]'::jsonb,
  paper_trades_json JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Watchlists Table (User-specific watchlists)
CREATE TABLE IF NOT EXISTS public.watchlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default Watchlist',
  symbols_json JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Broker Credentials Table (Per-user saved API keys for Angel One, Zerodha, Upstox, Dhan, Fyers)
CREATE TABLE IF NOT EXISTS public.broker_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  broker_name TEXT NOT NULL DEFAULT 'ANGELONE',
  credentials_json JSONB DEFAULT '{}'::jsonb NOT NULL,
  trading_mode TEXT NOT NULL DEFAULT 'PAPER',
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_credentials ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies ensuring strict per-user data isolation
DROP POLICY IF EXISTS "Users can read and write own profile" ON public.profiles;
CREATE POLICY "Users can read and write own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read and write own portfolio" ON public.portfolios;
CREATE POLICY "Users can read and write own portfolio" ON public.portfolios
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read and write own watchlists" ON public.watchlists;
CREATE POLICY "Users can read and write own watchlists" ON public.watchlists
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read and write own broker credentials" ON public.broker_credentials;
CREATE POLICY "Users can read and write own broker credentials" ON public.broker_credentials
  FOR ALL USING (auth.uid() = user_id);

-- Automatic trigger to create a profile & empty portfolio whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = timezone('utc'::text, now());

  INSERT INTO public.portfolios (user_id, cash_balance, holdings_json, positions_json, paper_trades_json)
  VALUES (NEW.id, 100000.00, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
