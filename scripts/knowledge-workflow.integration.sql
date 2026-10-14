BEGIN;
DO $$
DECLARE actor uuid; j uuid:=gen_random_uuid(); operation jsonb; again jsonb; busy boolean:=false;
BEGIN
 SELECT id INTO actor FROM public.profiles WHERE role='admin' LIMIT 1;
 PERFORM public.create_managed_property(j,actor,'https://example.com/','Workflow transaction test');
 PERFORM public.create_managed_property(j,actor,'https://example.com/','Workflow transaction test');
 IF (SELECT count(*) FROM public.spaces WHERE job_id=j)<>9 THEN RAISE EXCEPTION 'Folder initialization not idempotent'; END IF;
 IF (SELECT count(*) FROM public.project_milestones WHERE job_id=j)<>6 THEN RAISE EXCEPTION 'Milestones duplicated'; END IF;
 operation:=public.claim_property_operation(j,'crawl','initial');
 BEGIN PERFORM public.claim_property_operation(j,'crawl','initial'); EXCEPTION WHEN lock_not_available THEN busy:=true; END;
 IF NOT busy THEN RAISE EXCEPTION 'Concurrent operation was allowed'; END IF;
 PERFORM public.submit_property_files(j,actor,'files');
 IF (SELECT token FROM public.property_operations WHERE job_id=j) IS DISTINCT FROM (operation->>'token')::uuid THEN RAISE EXCEPTION 'Submission overwrote active lock'; END IF;
 PERFORM public.commit_property_crawl(j,(operation->>'token')::uuid,'[{"url":"https://example.com/","title":"Test","content_text":"Example property offers breakfast daily.","page_type":"homepage","status":"fetched","fetch_method":"http","error_message":null}]','initial');
 again:=public.claim_property_operation(j,'crawl','initial');
 IF NOT (again->>'cached')::boolean THEN RAISE EXCEPTION 'Retry was not cached'; END IF;
 operation:=public.claim_property_operation(j,'extract','source');
 PERFORM public.commit_property_extraction(j,(operation->>'token')::uuid,'source','{"property_name":"Test"}','[{"field_name":"property_name","extracted_value":"Test","confidence":1,"source_snippets":[]}]','{"confidence":1}');
 operation:=public.claim_property_operation(j,'extract','source2');
 PERFORM public.commit_property_extraction(j,(operation->>'token')::uuid,'source2','{"property_name":"Test 2"}','[{"field_name":"property_name","extracted_value":"Test 2","confidence":1,"source_snippets":[]}]','{"confidence":1}');
 IF (SELECT count(*) FROM public.property_data WHERE job_id=j)<>1 OR (SELECT count(*) FROM public.extraction_fields WHERE job_id=j)<>1 THEN RAISE EXCEPTION 'Extraction duplicated'; END IF;
 IF has_table_privilege('authenticated','public.knowledge_versions','SELECT') OR has_column_privilege('authenticated','public.profiles','role','UPDATE') OR has_function_privilege('authenticated','public.claim_property_operation(uuid,text,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Client privilege exposure'; END IF;
END $$;
SELECT 'Passed: retries, single extraction, folder/milestone initialization, concurrent lock, submission lock preservation, private KB permissions' AS result;
ROLLBACK;
