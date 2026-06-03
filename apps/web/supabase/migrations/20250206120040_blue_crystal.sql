-- Function to update project funding
CREATE OR REPLACE FUNCTION update_project_funding(p_project_id uuid, p_amount numeric)
RETURNS void AS $$
BEGIN
  UPDATE projects
  SET current_funding = current_funding + p_amount
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;