-- ============================================================
-- Call Stream AI - Onboarding Platform Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Onboarding Jobs
-- ============================================================
CREATE TABLE onboarding_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_url TEXT NOT NULL,
  vertical TEXT CHECK (vertical IN (
    'hotel','resort','restaurant','venue','casino','stadium',
    'travel','rental','rideshare','spa','event_space','luxury'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','consent_given','crawling','crawl_complete',
    'uploading','upload_complete','extracting','extraction_complete',
    'review_pending','review_in_progress','approved','rejected','error'
  )),
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMPTZ,

  -- Crawl stats
  pages_found INTEGER DEFAULT 0,
  pages_crawled INTEGER DEFAULT 0,
  pages_failed INTEGER DEFAULT 0,

  -- File stats
  files_uploaded INTEGER DEFAULT 0,
  files_processed INTEGER DEFAULT 0,

  -- Extraction
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN (
    'pending','running','complete','failed'
  )),
  extraction_confidence REAL,

  -- Review
  fields_total INTEGER DEFAULT 0,
  fields_reviewed INTEGER DEFAULT 0,
  fields_accepted INTEGER DEFAULT 0,
  fields_edited INTEGER DEFAULT 0,
  fields_rejected INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================
-- Crawled Pages
-- ============================================================
CREATE TABLE crawled_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  content_text TEXT,
  content_html TEXT,
  page_type TEXT, -- amenities, floor_plans, pricing, faq, contact, policies, neighborhood
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','fetched','failed','js_fallback'
  )),
  fetch_method TEXT DEFAULT 'http' CHECK (fetch_method IN ('http','playwright')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crawled_pages_job ON crawled_pages(job_id);

-- ============================================================
-- Uploaded Files
-- ============================================================
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  metadata JSONB DEFAULT '{}',
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN (
    'pending','processing','complete','failed'
  )),
  source_provenance TEXT DEFAULT 'upload',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_uploaded_files_job ON uploaded_files(job_id);

-- ============================================================
-- Property Data (extracted)
-- ============================================================
CREATE TABLE property_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,

  -- Basic Info
  property_name TEXT,
  vertical TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  management_company TEXT,

  -- Units & Pricing (JSONB arrays)
  unit_types JSONB DEFAULT '[]',
  pricing_ranges JSONB DEFAULT '[]',
  specials_promotions JSONB DEFAULT '[]',

  -- Amenities & Policies
  amenities JSONB DEFAULT '[]',
  pet_policy TEXT,
  parking TEXT,
  fees_deposits JSONB DEFAULT '[]',
  lease_terms JSONB DEFAULT '[]',

  -- Operations
  office_hours TEXT,
  application_requirements JSONB DEFAULT '[]',
  neighborhood_highlights JSONB DEFAULT '[]',

  -- Channels
  channels JSONB DEFAULT '["voice","sms","webchat","whatsapp"]',

  -- Provenance
  source_urls JSONB DEFAULT '[]',
  source_files JSONB DEFAULT '[]',
  confidence_score REAL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_property_data_job ON property_data(job_id);

-- ============================================================
-- Extraction Fields (per-field review tracking)
-- ============================================================
CREATE TABLE extraction_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
  property_data_id UUID REFERENCES property_data(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  extracted_value JSONB,
  confidence REAL DEFAULT 0,
  source_snippets JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','accepted','edited','rejected'
  )),
  edited_value JSONB,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_extraction_fields_job ON extraction_fields(job_id);
CREATE INDEX idx_extraction_fields_status ON extraction_fields(status);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE onboarding_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawled_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_fields ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can manage their own jobs
CREATE POLICY "Users manage own jobs"
  ON onboarding_jobs FOR ALL
  USING (auth.uid() = created_by);

CREATE POLICY "Users see own crawled pages"
  ON crawled_pages FOR ALL
  USING (job_id IN (SELECT id FROM onboarding_jobs WHERE created_by = auth.uid()));

CREATE POLICY "Users see own uploaded files"
  ON uploaded_files FOR ALL
  USING (job_id IN (SELECT id FROM onboarding_jobs WHERE created_by = auth.uid()));

CREATE POLICY "Users see own property data"
  ON property_data FOR ALL
  USING (job_id IN (SELECT id FROM onboarding_jobs WHERE created_by = auth.uid()));

CREATE POLICY "Users see own extraction fields"
  ON extraction_fields FOR ALL
  USING (job_id IN (SELECT id FROM onboarding_jobs WHERE created_by = auth.uid()));

-- Service role bypass for API routes
CREATE POLICY "Service role full access jobs"
  ON onboarding_jobs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access pages"
  ON crawled_pages FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access files"
  ON uploaded_files FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access property"
  ON property_data FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access fields"
  ON extraction_fields FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Storage Bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('onboarding-files', 'onboarding-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy
CREATE POLICY "Authenticated users upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'onboarding-files'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'onboarding-files'
    AND auth.role() = 'authenticated'
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_jobs_updated_at
  BEFORE UPDATE ON onboarding_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_property_data_updated_at
  BEFORE UPDATE ON property_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
