-- ==============================================================================
-- Hardened Supabase Schema & Security Model for SHEIN Concierge Egypt
-- Project Ref: sxcsgnzkgwctafqxkfdd
-- 
-- Security Model: Zero-Trust Server-Only Access (Bypass RLS via service_role)
-- Direct client/anon PostgREST access to public tables is completely revoked.
-- All table reads and writes occur strictly via the server-side Next.js backend.
-- ==============================================================================

-- 1. Create USERS table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  phone TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 2. Create ORDERS table
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  shipping_address TEXT,
  raw_input TEXT,
  extracted_link TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  items_count INT DEFAULT 0,
  items_subtotal NUMERIC DEFAULT 0,
  dynamic_fee_percent NUMERIC DEFAULT 20,
  dynamic_fee_amount NUMERIC DEFAULT 0,
  shipping_fee NUMERIC DEFAULT 0,
  total_cash NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'EGP',
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  admin_comment TEXT,
  payment JSONB,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create SETTINGS table
CREATE TABLE IF NOT EXISTS public.settings (
  id INT PRIMARY KEY DEFAULT 1,
  dynamic_fee_percent NUMERIC DEFAULT 20,
  flat_shipping_fee NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EGP',
  instapay_address TEXT DEFAULT 'shein.orders@instapay',
  instapay_account_name TEXT DEFAULT 'SHEIN Concierge Egypt',
  vodafone_cash_number TEXT DEFAULT '01098765432',
  support_phone TEXT DEFAULT '+20 109 876 5432',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. HARDENED ROW LEVEL SECURITY (RLS) & PRIVILEGE MODEL
-- ==============================================================================

-- A. Remove legacy permissive public policies
DROP POLICY IF EXISTS "Public access users" ON public.users;
DROP POLICY IF EXISTS "Public access orders" ON public.orders;
DROP POLICY IF EXISTS "Public access settings" ON public.settings;

-- B. Strictly enforce Row Level Security (RLS) on all public tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- C. Revoke ALL table permissions from untrusted roles (anon, authenticated, public)
-- This blocks any direct REST/GraphQL queries using the public ANON key.
REVOKE ALL ON TABLE public.users FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.orders FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.settings FROM anon, authenticated, public;

-- D. Grant minimum necessary DML privileges exclusively to the backend service_role
-- Least-privilege model: only SELECT, INSERT, UPDATE, DELETE needed by the server.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.settings TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 5. Insert default admin user if not exists (using bcrypt hash)
INSERT INTO public.users (id, name, email, password, role, phone, created_at)
VALUES (
  'user-admin',
  'Admin Supervisor',
  'admin@sheinextract.com',
  '$2b$10$XdSsrm.koBl9/5KrNmz5MudI1TlJ9ev8fgC9mx6XAjgVFRtmV61Be',
  'admin',
  '+20 100 000 0000',
  NOW()
) ON CONFLICT (email) DO NOTHING;
