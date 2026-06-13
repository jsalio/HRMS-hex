-- Document templates (reusable document scaffolds)
CREATE TABLE IF NOT EXISTS document_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employee documents lifecycle
CREATE TABLE IF NOT EXISTS employee_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES employees(id),
  template_id         UUID REFERENCES document_templates(id),
  name                VARCHAR(255) NOT NULL,
  type                VARCHAR(50) NOT NULL
                        CHECK (type IN ('contract','nda','policy','certificate','other')),
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','SIGNED','ARCHIVED')),
  file_url            TEXT NOT NULL,
  file_hash           VARCHAR(64),
  signed_at           TIMESTAMPTZ,
  signed_by           UUID REFERENCES users(id),
  archived_at         TIMESTAMPTZ,
  expires_at          DATE,
  renewal_notified_at TIMESTAMPTZ,
  renewed_from_id     UUID REFERENCES employee_documents(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ensures signed documents always have all required sign fields
  CONSTRAINT signed_complete
    CHECK (status != 'SIGNED' OR
           (signed_at IS NOT NULL AND signed_by IS NOT NULL AND file_hash IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_status      ON employee_documents(status);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expires_at  ON employee_documents(expires_at)
  WHERE expires_at IS NOT NULL;
