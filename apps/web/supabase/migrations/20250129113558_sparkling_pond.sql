/*
  # Add username column and handle duplicate wallet addresses

  1. Changes
    - Add username column to organizations table
    - Generate unique usernames for existing organizations
    - Handle duplicate wallet addresses by merging organizations
  
  2. Security
    - Maintain existing RLS policies
*/

-- First, identify and merge duplicate wallet addresses
DO $$ 
BEGIN
  -- Create a temporary table to store organizations to keep
  CREATE TEMP TABLE orgs_to_keep AS
  WITH ranked_orgs AS (
    SELECT 
      id,
      wallet_address,
      ROW_NUMBER() OVER (PARTITION BY wallet_address ORDER BY created_at) as rn
    FROM organizations
  )
  SELECT id, wallet_address
  FROM ranked_orgs
  WHERE rn = 1;

  -- Update projects to point to the kept organizations
  UPDATE projects p
  SET organization_id = otk.id
  FROM organizations o
  JOIN orgs_to_keep otk ON o.wallet_address = otk.wallet_address
  WHERE p.organization_id = o.id
  AND o.id != otk.id;

  -- Delete duplicate organizations
  DELETE FROM organizations o
  WHERE NOT EXISTS (
    SELECT 1 FROM orgs_to_keep otk WHERE otk.id = o.id
  );
END $$;

-- Now add username column and set unique values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'username'
  ) THEN
    ALTER TABLE organizations ADD COLUMN username text;
    
    -- Update existing organizations with unique usernames
    WITH numbered_orgs AS (
      SELECT 
        id,
        wallet_address,
        ROW_NUMBER() OVER (ORDER BY created_at) as rn
      FROM organizations
      WHERE username IS NULL
    )
    UPDATE organizations o
    SET username = 'user_' || LOWER(SUBSTRING(o.wallet_address FROM 3 FOR 6)) || 
                  CASE WHEN no.rn > 1 THEN '_' || no.rn ELSE '' END
    FROM numbered_orgs no
    WHERE o.id = no.id;
    
    -- Make username required for future inserts
    ALTER TABLE organizations ALTER COLUMN username SET NOT NULL;
    
    -- Add unique constraint after setting unique values
    ALTER TABLE organizations ADD CONSTRAINT organizations_username_unique UNIQUE (username);
  END IF;
END $$;

-- Add index for username lookups
CREATE INDEX IF NOT EXISTS idx_organizations_username ON organizations(username);

-- Add unique constraint for wallet_address after merging duplicates
ALTER TABLE organizations ADD CONSTRAINT organizations_wallet_address_unique UNIQUE (wallet_address);