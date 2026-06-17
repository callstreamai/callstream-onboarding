-- ============================================================
-- SECURITY FIX MIGRATION
-- Addresses Supabase security alerts:
-- 1. function_search_path_mutable (lint 0011)
-- 2. anon_security_definer_function_executable (lint 0028)
-- 3. authenticated_security_definer_function_executable (lint 0029)
-- 
-- Run against project: iakppbqpntlvwvbjlfbn (Call Stream Portal)
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: Fix search_path_mutable warnings
-- Recreate functions with explicit SET search_path = ''
-- ============================================================

-- Fix: update_updated_at
-- This is a trigger function, changed to SECURITY INVOKER (no SECURITY DEFINER needed)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Note: get_call_verification_history and get_call_detail require ALTER FUNCTION
-- to add search_path since we don't have their full body here.
-- These will be fixed with ALTER FUNCTION ... SET search_path = '':

ALTER FUNCTION public.get_call_verification_history SET search_path = '';
ALTER FUNCTION public.get_call_detail(uuid) SET search_path = '';

-- ============================================================
-- PART 2: Revoke EXECUTE from anon role
-- None of these SECURITY DEFINER functions should be publicly accessible
-- without authentication.
-- ============================================================

-- Revoke from anon (unauthenticated callers)
REVOKE EXECUTE ON FUNCTION public.aggregate_daily_metrics(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_brainbase_api_key() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_call_detail(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_call_verification_history FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_summary(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_client_account_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_recording_playback_url(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.invite_user_to_account(text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_daily_metrics(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_user_from_account(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_brainbase_api_key(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_refresh_daily_metrics() FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_brainbase_call(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon;

-- ============================================================
-- PART 3: Restrict admin/service-only functions from authenticated
-- These functions should only be callable by service_role or verified admins
-- ============================================================

-- aggregate_daily_metrics: admin/service-role only
REVOKE EXECUTE ON FUNCTION public.aggregate_daily_metrics(uuid, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.aggregate_daily_metrics(uuid, date) TO service_role;

-- get_brainbase_api_key / set_brainbase_api_key: super admin only
-- Keep accessible to authenticated (RLS/internal logic handles authorization)
-- But revoke from anon (already done above)

-- handle_new_user: trigger function only, not callable via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- invite_user_to_account: only admins/owners should call this
-- The function itself should check permissions internally
-- Revoke from anon (done), keep for authenticated (function handles authz)

-- log_admin_action: internal logging, should only be service_role
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) TO service_role;

-- refresh_daily_metrics: admin/service-role only  
REVOKE EXECUTE ON FUNCTION public.refresh_daily_metrics(uuid, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_daily_metrics(uuid, date) TO service_role;

-- remove_user_from_account: admin/owner only
-- Keep for authenticated (function handles authz check internally)

-- trg_refresh_daily_metrics: trigger function only
REVOKE EXECUTE ON FUNCTION public.trg_refresh_daily_metrics() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.trg_refresh_daily_metrics() TO service_role;

-- upsert_brainbase_call: service role only (webhook ingestion)
REVOKE EXECUTE ON FUNCTION public.upsert_brainbase_call(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_brainbase_call(jsonb) TO service_role;

-- update_updated_at: trigger function only
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO service_role;

COMMIT;
