CREATE TABLE IF NOT EXISTS governance_roles (
  role_code TEXT PRIMARY KEY,
  role_label TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_permissions (
  permission_code TEXT PRIMARY KEY,
  permission_label TEXT NOT NULL,
  description TEXT,
  permission_group TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_role_permissions (
  role_code TEXT NOT NULL REFERENCES governance_roles(role_code) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES governance_permissions(permission_code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_code, permission_code)
);

INSERT INTO governance_roles (role_code, role_label, description)
VALUES
  ('administrator', 'Administrator', 'Full system administration, configuration, data sync, and change approval.'),
  ('editor-staff', 'Editor Staff', 'Upload Excel/CSV, create records, and edit data within granted permissions.'),
  ('registered-user', 'Registered User', 'Authenticated user who can search and view approved full species data.'),
  ('anonymous', 'Anonymous', 'Public visitor who can only view published WebGIS data.')
ON CONFLICT (role_code)
DO UPDATE SET
  role_label = EXCLUDED.role_label,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO governance_permissions (permission_code, permission_label, description, permission_group)
VALUES
  ('system.manage', 'Manage system', 'Manage global system configuration and settings.', 'system'),
  ('users.manage', 'Manage users', 'Create, edit, lock/unlock users, and assign roles.', 'identity'),
  ('roles.manage', 'Manage roles', 'Manage roles and permission matrix.', 'identity'),
  ('data.sync', 'Sync data', 'Run data synchronization and production update tasks.', 'data'),
  ('data.import', 'Import data', 'Upload Excel/CSV/SQL and import data within granted permissions.', 'data'),
  ('species.create', 'Create species profile', 'Create new species profiles.', 'species'),
  ('species.update', 'Update species profile', 'Edit species profile data.', 'species'),
  ('species.delete', 'Delete species profile', 'Delete or hide species profiles.', 'species'),
  ('species.review', 'Review changes', 'Approve or reject data change requests.', 'governance'),
  ('species.publish', 'Publish data', 'Publish approved data to WebGIS.', 'governance'),
  ('species.view.full', 'View full data', 'View full approved species data.', 'species'),
  ('species.view.published', 'View published data', 'View public published data.', 'species')
ON CONFLICT (permission_code)
DO UPDATE SET
  permission_label = EXCLUDED.permission_label,
  description = EXCLUDED.description,
  permission_group = EXCLUDED.permission_group;

INSERT INTO governance_role_permissions (role_code, permission_code)
VALUES
  ('administrator', 'system.manage'),
  ('administrator', 'users.manage'),
  ('administrator', 'roles.manage'),
  ('administrator', 'data.sync'),
  ('administrator', 'data.import'),
  ('administrator', 'species.create'),
  ('administrator', 'species.update'),
  ('administrator', 'species.delete'),
  ('administrator', 'species.review'),
  ('administrator', 'species.publish'),
  ('administrator', 'species.view.full'),
  ('administrator', 'species.view.published'),
  ('editor-staff', 'data.import'),
  ('editor-staff', 'species.create'),
  ('editor-staff', 'species.update'),
  ('editor-staff', 'species.view.full'),
  ('editor-staff', 'species.view.published'),
  ('registered-user', 'species.view.full'),
  ('registered-user', 'species.view.published'),
  ('anonymous', 'species.view.published')
ON CONFLICT (role_code, permission_code) DO NOTHING;

INSERT INTO user_roles (user_id, role_code)
SELECT user_id, 'administrator'
FROM user_roles
WHERE role_code = 'admin'
ON CONFLICT (user_id, role_code) DO NOTHING;
