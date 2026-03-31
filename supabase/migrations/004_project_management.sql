-- ============================================================
-- Call Stream AI - Project Management
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Milestones for onboarding projects
CREATE TABLE project_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','in_progress','complete','skipped'
  )),
  target_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_milestones_job ON project_milestones(job_id);

-- Tasks assigned to users
CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES project_milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN (
    'todo','in_progress','done','cancelled'
  )),
  priority TEXT DEFAULT 'medium' CHECK (priority IN (
    'low','medium','high','urgent'
  )),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_job ON project_tasks(job_id);
CREATE INDEX idx_tasks_assigned ON project_tasks(assigned_to);
CREATE INDEX idx_tasks_milestone ON project_tasks(milestone_id);

-- Comments with @mentions
CREATE TABLE project_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  mentions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_job ON project_comments(job_id);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'mention','task_assigned','task_due','milestone_complete','comment','system'
  )),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;

-- ============================================================
-- 2. RLS
-- ============================================================

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Milestones: admins full access, clients see own jobs
CREATE POLICY "Service role milestones" ON project_milestones FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "Admin milestones" ON project_milestones FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Client milestones" ON project_milestones FOR SELECT
  USING (job_id IN (SELECT id FROM onboarding_jobs WHERE created_by = auth.uid()));

-- Tasks: admins full access, clients see own + assigned
CREATE POLICY "Service role tasks" ON project_tasks FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "Admin tasks" ON project_tasks FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Client own tasks" ON project_tasks FOR ALL
  USING (assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Client job tasks" ON project_tasks FOR SELECT
  USING (job_id IN (SELECT id FROM onboarding_jobs WHERE created_by = auth.uid()));

-- Comments: admins full, clients see own jobs
CREATE POLICY "Service role comments" ON project_comments FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "Admin comments" ON project_comments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Client comments" ON project_comments FOR ALL
  USING (job_id IN (SELECT id FROM onboarding_jobs WHERE created_by = auth.uid()));

-- Notifications: users see only their own
CREATE POLICY "Service role notifications" ON notifications FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "Own notifications" ON notifications FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- 3. TRIGGERS
-- ============================================================

CREATE TRIGGER trigger_tasks_updated_at
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_comments_updated_at
  BEFORE UPDATE ON project_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
