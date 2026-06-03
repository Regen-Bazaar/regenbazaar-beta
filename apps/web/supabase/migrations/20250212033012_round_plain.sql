/*
  # Add Transaction Hash Support
  
  1. Changes
    - Add transaction_hash column to projects table
    - Add index for efficient lookups
    
  2. Notes
    - Non-destructive change that preserves existing data
    - Allows tracking of blockchain transactions
*/

-- Add transaction_hash column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS transaction_hash text;

-- Add index for transaction hash lookups
CREATE INDEX IF NOT EXISTS idx_projects_transaction_hash ON projects(transaction_hash);