-- A property has a permanent workspace. Crawls/extractions are activity within it.
CREATE TABLE public.properties (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_job_id uuid NOT NULL UNIQUE REFERENCES public.onboarding_jobs(id) ON DELETE RESTRICT,
 account_id uuid REFERENCES public.accounts(id),
 name text NOT NULL,
 website_url text NOT NULL,
 created_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_jobs ADD COLUMN property_id uuid REFERENCES public.properties(id) ON DELETE RESTRICT;
CREATE INDEX onboarding_jobs_property_id_idx ON public.onboarding_jobs(property_id);
CREATE INDEX properties_account_id_idx ON public.properties(account_id);
CREATE TABLE public.property_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
 job_id uuid NOT NULL REFERENCES public.onboarding_jobs(id) ON DELETE RESTRICT,
 operation_token uuid UNIQUE,
 kind text NOT NULL,
 status text NOT NULL CHECK(status IN ('running','completed','failed','interrupted','needs_review')),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 summary jsonb NOT NULL DEFAULT '{}',
 source_snapshot jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX property_runs_property_time_idx ON public.property_runs(property_id,started_at DESC);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.properties,public.property_runs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.properties,public.property_runs TO service_role;

-- Readable website identifiers; immutable UUIDs continue to protect existing references.
ALTER TABLE public.properties ADD COLUMN property_key text UNIQUE;
CREATE TABLE public.property_aliases (
 key text PRIMARY KEY,
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT
);
ALTER TABLE public.property_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_aliases FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.property_aliases TO service_role;
CREATE FUNCTION public.property_site_key(site text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT regexp_replace(regexp_replace(split_part(split_part(site,'#',1),'?',1),'^https?://(www\.)?','','i'),'/+$','')
$$;
CREATE FUNCTION public.assign_property_key() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE base text; candidate text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.website_url=OLD.website_url THEN RETURN NEW; END IF;
 base:=lower(regexp_replace(replace(public.property_site_key(NEW.website_url),'/','--'),'[^a-zA-Z0-9._-]+','-','g'));
 PERFORM pg_advisory_xact_lock(hashtextextended('property-key:'||base,0));
 candidate:=base;
 IF EXISTS(SELECT 1 FROM public.properties WHERE property_key=candidate AND id<>NEW.id)
 OR EXISTS(SELECT 1 FROM public.property_aliases WHERE key=candidate AND property_id<>NEW.id) THEN candidate:=base||'--'||replace(NEW.id::text,'-',''); END IF;
 IF TG_OP='UPDATE' AND OLD.property_key IS DISTINCT FROM candidate THEN
  INSERT INTO public.property_aliases(key,property_id) VALUES(OLD.property_key,OLD.id) ON CONFLICT DO NOTHING;
 END IF;
 NEW.property_key:=candidate;
 RETURN NEW;
END $$;
CREATE TRIGGER assign_property_key BEFORE INSERT OR UPDATE OF website_url ON public.properties FOR EACH ROW EXECUTE FUNCTION public.assign_property_key();
REVOKE ALL ON FUNCTION public.property_site_key(text),public.assign_property_key() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.property_site_key(text),public.assign_property_key() TO service_role;

-- Merge only exact property identities with the same account, owner, AND membership.
-- Original jobs, folders, documents, comments, permissions, and knowledge remain intact.
DO $$
DECLARE r record; canonical uuid;
BEGIN
 FOR r IN
  SELECT array_agg(j.id ORDER BY
    (SELECT count(*) FROM public.knowledge_versions k WHERE k.job_id=j.id) DESC,
    (SELECT count(*) FROM public.space_documents d WHERE d.job_id=j.id) DESC,
    j.created_at DESC,j.id) ids
  FROM public.onboarding_jobs j
  GROUP BY j.account_id,j.created_by,public.property_site_key(j.property_url),
    (SELECT coalesce(string_agg(m.user_id::text || ':' || m.role,',' ORDER BY m.user_id),'') FROM public.project_members m WHERE m.job_id=j.id)
 LOOP
  canonical:=r.ids[1];
  INSERT INTO public.properties(id,workspace_job_id,account_id,name,website_url,created_by,created_at)
   SELECT id,id,account_id,coalesce(nullif(trim(property_name),''),property_url),property_url,created_by,created_at
   FROM public.onboarding_jobs WHERE id=canonical;
  UPDATE public.onboarding_jobs SET property_id=canonical WHERE id=ANY(r.ids);
 END LOOP;
END $$;
ALTER TABLE public.properties ALTER COLUMN property_key SET NOT NULL;
INSERT INTO public.property_runs(property_id,job_id,kind,status,started_at,finished_at,summary,source_snapshot)
 SELECT j.property_id,j.id,'legacy_import','needs_review',j.created_at,j.updated_at,
 jsonb_build_object('previous_status',j.status,'note','Imported onboarding record; completion has not been verified.'),
 coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.crawled_pages c WHERE c.job_id=j.id),'[]')
 FROM public.onboarding_jobs j;

