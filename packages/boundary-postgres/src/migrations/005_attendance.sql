CREATE TABLE IF NOT EXISTS attendance_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  date         DATE NOT NULL,
  check_in     TIMESTAMPTZ,
  check_out    TIMESTAMPTZ,
  hours_worked NUMERIC(4,2) GENERATED ALWAYS AS (
    CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (check_out - check_in))/3600, 2)
    ELSE NULL END
  ) STORED,
  status       VARCHAR(20) NOT NULL DEFAULT 'PRESENT'
               CHECK (status IN ('PRESENT','ABSENT','LATE','ON_LEAVE','HOLIDAY')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date),
  CONSTRAINT checkout_after_checkin
    CHECK (check_out IS NULL OR check_in IS NULL OR check_out > check_in)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status   ON attendance_records(status);
