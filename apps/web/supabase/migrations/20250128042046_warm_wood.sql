/*
  # Initial Schema Setup for Non-Profit Platform

  1. New Tables
    - `organizations`
      - Basic organization info and wallet address
    - `projects`
      - Impact projects created by organizations
    - `donations`
      - Record of donations made to projects
    - `impact_metrics`
      - Quantifiable impact data for projects

  2. Security
    - Enable RLS on all tables
    - Policies for organization data access
    - Policies for project visibility
    - Policies for donation records
*/

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  wallet_address text NOT NULL,
  website text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  verified boolean DEFAULT false
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  funding_goal numeric NOT NULL,
  current_funding numeric DEFAULT 0,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Donations table
CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  donor_address text NOT NULL,
  amount numeric NOT NULL,
  transaction_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Impact metrics table
CREATE TABLE IF NOT EXISTS impact_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  unit text NOT NULL,
  date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_metrics ENABLE ROW LEVEL SECURITY;

-- Organization Policies
CREATE POLICY "Organizations are viewable by everyone"
  ON organizations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Organizations can be created by authenticated users"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Organizations can be updated by owners"
  ON organizations FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = wallet_address);

-- Project Policies
CREATE POLICY "Projects are viewable by everyone"
  ON projects FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Projects can be created by organization owners"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE id = organization_id
      AND wallet_address = auth.uid()::text
    )
  );

-- Donation Policies
CREATE POLICY "Donations are viewable by everyone"
  ON donations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Donations can be created by authenticated users"
  ON donations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Impact Metrics Policies
CREATE POLICY "Impact metrics are viewable by everyone"
  ON impact_metrics FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Impact metrics can be created by organization owners"
  ON impact_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = project_id
      AND o.wallet_address = auth.uid()::text
    )
  );