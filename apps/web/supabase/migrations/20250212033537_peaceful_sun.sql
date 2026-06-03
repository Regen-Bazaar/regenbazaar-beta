/*
  # Add Transaction Hash Support for Purchases and Stakes
  
  1. Changes
    - Add transaction_hash column to purchases table
    - Add transaction_hash column to stakes table
    - Add indexes for efficient lookups
    
  2. Notes
    - Non-destructive change that preserves existing data
    - Allows tracking of blockchain transactions for purchases and stakes
*/

-- Add transaction_hash columns
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS transaction_hash text;
ALTER TABLE stakes ADD COLUMN IF NOT EXISTS transaction_hash text;

-- Add indexes for transaction hash lookups
CREATE INDEX IF NOT EXISTS idx_purchases_transaction_hash ON purchases(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_stakes_transaction_hash ON stakes(transaction_hash);