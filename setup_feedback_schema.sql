-- ==============================================================================
-- NBI QMS: DIGITAL FEEDBACK FORM SCHEMA SETUP
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard -> SQL Editor
-- 2. Create a new query, paste this entire file
-- 3. Click "Run"
-- ==============================================================================

-- Create the feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ccd_no TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    language TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    service_quality TEXT,
    staff_behavior TEXT,
    wait_time TEXT,
    recommendation TEXT,
    suggestions TEXT,
    complaints TEXT,
    follow_up BOOLEAN DEFAULT FALSE,
    contact_for_followup TEXT,
    -- Strictly enforce that if follow_up is true and a contact is provided, it must be exactly 11 digits starting with '09'
    CONSTRAINT chk_contact_format CHECK (
        contact_for_followup IS NULL OR 
        contact_for_followup = '' OR 
        contact_for_followup ~ '^09[0-9]{9}$'
    )
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if running multiple times
DROP POLICY IF EXISTS "Allow All Operations on Feedback" ON public.feedback;

-- Create an absolute bypass for the Node server (using anon key)
CREATE POLICY "Allow All Operations on Feedback" 
ON public.feedback 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add indexes for common queries (e.g., dashboard stats)
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON public.feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_submitted_at ON public.feedback(submitted_at);

-- ==============================================================================
-- DONE!
-- ==============================================================================
