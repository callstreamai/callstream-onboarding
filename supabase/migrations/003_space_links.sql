-- Create space_links table for storing URL bookmarks per space
CREATE TABLE IF NOT EXISTS public.space_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    job_id UUID NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_space_links_space_id ON public.space_links(space_id);
ALTER TABLE public.space_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "space_links_all" ON public.space_links;
CREATE POLICY "space_links_all" ON public.space_links FOR ALL USING (true) WITH CHECK (true);
