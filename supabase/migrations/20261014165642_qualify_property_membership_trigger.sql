CREATE OR REPLACE FUNCTION public.auto_assign_job_to_account_users()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.project_members(job_id,user_id,role,created_at)
 SELECT NEW.id,au.user_id,'member',now() FROM public.account_users au
 WHERE au.account_id=NEW.account_id ON CONFLICT DO NOTHING;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.auto_assign_job_to_account_users() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.auto_assign_job_to_account_users() TO service_role;
