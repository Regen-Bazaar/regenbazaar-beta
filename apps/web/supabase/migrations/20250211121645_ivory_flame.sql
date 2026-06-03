/*
  # Fix stakes table schema

  1. Changes
    - Add status column to stakes table
    - Add indexes for better query performance
    - Update RLS policies
*/

-- Add status column to stakes table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stakes' AND column_name = 'status'
  ) THEN
    ALTER TABLE stakes ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_stakes_status ON stakes(status);
CREATE INDEX IF NOT EXISTS idx_stakes_purchase_id_status ON stakes(purchase_id, status);

-- Update stakes policies
DROP POLICY IF EXISTS "Users can create stakes" ON stakes;
DROP POLICY IF EXISTS "Users can update their own stakes" ON stakes;

CREATE POLICY "Users can create stakes"
ON stakes FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM purchases
    WHERE id = purchase_id
    AND buyer_address = auth.uid()::text
    AND status = 'active'
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