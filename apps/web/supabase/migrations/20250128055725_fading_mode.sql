/*
  # Fix projects table RLS policies

  1. Changes
    - Update RLS policies for projects table
    - Allow public creation of projects
    - Maintain proper access control for updates

  2. Security
    - Enable public access for project creation
    - Maintain read access for everyone
    - Restrict updates to project owners
*/

-- Drop existing project policies
DROP POLICY IF EXISTS "Projects are viewable by everyone" ON projects;
DROP POLICY IF EXISTS "Projects can be created by organization owners" ON projects;

-- Create new policies with proper access control
CREATE POLICY "Projects are viewable by everyone"
ON projects FOR SELECT
TO public
USING (true);

CREATE POLICY "Projects can be created by anyone"
ON projects FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Projects can be updated by organization owners"
ON projects FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organizations
    WHERE id = projects.organization_id
    AND wallet_address = auth.uid()::text
  )
);

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);