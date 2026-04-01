ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES project_milestones(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_milestones_parent ON project_milestones(parent_id);
