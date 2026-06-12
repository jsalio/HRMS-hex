-- Migration: 001_auth_roles
-- Creates: roles, role_permissions, users, refresh_tokens
-- Seed: 4 system roles with ON CONFLICT DO NOTHING (idempotent)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module      TEXT NOT NULL CHECK (module IN (
                'dashboard','employees','attendance','payroll','reports',
                'settings','documents','absences','benefits','recruitment','notifications'
              )),
  can_view    BOOLEAN NOT NULL DEFAULT false,
  can_create  BOOLEAN NOT NULL DEFAULT false,
  can_edit    BOOLEAN NOT NULL DEFAULT false,
  can_delete  BOOLEAN NOT NULL DEFAULT false,
  can_export  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (role_id, module)
);

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role_id         UUID NOT NULL REFERENCES roles(id),
  employee_id     UUID NULL,  -- FK added in migration 002_employees
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- Seed: system roles (idempotent)
INSERT INTO roles (name, is_system) VALUES
  ('super_admin', true),
  ('hr_manager',  true),
  ('finance',     true),
  ('employee',    true)
ON CONFLICT (name) DO NOTHING;

-- hr_manager default permissions
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_export)
SELECT r.id, m.module, m.can_view, m.can_create, m.can_edit, m.can_delete, m.can_export
FROM roles r
CROSS JOIN (VALUES
  ('employees',     true,  true,  true,  false, true),
  ('attendance',    true,  false, false, false, true),
  ('absences',      true,  true,  true,  false, false),
  ('documents',     true,  true,  false, false, false),
  ('reports',       true,  false, false, false, true),
  ('notifications', true,  false, false, false, false),
  ('dashboard',     true,  false, false, false, false)
) AS m(module, can_view, can_create, can_edit, can_delete, can_export)
WHERE r.name = 'hr_manager'
ON CONFLICT (role_id, module) DO NOTHING;

-- finance default permissions
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_export)
SELECT r.id, m.module, m.can_view, m.can_create, m.can_edit, m.can_delete, m.can_export
FROM roles r
CROSS JOIN (VALUES
  ('payroll',       true,  true,  true,  false, true),
  ('reports',       true,  false, false, false, true),
  ('dashboard',     true,  false, false, false, false),
  ('notifications', true,  false, false, false, false)
) AS m(module, can_view, can_create, can_edit, can_delete, can_export)
WHERE r.name = 'finance'
ON CONFLICT (role_id, module) DO NOTHING;

-- employee default permissions
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_export)
SELECT r.id, m.module, m.can_view, m.can_create, m.can_edit, m.can_delete, m.can_export
FROM roles r
CROSS JOIN (VALUES
  ('dashboard',     true,  false, false, false, false),
  ('attendance',    true,  true,  false, false, false),
  ('absences',      true,  true,  false, false, false),
  ('documents',     true,  false, false, false, false),
  ('notifications', true,  false, false, false, false)
) AS m(module, can_view, can_create, can_edit, can_delete, can_export)
WHERE r.name = 'employee'
ON CONFLICT (role_id, module) DO NOTHING;
