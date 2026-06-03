/*
  # Fix stakes table and queries

  1. Changes
    - Add missing columns to stakes table
    - Fix foreign key constraints
    - Update RLS policies
    - Add proper indexes

  2. Security
    - Enable RLS
    - Add policies for stake management
*/

-- Add missing columns and constraints to stakes table
ALTER TABLE stakes 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS iv_locked numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS apr numeric NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS voting_power numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS lock_end_date timestamptz NOT NULL DEFAULT (now() + interval '90 days');

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_stakes_status ON stakes(status);
CREATE INDEX IF NOT EXISTS idx_stakes_purchase_id ON stakes(purchase_id);
CREATE INDEX IF NOT EXISTS idx_stakes_lock_end_date ON stakes(lock_end_date);

-- Update RLS policies
DROP POLICY IF EXISTS "Stakes are viewable by everyone" ON stakes;
DROP POLICY IF EXISTS "Users can create stakes" ON stakes;
DROP POLICY IF EXISTS "Users can update their own stakes" ON stakes;

-- Create new policies
CREATE POLICY "Stakes are viewable by everyone"
ON stakes FOR SELECT
TO public
USING (true);

CREATE POLICY "Users can create stakes"
ON stakes FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM purchases
    WHERE id = purchase_id
    AND buyer_address = auth.uid()::text
    AND status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM stakes s
      WHERE s.purchase_id = purchases.id
      AND s.status = 'active'
    )
  )
);

CREATE POLICY "Users can update their own stakes"
ON stakes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM purchases
    WHERE id = stakes.purchase_id
    AND buyer_address = auth.uid()::text
  )
);