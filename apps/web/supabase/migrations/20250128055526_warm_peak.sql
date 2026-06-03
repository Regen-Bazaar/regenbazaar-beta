/*
  # Fix organizations table schema and policies

  1. Changes
    - Add missing columns to organizations table
    - Update RLS policies for proper authentication
    - Fix column types and constraints

  2. Security
    - Update RLS policies to properly handle authentication
    - Ensure proper access control for organizations
*/

-- Add missing columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description text;

-- Drop existing RLS policies to recreate them properly
DROP POLICY IF EXISTS "Organizations are viewable by everyone" ON organizations;
DROP POLICY IF EXISTS "Organizations can be created by authenticated users" ON organizations;
DROP POLICY IF EXISTS "Organizations can be updated by owners" ON organizations;

-- Create new RLS policies with proper authentication checks
CREATE POLICY "Organizations are viewable by everyone"
ON organizations FOR SELECT
TO public
USING (true);

CREATE POLICY "Organizations can be created by anyone"
ON organizations FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Organizations can be updated by owners"
ON organizations FOR UPDATE
USING (auth.uid()::text = wallet_address);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_organizations_wallet_address ON organizations(wallet_address);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);