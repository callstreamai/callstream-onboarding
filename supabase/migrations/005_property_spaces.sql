-- ============================================================
-- Call Stream AI - Property Spaces & Knowledge Base
-- ============================================================

-- Spaces: organizational containers within a project
CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spaces_job ON spaces(job_id);

-- Space documents: files within a space
CREATE TABLE space_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  extracted_text TEXT,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN (
    'pending','processing','complete','failed'
  )),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_space_docs_space ON space_documents(space_id);
CREATE INDEX idx_space_docs_job ON space_documents(job_id);

-- Project invitations
CREATE TABLE project_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  invited_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invitations_job ON project_invitations(job_id);
CREATE INDEX idx_invitations_email ON project_invitations(email);
CREATE INDEX idx_invitations_token ON project_invitations(token);

-- Project members (who has access to which project)
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, user_id)
);

CREATE INDEX idx_members_job ON project_members(job_id);
CREATE INDEX idx_members_user ON project_members(user_id);

-- RLS
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service spaces" ON spaces FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service space_docs" ON space_documents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service invitations" ON project_invitations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service members" ON project_members FOR ALL USING (auth.role() = 'service_role');

-- Members can access their project's spaces and docs
CREATE POLICY "Member spaces" ON spaces FOR ALL
  USING (job_id IN (SELECT job_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY "Member space_docs" ON space_documents FOR ALL
  USING (job_id IN (SELECT job_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY "Member invitations read" ON project_invitations FOR SELECT
  USING (job_id IN (SELECT job_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY "Own membership" ON project_members FOR SELECT
  USING (user_id = auth.uid());

-- Triggers
CREATE TRIGGER trigger_spaces_updated ON spaces
  BEFORE UPDATE FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_space_docs_updated ON space_documents
  BEFORE UPDATE FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Default spaces for new projects
-- (Created programmatically when a project is initialized)
