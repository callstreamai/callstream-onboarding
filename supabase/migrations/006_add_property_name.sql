-- Add property_name column to onboarding_jobs
ALTER TABLE onboarding_jobs ADD COLUMN IF NOT EXISTS property_name TEXT;
