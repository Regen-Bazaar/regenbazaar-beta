/*
  # Add impact value column to projects table

  1. Changes
    - Add impact_value column to projects table with default value
    - Update existing projects to have a default impact value
*/

-- Add impact_value column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'impact_value'
  ) THEN
    ALTER TABLE projects ADD COLUMN impact_value numeric DEFAULT 0.1;
  END IF;
END $$;