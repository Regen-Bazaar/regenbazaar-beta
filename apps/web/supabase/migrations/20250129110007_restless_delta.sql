/*
  # Add wallet_address column to projects table

  1. Changes
    - Add wallet_address column to projects table
    - Add index for better query performance
    - Update RLS policies to use wallet_address

  2. Security
    - Update policies to check wallet_address
*/

-- Add wallet_address column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'wallet_address'
  ) THEN
    ALTER TABLE projects ADD COLUMN wallet_address text;
  END IF;
END $$;

-- Add index for wallet_address
CREATE INDEX IF NOT EXISTS idx_projects_wallet_address ON projects(wallet_address);

-- Update RLS policies to include wallet_address checks
DROP POLICY IF EXISTS "Projects can be updated by organization owners" ON projects;

CREATE POLICY "Projects can be updated by owners"
ON projects FOR UPDATE
USING (
  wallet_address = auth.uid()::text OR
  EXISTS (
    SELECT 1 FROM organizations
    WHERE id = projects.organization_id
    AND wallet_address = auth.uid()::text
  )
);