-- Keep account linkage and property identity consistent when existing admin tools edit a job.
CREATE FUNCTION public.sync_property_identity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.properties SET account_id=NEW.account_id,name=coalesce(nullif(trim(NEW.property_name),''),NEW.property_url),website_url=NEW.property_url
 WHERE workspace_job_id=NEW.id;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_property_identity AFTER UPDATE OF account_id,property_name,property_url ON public.onboarding_jobs
 FOR EACH ROW EXECUTE FUNCTION public.sync_property_identity();

-- Repeated Create requests for an existing identity open its permanent workspace.
-- The advisory lock serializes concurrent requests, even with different request UUIDs.
ALTER FUNCTION public.create_managed_property(uuid,uuid,text,text,uuid,text) RENAME TO create_managed_property_workspace;
CREATE FUNCTION public.create_managed_property(p_id uuid,p_actor uuid,p_url text,p_name text,p_account uuid DEFAULT NULL,p_vertical text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE found_id uuid; identity_key text; normalized_url text;
BEGIN
 normalized_url:=public.property_site_key(p_url);
 identity_key:=coalesce(p_account::text,p_actor::text)||':'||normalized_url;
 PERFORM pg_advisory_xact_lock(hashtextextended(identity_key,0));
 SELECT workspace_job_id INTO found_id FROM public.properties
 WHERE account_id IS NOT DISTINCT FROM p_account
 AND (p_account IS NOT NULL OR created_by=p_actor)
 AND public.property_site_key(website_url)=normalized_url
 ORDER BY created_at LIMIT 1;
 IF found_id IS NOT NULL THEN RETURN found_id; END IF;
 found_id:=public.create_managed_property_workspace(p_id,p_actor,p_url,p_name,p_account,p_vertical);
 INSERT INTO public.properties(id,workspace_job_id,account_id,name,website_url,created_by)
 VALUES(found_id,found_id,p_account,trim(p_name),p_url,p_actor);
 UPDATE public.onboarding_jobs SET property_id=found_id WHERE id=found_id;
 RETURN found_id;
END $$;

-- Record each real processing operation. Cached retries do not create another run.
CREATE FUNCTION public.record_property_run() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE prop uuid; result jsonb;
BEGIN
 SELECT property_id INTO prop FROM public.onboarding_jobs WHERE id=NEW.job_id;
 IF prop IS NULL THEN RETURN NEW; END IF;
 IF NEW.token IS DISTINCT FROM OLD.token AND NEW.token IS NOT NULL AND NEW.kind IN ('crawl','extract') THEN
  UPDATE public.property_runs SET status='interrupted',finished_at=now() WHERE operation_token=OLD.token AND status='running';
  INSERT INTO public.property_runs(property_id,job_id,operation_token,kind,status)
  VALUES(prop,NEW.job_id,NEW.token,NEW.kind,'running');
 ELSIF NEW.token IS NULL AND OLD.token IS NOT NULL AND OLD.kind IN ('crawl','extract') THEN
  result:=NEW.completed->OLD.kind;
  UPDATE public.property_runs SET
   status=CASE WHEN NEW.completed IS DISTINCT FROM OLD.completed THEN 'completed' ELSE 'failed' END,
   finished_at=now(),summary=CASE WHEN NEW.completed IS DISTINCT FROM OLD.completed THEN coalesce(result->'result','{}') ELSE '{"note":"Processing did not complete. Previous sources were retained."}'::jsonb END,
   source_snapshot=coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.crawled_pages c WHERE c.job_id=NEW.job_id),'[]')
  WHERE operation_token=OLD.token;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER record_property_run AFTER UPDATE ON public.property_operations FOR EACH ROW EXECUTE FUNCTION public.record_property_run();
REVOKE ALL ON FUNCTION public.sync_property_identity(),public.record_property_run(),public.create_managed_property(uuid,uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_property_identity(),public.record_property_run(),public.create_managed_property(uuid,uuid,text,text,uuid,text) TO service_role;
