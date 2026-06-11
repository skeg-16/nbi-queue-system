-- ==============================================================================
-- NBI QMS: SCHEMA FINALIZATION & QUALITY CHECKS
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard -> SQL Editor
-- 2. Create a new query, paste this entire file
-- 3. Click "Run"
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CLEANUP ORPHANED OR INVALID ROWS
-- ------------------------------------------------------------------------------
-- Delete rows with completely empty full names or missing ccd_no (which breaks the queue)
DELETE FROM public.registrations
WHERE full_name IS NULL OR TRIM(full_name) = '' OR ccd_no IS NULL OR TRIM(ccd_no) = '';

-- ------------------------------------------------------------------------------
-- 2. SCHEMA CONSTRAINTS (NOT NULL)
-- ------------------------------------------------------------------------------
-- Ensure that required fields never receive NULL values again.
ALTER TABLE public.registrations ALTER COLUMN ccd_no SET NOT NULL;
ALTER TABLE public.registrations ALTER COLUMN full_name SET NOT NULL;
ALTER TABLE public.registrations ALTER COLUMN age SET NOT NULL;
ALTER TABLE public.registrations ALTER COLUMN status SET NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. UNIQUE CONSTRAINTS (Prevent Duplicates)
-- ------------------------------------------------------------------------------
-- Ensure ccd_no is perfectly unique to prevent queue collisions.
-- NOTE: If this fails to run, you have duplicate ccd_no's in your database right now.
-- You will need to delete the duplicates before this line succeeds.
ALTER TABLE public.registrations ADD CONSTRAINT ccd_no_unique UNIQUE (ccd_no);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) FIXES
-- ------------------------------------------------------------------------------
-- This is critical to ensure that Node.js socket operations (Skip, Serve Now)
-- do not silently fail when updating the database.

-- Drop the old overly restrictive policies if they exist (ignore errors if they don't)
DROP POLICY IF EXISTS "Allow All Operations" ON public.registrations;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.registrations;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.registrations;

-- Create an absolute bypass for the Node server. Since the server runs as 'anon' 
-- via the SUPABASE_KEY, we must allow anon to UPDATE and DELETE for the queue to work.
CREATE POLICY "Allow All Operations" 
ON public.registrations 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Ensure RLS is enabled but managed by the policy above.
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
-- Add indexes to speed up the queue "next" queries which sort by created_at and filter by status
CREATE INDEX IF NOT EXISTS idx_registrations_status_created_at ON public.registrations(status, created_at);
CREATE INDEX IF NOT EXISTS idx_registrations_ccd_no ON public.registrations(ccd_no);

-- ==============================================================================
-- DONE!
-- ==============================================================================
