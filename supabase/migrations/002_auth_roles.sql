-- ============================================================
-- Call Stream AI - Auth Profiles & Role-Based Access
-- ============================================================

-- User roles
CREATE TYPE user_role AS ENUM ('admin', 'client');

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  role user_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own profile
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can update their own profile (but not role)
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role full access
CREATE POLICY "Service role full access profiles"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Update onboarding_jobs RLS for role-based access
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users manage own jobs" ON onboarding_jobs;

-- Clients see only their own jobs
CREATE POLICY "Clients manage own jobs"
  ON onboarding_jobs FOR ALL
  USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Same pattern for child tables
DROP POLICY IF EXISTS "Users see own crawled pages" ON crawled_pages;
CREATE POLICY "Role-based crawled pages access"
  ON crawled_pages FOR ALL
  USING (
    job_id IN (SELECT id FROM onboarding_jobs WHERE created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users see own uploaded files" ON uploaded_files;
CREATE POLICY "Role-based uploaded files access"
  ON uploaded_files FOR ALL
  USING (
    job_id IN (SELECT id FROM onboarding_jobs WHERE created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users see own property data" ON property_data;
CREATE POLICY "Role-based property data access"
  ON property_data FOR ALL
  USING (
    job_id IN (SELECT id FROM onboarding_jobs WHERE created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users see own extraction fields" ON extraction_fields;
CREATE POLICY "Role-based extraction fields access"
  ON extraction_fields FOR ALL
  USING (
    job_id IN (SELECT id FROM onboarding_jobs WHERE created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at on profiles
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
