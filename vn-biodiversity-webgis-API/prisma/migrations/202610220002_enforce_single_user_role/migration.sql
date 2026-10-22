-- Keep the highest-privileged role for accounts that currently have multiple roles.
WITH ranked_roles AS (
  SELECT
    user_role_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE role_code
          WHEN 'administrator' THEN 1
          WHEN 'editor-staff' THEN 2
          WHEN 'registered-user' THEN 3
          ELSE 4
        END,
        created_at,
        user_role_id
    ) AS role_rank
  FROM user_roles
)
DELETE FROM user_roles
WHERE user_role_id IN (
  SELECT user_role_id
  FROM ranked_roles
  WHERE role_rank > 1
);

-- Keep the oldest administrator account as the single system administrator.
WITH ranked_administrators AS (
  SELECT
    user_role_id,
    ROW_NUMBER() OVER (ORDER BY created_at, user_role_id) AS administrator_rank
  FROM user_roles
  WHERE role_code = 'administrator'
)
UPDATE user_roles
SET role_code = 'registered-user'
WHERE user_role_id IN (
  SELECT user_role_id
  FROM ranked_administrators
  WHERE administrator_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_user
  ON user_roles (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_single_administrator
  ON user_roles (role_code)
  WHERE role_code = 'administrator';
