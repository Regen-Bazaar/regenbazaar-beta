-- Add image_url column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS image_url text;

-- Add development_image_url column to projects table for dev environment
ALTER TABLE projects ADD COLUMN IF NOT EXISTS development_image_url text;

-- Add indexes for image URL lookups
CREATE INDEX IF NOT EXISTS idx_projects_image_url ON projects(image_url);
CREATE INDEX IF NOT EXISTS idx_projects_development_image_url ON projects(development_image_url);

-- Update RLS policies to allow updating image URLs
CREATE POLICY "Anyone can update project image URLs"
ON projects
FOR UPDATE
USING (true)
WITH CHECK (true);