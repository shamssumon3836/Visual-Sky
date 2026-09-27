-- ==============================================================================
-- VisualSky Platform: Supabase Cross-Device Workspace Persistence Schema
-- Run this in your Supabase Project's SQL Editor (Dashboard -> SQL Editor -> New query)
-- ==============================================================================

-- 1. Create the user_workspaces table
CREATE TABLE IF NOT EXISTS public.user_workspaces (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create index on email for quick lookup across devices
CREATE INDEX IF NOT EXISTS idx_user_workspaces_email ON public.user_workspaces (LOWER(email));

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_workspaces ENABLE ROW LEVEL SECURITY;

-- 4. Set permissive access policies for instant cross-device synchronization
DROP POLICY IF EXISTS "Allow public select workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Allow public insert workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Allow public update workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Allow public delete workspace" ON public.user_workspaces;

CREATE POLICY "Allow public select workspace" 
ON public.user_workspaces 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert workspace" 
ON public.user_workspaces 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update workspace" 
ON public.user_workspaces 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow public delete workspace" 
ON public.user_workspaces 
FOR DELETE 
USING (true);
