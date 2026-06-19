CREATE TABLE IF NOT EXISTS benefit_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  type        VARCHAR(50)  NOT NULL
              CHECK (type IN ('health','life_insurance','dental','vision','pension','other')),
  description TEXT,
  provider    VARCHAR(100),
  cost        NUMERIC(10,2),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_benefits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  plan_id       UUID NOT NULL REFERENCES benefit_plans(id),
  enrolled_at   DATE NOT NULL,
  unenrolled_at DATE,
  UNIQUE(employee_id, plan_id),
  CONSTRAINT valid_enrollment CHECK (unenrolled_at IS NULL OR unenrolled_at > enrolled_at)
);

CREATE INDEX IF NOT EXISTS idx_employee_benefits_employee ON employee_benefits(employee_id);
CREATE INDEX IF NOT EXISTS idx_benefit_plans_active       ON benefit_plans(is_active);
