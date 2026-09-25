INSERT INTO users (name, email)
VALUES
  ('Aarav Sharma', 'aarav@example.com'),
  ('Maya Patel', 'maya@example.com'),
  ('Rohan Mehta', 'rohan@example.com')
ON CONFLICT (email) DO NOTHING;

INSERT INTO wallets (user_id, balance)
SELECT id, starting_balance
FROM (
  SELECT id, CASE email
    WHEN 'aarav@example.com' THEN 5000.00
    WHEN 'maya@example.com' THEN 2400.00
    WHEN 'rohan@example.com' THEN 1250.00
    ELSE 0.00
  END AS starting_balance
  FROM users
  WHERE email IN ('aarav@example.com', 'maya@example.com', 'rohan@example.com')
) seeded_users
ON CONFLICT (user_id) DO NOTHING;