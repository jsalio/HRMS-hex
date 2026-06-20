-- Migration 007: Recruitment module
-- Creates job_postings and candidates tables, adds a UNIQUE application
-- constraint (SEC-4), and seeds hr_manager permissions for the recruitment module.

CREATE TABLE job_postings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(255) NOT NULL,
  department_id UUID        NOT NULL REFERENCES departments(id),
  description   TEXT        NOT NULL,
  requirements  TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN', 'CLOSED', 'ON_HOLD')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ
);

CREATE TABLE candidates (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id           UUID        NOT NULL REFERENCES job_postings(id),
  full_name            VARCHAR(255) NOT NULL,
  email                VARCHAR(255) NOT NULL,
  phone                VARCHAR(50),
  resume_url           TEXT,
  status               VARCHAR(30) NOT NULL DEFAULT 'APPLIED'
                       CHECK (status IN ('APPLIED','SCREENING','INTERVIEW','OFFER','HIRED','REJECTED')),
  notes                TEXT,
  hired_as_employee_id UUID        REFERENCES employees(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Invariant: a HIRED candidate must reference an employee record
  CONSTRAINT hired_has_employee
    CHECK (status != 'HIRED' OR hired_as_employee_id IS NOT NULL),
  -- SEC-4: prevents duplicate applications (same email, same posting)
  CONSTRAINT unique_candidate_per_posting
    UNIQUE (posting_id, email)
);

CREATE INDEX idx_candidates_posting_id ON candidates (posting_id);
CREATE INDEX idx_candidates_status      ON candidates (status);

-- Seed recruitment permissions for hr_manager
-- ON CONFLICT DO NOTHING makes this idempotent across re-runs
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_export)
SELECT r.id, 'recruitment', true, true, true, false, false
FROM   roles r
WHERE  r.name = 'hr_manager'
ON CONFLICT (role_id, module) DO NOTHING;
