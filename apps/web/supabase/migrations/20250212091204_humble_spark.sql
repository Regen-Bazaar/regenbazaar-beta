-- Add development_image_url column to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS development_image_url text;

-- Add index for development image URL lookups
CREATE INDEX IF NOT EXISTS idx_organizations_development_image_url ON organizations(development_image_url);

-- Update RLS policies to allow updating development_image_url
CREATE POLICY "Anyone can update development_image_url"
ON organizations
FOR UPDATE
USING (true)
WITH CHECK (true);