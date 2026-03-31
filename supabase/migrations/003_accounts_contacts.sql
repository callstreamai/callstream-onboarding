-- ============================================================
-- Call Stream AI - Accounts & Contacts
-- ============================================================

-- Accounts (one per property/business)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  property_url TEXT,
  vertical TEXT CHECK (vertical IN (
    'hotel','resort','restaurant','venue','casino','stadium',
    'travel','rental','rideshare','spa','event_space','luxury'
  )),
  channels JSONB DEFAULT '["voice","sms","webchat","whatsapp"]',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access accounts"
  ON accounts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Clients see own account"
  ON accounts FOR SELECT
  USING (
    id IN (SELECT account_id FROM account_users WHERE user_id = auth.uid())
  );

-- Contacts (multiple per account)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access contacts"
  ON contacts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Clients see own account contacts"
  ON contacts FOR SELECT
  USING (
    account_id IN (SELECT account_id FROM account_users WHERE user_id = auth.uid())
  );

CREATE INDEX idx_contacts_account ON contacts(account_id);

-- Link users to accounts (a user belongs to one account, an account can have many users)
CREATE TABLE account_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, user_id)
);

ALTER TABLE account_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access account_users"
  ON account_users FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users see own links"
  ON account_users FOR SELECT
  USING (user_id = auth.uid());

-- Link onboarding_jobs to accounts
ALTER TABLE onboarding_jobs ADD COLUMN account_id UUID REFERENCES accounts(id);
CREATE INDEX idx_jobs_account ON onboarding_jobs(account_id);

-- Triggers
CREATE TRIGGER trigger_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
