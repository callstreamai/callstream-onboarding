-- Preserve published history while allowing one editable draft per source set.
ALTER TABLE public.knowledge_versions
  DROP CONSTRAINT knowledge_versions_job_id_source_hash_key;
CREATE UNIQUE INDEX knowledge_versions_one_draft_per_source
  ON public.knowledge_versions(job_id, source_hash) WHERE status = 'draft';
-- Access remains server-only through authenticated, project-scoped routes.
