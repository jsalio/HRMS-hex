-- Migration: 002_employees
-- Creates: departments, employees, employee_onboarding
-- Adds FK: users.employee_id → employees.id
-- Idempotent: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING

CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        VARCHAR(255) NOT NULL,
  document_id      VARCHAR(50)  NOT NULL UNIQUE,
  corporate_email  VARCHAR(255) NOT NULL UNIQUE,
  department_id    UUID NOT NULL REFERENCES departments(id),
  job_title        VARCHAR(100) NOT NULL,
  salary           NUMERIC(15,2) NOT NULL CHECK (salary > 0),
  status           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE','REMOTE','ON_LEAVE','INACTIVE')),
  hire_date        DATE NOT NULL,
  termination_date DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inactive_requires_termination
    CHECK (status != 'INACTIVE' OR termination_date IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS employee_onboarding (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  step         VARCHAR(20) NOT NULL
               CHECK (step IN ('documents','equipment','training','access','complete')),
  completed    BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, step)
);

-- Add FK on users.employee_id now that employees table exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_users_employee' AND table_name = 'users'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status        ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_email         ON employees(corporate_email);
CREATE INDEX IF NOT EXISTS idx_onboarding_employee_id  ON employee_onboarding(employee_id);

-- Seed: default departments (idempotent)
INSERT INTO departments (name) VALUES
  ('Human Resources'),
  ('Finance'),
  ('Engineering'),
  ('Operations'),
  ('Sales')
ON CONFLICT (name) DO NOTHING;
