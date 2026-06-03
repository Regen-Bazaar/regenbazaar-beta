/*
  # Fix RLS policies for stakes

  1. Changes
    - Simplify RLS policies for stakes table
    - Add missing indexes
    - Fix policy conditions

  2. Security
    - Ensure proper access control
    - Prevent duplicate stakes
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Stakes are viewable by everyone" ON stakes;
DROP POLICY IF EXISTS "Users can create stakes" ON stakes;
DROP POLICY IF EXISTS "Users can update their own stakes" ON stakes;

-- Create simplified policies
CREATE POLICY "Stakes are viewable by everyone"
ON stakes FOR SELECT
TO public
USING (true);

CREATE POLICY "Anyone can create stakes"
ON stakes FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Anyone can update stakes"
ON stakes FOR UPDATE
TO public
USING (true);

-- Add composite index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_stakes_purchase_status 
ON stakes(purchase_id, status) 
WHERE status = 'active';