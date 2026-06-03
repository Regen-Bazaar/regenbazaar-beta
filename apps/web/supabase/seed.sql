-- Create a dummy organization
INSERT INTO organizations (id, name, username, description, wallet_address, website, logo_url, verified)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Green World', 'greenworld', 'Dedicated to reforestation and conservation efforts globally.', '0x1234567890123456789012344678901234567890', 'https://greenworld.org', 'https://example.com/logo.png', true);

-- Create dummy projects for the organization
INSERT INTO projects (id, organization_id, title, description, category, funding_goal, current_funding, start_date, end_date, status)
VALUES
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Amazon Rainforest Restoration', 'Restoring 10,000 hectares of the Amazon rainforest.', 'Environment', 50000.00, 15000.00, '2025-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'active'),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Community Well in Africa', 'Building a well to provide clean water to a community of 500 people.', 'Community', 10000.00, 7500.00, '2025-03-01T00:00:00Z', '2025-09-01T00:00:00Z', 'active');

-- Create dummy donations for the projects
INSERT INTO donations (project_id, donor_address, amount, transaction_hash)
VALUES
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', '0xDonorAddress1', 100.00, '0xTxHash1'),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', '0xDonorAddress2', 50.00, '0xTxHash2');

-- Create dummy impact metrics for the projects
INSERT INTO impact_metrics (project_id, metric_name, metric_value, unit, date)
VALUES
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Trees Planted', 500, 'trees', '2025-06-01T00:00:00Z'),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'People with Clean Water', 500, 'people', '2025-08-01T00:00:00Z'); 