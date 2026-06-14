-- absence types
CREATE TABLE IF NOT EXISTS absence_types (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(100) NOT NULL UNIQUE,
  annual_allowance_days INTEGER NOT NULL DEFAULT 0,
  requires_approval     BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- per-employee balance per type per year
CREATE TABLE IF NOT EXISTS absence_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  absence_type_id UUID NOT NULL REFERENCES absence_types(id),
  year            INTEGER NOT NULL,
  allocated_days  NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days       NUMERIC(5,1) NOT NULL DEFAULT 0,
  pending_days    NUMERIC(5,1) NOT NULL DEFAULT 0,
  UNIQUE(employee_id, absence_type_id, year),
  CONSTRAINT non_negative CHECK (allocated_days >= 0 AND used_days >= 0 AND pending_days >= 0),
  CONSTRAINT balance_coherent CHECK (used_days + pending_days <= allocated_days)
);

-- absence requests
CREATE TABLE IF NOT EXISTS absence_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  absence_type_id UUID NOT NULL REFERENCES absence_types(id),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  working_days    NUMERIC(5,1) NOT NULL,
  reason          TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT working_days_positive CHECK (working_days > 0)
);

CREATE INDEX IF NOT EXISTS idx_absence_requests_employee ON absence_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_absence_requests_status   ON absence_requests(status);
CREATE INDEX IF NOT EXISTS idx_absence_balances_employee ON absence_balances(employee_id, year);

-- seed standard absence types
INSERT INTO absence_types (name, annual_allowance_days, requires_approval) VALUES
  ('vacation',   15, true),
  ('sick_leave', 10, false),
  ('personal',    3, true),
  ('maternity',  84, true),
  ('paternity',  14, true)
ON CONFLICT (name) DO NOTHING;
