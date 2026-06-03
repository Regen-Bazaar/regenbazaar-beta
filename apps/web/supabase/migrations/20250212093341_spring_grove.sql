-- Update organizations with development image URLs
UPDATE organizations 
SET development_image_url = CASE 
  WHEN name LIKE '%Thailand%' THEN 'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=800&q=80'
  WHEN name LIKE '%Phangan%' THEN 'https://images.unsplash.com/photo-1537956965359-7573183d1f57?auto=format&fit=crop&w=800&q=80'
  WHEN name LIKE '%Forest%' THEN 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80'
  WHEN name LIKE '%Ocean%' THEN 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?auto=format&fit=crop&w=800&q=80'
  WHEN name LIKE '%Green%' THEN 'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?auto=format&fit=crop&w=800&q=80'
  ELSE 'https://images.unsplash.com/photo-1535025183041-0991a977e25b?auto=format&fit=crop&w=800&q=80'
END
WHERE development_image_url IS NULL;