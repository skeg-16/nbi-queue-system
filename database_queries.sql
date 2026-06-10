-- ==============================================================================
-- NBI QMS: DIRECT DATABASE QUERIES & RLS FIX
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard -> SQL Editor
-- 2. Create a new query, paste this entire file (or just the parts you need)
-- 3. Click "Run"
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- FIX 1: FIX THE UI DELETE BUTTON (Row Level Security Fix)
-- ------------------------------------------------------------------------------
-- If clicking the "Delete" button in the app acts like it worked but the record
-- still shows up, Supabase's Row Level Security (RLS) is silently blocking it.
-- Running this will permanently fix the Delete button in the frontend:

-- Allow all operations (Insert, Select, Update, DELETE) for anon/public users
-- (Since this is an internal dashboard, we allow the server to manage it freely)
CREATE POLICY "Allow All Operations" 
ON public.registrations 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Alternatively, if you just want to turn off RLS entirely:
ALTER TABLE public.registrations DISABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- FIX 2: MANUAL DELETE QUERIES (Direct Database Manipulation)
-- ------------------------------------------------------------------------------
-- If you just want to manually delete a specific record directly from the database:

-- Option A: Delete by exact CCD Number
DELETE FROM public.registrations 
WHERE ccd_no = 'CCD-2026-06-09-0005';

-- Option B: Delete by exact Full Name
DELETE FROM public.registrations 
WHERE full_name = 'John Doe';

-- Option C: Delete all records for a specific date (e.g., today)
DELETE FROM public.registrations 
WHERE ccd_no LIKE 'CCD-2026-06-09-%';

-- Option D: Delete everything (WIPE ENTIRE DATABASE)
TRUNCATE TABLE public.registrations;


-- ------------------------------------------------------------------------------
-- FIX 3: VERIFY YOUR DATA
-- ------------------------------------------------------------------------------
-- Run this to quickly see all records currently sitting in your database:
SELECT id, ccd_no, full_name, status, created_at 
FROM public.registrations 
ORDER BY created_at DESC;
