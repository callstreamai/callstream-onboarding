-- Internal workflow state is server-only. Client access goes through project-scoped APIs.
CREATE TABLE public.property_operations (
  job_id uuid PRIMARY KEY REFERENCES public.onboarding_jobs(id) ON DELETE CASCADE,
  token uuid,
  kind text,
  locked_until timestamptz,
  completed jsonb NOT NULL DEFAULT '{}',
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id),
  submission_hash text
);
CREATE TABLE public.knowledge_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.onboarding_jobs(id) ON DELETE CASCADE,
  source_hash text NOT NULL,
  source_manifest jsonb NOT NULL,
  qa jsonb NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','publishing','processing','published','failed','uncertain')),
  provider_id text,
  provider_name text,
  error_message text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE(job_id,source_hash)
);
CREATE INDEX knowledge_versions_job_created ON public.knowledge_versions(job_id,created_at DESC);
ALTER TABLE public.property_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_operations,public.knowledge_versions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.property_operations,public.knowledge_versions TO service_role;
-- A client must not be able to promote their own profile to administrator.
REVOKE UPDATE ON public.profiles FROM anon,authenticated;
GRANT UPDATE(full_name,company_name) ON public.profiles TO authenticated;

CREATE FUNCTION public.claim_property_operation(p_job uuid,p_kind text,p_key text,p_force boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE r public.property_operations; t uuid;
BEGIN
  INSERT INTO public.property_operations(job_id) VALUES(p_job) ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM public.property_operations WHERE job_id=p_job FOR UPDATE;
  IF r.token IS NOT NULL AND r.locked_until>now() THEN
    RAISE EXCEPTION 'A property operation is already running' USING ERRCODE='55P03';
  END IF;
  IF NOT p_force AND r.completed->p_kind->>'key'=p_key THEN
    RETURN jsonb_build_object('cached',true,'result',r.completed->p_kind->'result');
  END IF;
  t:=gen_random_uuid();
  UPDATE public.property_operations SET token=t,kind=p_kind,locked_until=now()+interval '30 minutes' WHERE job_id=p_job;
  RETURN jsonb_build_object('token',t,'cached',false);
END $$;
CREATE FUNCTION public.finish_property_operation(p_job uuid,p_token uuid,p_key text,p_result jsonb,p_success boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE r public.property_operations;
BEGIN
 SELECT * INTO r FROM public.property_operations WHERE job_id=p_job FOR UPDATE;
 IF r.token IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'Operation expired'; END IF;
 UPDATE public.property_operations SET
   completed=CASE WHEN p_success THEN jsonb_set(completed,ARRAY[r.kind],jsonb_build_object('key',p_key,'result',p_result,'at',now())) ELSE completed END,
   token=NULL,kind=NULL,locked_until=NULL WHERE job_id=p_job;
END $$;
CREATE FUNCTION public.commit_property_crawl(p_job uuid,p_token uuid,p_pages jsonb,p_key text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE r public.property_operations; n integer;
BEGIN
 SELECT * INTO r FROM public.property_operations WHERE job_id=p_job FOR UPDATE;
 IF r.token IS DISTINCT FROM p_token OR r.kind<>'crawl' THEN RAISE EXCEPTION 'Operation expired'; END IF;
 -- A rescrape replaces the current source set atomically; failed crawls never enter here.
 DELETE FROM public.crawled_pages WHERE job_id=p_job;
 INSERT INTO public.crawled_pages(job_id,url,title,content_text,page_type,status,fetch_method,error_message)
 SELECT p_job,x.url,x.title,x.content_text,x.page_type,x.status,x.fetch_method,x.error_message
 FROM jsonb_to_recordset(p_pages) AS x(url text,title text,content_text text,page_type text,status text,fetch_method text,error_message text);
 SELECT count(*) INTO n FROM public.crawled_pages WHERE job_id=p_job AND status='fetched';
 UPDATE public.onboarding_jobs SET status='crawl_complete',extraction_status='pending',pages_found=jsonb_array_length(p_pages),pages_crawled=n,pages_failed=jsonb_array_length(p_pages)-n WHERE id=p_job;
 UPDATE public.project_milestones SET status='complete',completed_at=now() WHERE job_id=p_job AND name='Website review';
 PERFORM public.finish_property_operation(p_job,p_token,p_key,jsonb_build_object('pagesCrawled',n),true);
END $$;
CREATE FUNCTION public.commit_property_extraction(p_job uuid,p_token uuid,p_key text,p_data jsonb,p_fields jsonb,p_result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE r public.property_operations; property_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO r FROM public.property_operations WHERE job_id=p_job FOR UPDATE;
 IF r.token IS DISTINCT FROM p_token OR r.kind<>'extract' THEN RAISE EXCEPTION 'Operation expired'; END IF;
 -- Replace both review tables in one transaction; an insert failure preserves the prior extraction.
 DELETE FROM public.extraction_fields WHERE job_id=p_job;
 DELETE FROM public.property_data WHERE job_id=p_job;
 INSERT INTO public.property_data SELECT * FROM jsonb_populate_record(NULL::public.property_data,p_data || jsonb_build_object('id',property_id,'job_id',p_job,'created_at',now(),'updated_at',now()));
 INSERT INTO public.extraction_fields(job_id,property_data_id,field_name,extracted_value,confidence,source_snippets,status)
 SELECT p_job,property_id,x.field_name,x.extracted_value,x.confidence,x.source_snippets,'pending'
 FROM jsonb_to_recordset(p_fields) AS x(field_name text,extracted_value jsonb,confidence real,source_snippets jsonb);
 UPDATE public.onboarding_jobs SET status='extraction_complete',extraction_status='complete',extraction_confidence=(p_result->>'confidence')::real,fields_total=jsonb_array_length(p_fields),fields_reviewed=0,fields_accepted=0,fields_edited=0,fields_rejected=0 WHERE id=p_job;
 PERFORM public.finish_property_operation(p_job,p_token,p_key,p_result,true);
END $$;
CREATE FUNCTION public.initialize_property_folders(p_job uuid,p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 PERFORM 1 FROM public.onboarding_jobs WHERE id=p_job FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.spaces WHERE job_id=p_job) THEN
 INSERT INTO public.spaces(job_id,name,description,icon,sort_order,created_by) VALUES
 (p_job,'Front Desk','Guest services, arrival information, and phone scripts','building',0,p_actor),
 (p_job,'Housekeeping','Room care, service schedules, and guest requests','home',1,p_actor),
 (p_job,'Food & Beverage','Menus, dining hours, and room service','utensils',2,p_actor),
 (p_job,'Reservations','Booking policies, packages, and group inquiries','calendar',3,p_actor),
 (p_job,'Facilities','Amenities, accessibility, and property maps','settings',4,p_actor),
 (p_job,'Policies','Parking, pets, cancellations, and property policies','file-text',5,p_actor),
 (p_job,'Training','Guest-facing guidance and approved answers','book',6,p_actor),
 (p_job,'Marketing','Brochures and brand guidelines','megaphone',7,p_actor),
 (p_job,'Event Calendar','Event schedules and programming','calendar',8,p_actor);
 END IF;
END $$;
CREATE FUNCTION public.create_managed_property(p_id uuid,p_actor uuid,p_url text,p_name text,p_account uuid DEFAULT NULL,p_vertical text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE r public.onboarding_jobs;
BEGIN
 INSERT INTO public.onboarding_jobs(id,created_by,property_url,property_name,account_id,vertical,status,consent_given)
 VALUES(p_id,p_actor,p_url,p_name,p_account,p_vertical,'pending',false) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO r FROM public.onboarding_jobs WHERE id=p_id FOR UPDATE;
 IF r.created_by IS DISTINCT FROM p_actor OR r.property_url IS DISTINCT FROM p_url OR r.property_name IS DISTINCT FROM p_name OR r.account_id IS DISTINCT FROM p_account THEN RAISE EXCEPTION 'Request identifier already used'; END IF;
 PERFORM public.initialize_property_folders(p_id,p_actor);
 IF NOT EXISTS(SELECT 1 FROM public.project_milestones WHERE job_id=p_id) THEN
 INSERT INTO public.project_milestones(job_id,name,description,sort_order,status) VALUES
 (p_id,'Property created','Your shared property workspace is ready',0,'complete'),
 (p_id,'Website review','Public website information collected',1,'pending'),
 (p_id,'Files submitted','Property documents submitted for team review',2,'pending'),
 (p_id,'Knowledge review','Questions and answers prepared and reviewed',3,'pending'),
 (p_id,'Voice & testing','Voice selection and agent testing',4,'pending'),
 (p_id,'Launch','Your team confirms the agent is ready',5,'pending');
 END IF;
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_property_operation(uuid,text,text,boolean),public.finish_property_operation(uuid,uuid,text,jsonb,boolean),public.commit_property_crawl(uuid,uuid,jsonb,text),public.commit_property_extraction(uuid,uuid,text,jsonb,jsonb,jsonb),public.initialize_property_folders(uuid,uuid),public.create_managed_property(uuid,uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_property_operation(uuid,text,text,boolean),public.finish_property_operation(uuid,uuid,text,jsonb,boolean),public.commit_property_crawl(uuid,uuid,jsonb,text),public.commit_property_extraction(uuid,uuid,text,jsonb,jsonb,jsonb),public.initialize_property_folders(uuid,uuid),public.create_managed_property(uuid,uuid,text,text,uuid,text) TO service_role;

-- Save one model section at a time; browser retries resume the same build.
CREATE TABLE public.knowledge_builds (
 job_id uuid NOT NULL REFERENCES public.onboarding_jobs(id) ON DELETE CASCADE,
 source_hash text NOT NULL,
 chunks jsonb NOT NULL,
 cursor integer NOT NULL DEFAULT 0,
 qa jsonb NOT NULL DEFAULT '[]',
 warnings jsonb NOT NULL DEFAULT '[]',
 PRIMARY KEY(job_id,source_hash)
);
ALTER TABLE public.knowledge_builds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.knowledge_builds FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.knowledge_builds TO service_role;
CREATE OR REPLACE FUNCTION public.submit_property_files(p_job uuid,p_actor uuid,p_hash text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 INSERT INTO public.property_operations(job_id,submitted_at,submitted_by,submission_hash)
 VALUES(p_job,now(),p_actor,p_hash)
 ON CONFLICT(job_id) DO UPDATE SET submitted_at=EXCLUDED.submitted_at,submitted_by=EXCLUDED.submitted_by,submission_hash=EXCLUDED.submission_hash;
 UPDATE public.project_milestones SET status='complete',completed_at=now() WHERE job_id=p_job AND name='Files submitted';
END; $$;
REVOKE ALL ON FUNCTION public.submit_property_files(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_property_files(uuid,uuid,text) TO service_role;

-- Mutations use authenticated, project-scoped server routes so clients cannot forge file paths or change ownership.
REVOKE INSERT,UPDATE,DELETE ON public.onboarding_jobs,public.spaces,public.space_documents,public.space_links,public.uploaded_files,public.crawled_pages,public.property_data,public.extraction_fields FROM PUBLIC,anon,authenticated;
