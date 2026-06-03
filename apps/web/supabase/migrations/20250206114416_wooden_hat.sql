/*
  # Add Purchase, Stake, and Resell functionality

  1. New Tables
    - `purchases`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `buyer_address` (text)
      - `price` (numeric)
      - `status` (text) - active, staked, reselling
      - `created_at` (timestamp)
    
    - `stakes`
      - `id` (uuid, primary key)
      - `purchase_id` (uuid, references purchases)
      - `iv_locked` (numeric)
      - `apr` (numeric)
      - `voting_power` (numeric)
      - `lock_end_date` (timestamptz)
      - `created_at` (timestamp)
    
    - `resell_listings`
      - `id` (uuid, primary key)
      - `purchase_id` (uuid, references purchases)
      - `price` (numeric)
      - `status` (text) - active, sold, cancelled
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  buyer_address text NOT NULL,
  price numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stakes table
CREATE TABLE IF NOT EXISTS stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE,
  iv_locked numeric NOT NULL,
  apr numeric NOT NULL,
  voting_power numeric NOT NULL,
  lock_end_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create resell_listings table
CREATE TABLE IF NOT EXISTS resell_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resell_listings ENABLE ROW LEVEL SECURITY;

-- Purchases policies
CREATE POLICY "Purchases are viewable by everyone"
  ON purchases FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create purchases"
  ON purchases FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own purchases"
  ON purchases FOR UPDATE
  USING (auth.uid()::text = buyer_address);

-- Stakes policies
CREATE POLICY "Stakes are viewable by everyone"
  ON stakes FOR SELECT
  TO public
  USING (true);

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

-- Resell listings policies
CREATE POLICY "Resell listings are viewable by everyone"
  ON resell_listings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create resell listings"
  ON resell_listings FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE id = purchase_id
      AND buyer_address = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY "Users can update their own resell listings"
  ON resell_listings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE id = resell_listings.purchase_id
      AND buyer_address = auth.uid()::text
    )
  );

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_purchases_buyer_address ON purchases(buyer_address);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_stakes_purchase_id ON stakes(purchase_id);
CREATE INDEX IF NOT EXISTS idx_resell_listings_status ON resell_listings(status);