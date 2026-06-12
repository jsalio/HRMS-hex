# SDD Spec: HRMS-HEX — Aplicación de RRHH Completa

**Feature**: Sistema de gestión de recursos humanos full-stack con arquitectura hexagonal
**User story**: Como organización quiero una plataforma de RRHH que cubra el ciclo de vida completo del empleado — desde reclutamiento hasta nómina — con diseño fiel a las pantallas de Stitch
**Estado**: ⚠️ Reemplazado por split — ver docs/specs/hrms-hex.split.md
**Fecha**: 2026-06-12
**Diseño fuente**: Google Stitch proyecto `13650739638263912450` (desktop, #0f49bd, Inter, light)

---

## Decisiones fijas

| Decisión | Valor |
|---|---|
| Stack backend | PostgreSQL + Bun + TypeScript |
| Stack frontend | Angular + Smart/Dumb components |
| Arquitectura | Hexagonal (puertos y adaptadores) |
| Estructura física | Core (contratos) + Boundaries (tecnología) + API (ensamblaje) |
| Autenticación | Email + contraseña + JWT; sin OAuth en v1 |
| Roles | Super Admin, HR Manager, Finance, Employee |
| Permisos | View / Create / Edit / Delete / Export por módulo |
| Baja de empleados | Lógica (estado INACTIVE + fecha_egreso), nunca DELETE físico |
| Documentos firmados | Inmutables una vez firmados |
| Nómina cerrada | Inmutable una vez cerrada |
| Notificaciones | Adaptador Slack de salida; dominio publica eventos, no conoce Slack |
| Evaluaciones | Fuera de scope v1 (sin diseño en Stitch) |
| 2FA | Configurable por rol (campo en rol: require_2fa) |
| Idioma código | Inglés (variables, funciones, clases, columnas SQL, rutas) |
| Idioma UI | Internacionalizado — es (default), en, pt |
| Librería i18n | @ngx-translate/core — runtime switching, sin recompilación |
| Archivos de traducción | `src/assets/i18n/es.json`, `en.json`, `pt.json` |
| Idioma por defecto | Español (es) — fiel a las pantallas de Stitch |
| Selector de idioma | Visible en el header de la app shell (persistido en localStorage) |
| Cobertura i18n | 100% de textos visibles: labels, mensajes de error, placeholders, tooltips, fechas y monedas con locale pipe |

---

## Modelo de datos

### Módulo 1: Auth & Roles

```sql
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,  -- 'super_admin'|'hr_manager'|'finance'|'employee'
  description TEXT,
  require_2fa BOOLEAN NOT NULL DEFAULT false,
  is_system   BOOLEAN NOT NULL DEFAULT false, -- roles del sistema no se eliminan
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module     VARCHAR(50) NOT NULL,  -- 'dashboard'|'employees'|'attendance'|'payroll'|'reports'|'settings'|'documents'|'absences'|'benefits'|'recruitment'|'notifications'
  can_view   BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit   BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role_id, module)
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id       UUID NOT NULL REFERENCES roles(id),
  employee_id   UUID REFERENCES employees(id),  -- NULL para usuarios sin expediente
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Módulo 2: Expediente de Empleados

```sql
CREATE TABLE departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       VARCHAR(255) NOT NULL,
  document_id     VARCHAR(50)  NOT NULL UNIQUE,  -- cédula/RIF/pasaporte
  corporate_email VARCHAR(255) NOT NULL UNIQUE,
  department_id   UUID NOT NULL REFERENCES departments(id),
  job_title       VARCHAR(100) NOT NULL,
  salary          NUMERIC(15,2) NOT NULL CHECK (salary > 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'  -- 'ACTIVE'|'REMOTE'|'ON_LEAVE'|'INACTIVE'
                  CHECK (status IN ('ACTIVE','REMOTE','ON_LEAVE','INACTIVE')),
  hire_date       DATE NOT NULL,
  termination_date DATE,          -- NULL mientras activo
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inactive_requires_termination
    CHECK (status != 'INACTIVE' OR termination_date IS NOT NULL)
);

CREATE TABLE employee_onboarding (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  step        VARCHAR(50) NOT NULL,   -- 'documents'|'equipment'|'training'|'access'|'complete'
  completed   BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Módulo 3: Documentos y Firmas

```sql
CREATE TABLE document_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employee_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  template_id     UUID REFERENCES document_templates(id),
  name            VARCHAR(255) NOT NULL,
  type            VARCHAR(50) NOT NULL,  -- 'contract'|'nda'|'policy'|'certificate'|'other'
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','SIGNED','ARCHIVED')),
  file_url        TEXT NOT NULL,
  file_hash       VARCHAR(64),           -- SHA-256 del contenido al firmar
  signed_at       TIMESTAMPTZ,
  signed_by       UUID REFERENCES users(id),
  archived_at     TIMESTAMPTZ,
  expires_at      DATE,                  -- NULL = no vence
  renewal_notified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signed_is_immutable
    CHECK (status != 'SIGNED' OR (signed_at IS NOT NULL AND signed_by IS NOT NULL AND file_hash IS NOT NULL))
);
```

### Módulo 4: Ausencias y Aprobaciones

```sql
CREATE TABLE absence_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,  -- 'vacation'|'sick_leave'|'personal'|'maternity'|'paternity'
  annual_allowance_days INTEGER NOT NULL DEFAULT 0,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE absence_balances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  absence_type_id UUID NOT NULL REFERENCES absence_types(id),
  year          INTEGER NOT NULL,
  allocated_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days     NUMERIC(5,1) NOT NULL DEFAULT 0,
  pending_days  NUMERIC(5,1) NOT NULL DEFAULT 0,  -- en solicitudes pendientes
  UNIQUE(employee_id, absence_type_id, year),
  CONSTRAINT non_negative CHECK (allocated_days >= 0 AND used_days >= 0 AND pending_days >= 0)
);

CREATE TABLE absence_requests (
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
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);
```

### Módulo 5: Asistencia y Tiempo

```sql
CREATE TABLE attendance_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  date         DATE NOT NULL,
  check_in     TIMESTAMPTZ,
  check_out    TIMESTAMPTZ,
  hours_worked NUMERIC(4,2) GENERATED ALWAYS AS (
    CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL
    THEN EXTRACT(EPOCH FROM (check_out - check_in))/3600
    ELSE NULL END
  ) STORED,
  status       VARCHAR(20) NOT NULL DEFAULT 'PRESENT'
               CHECK (status IN ('PRESENT','ABSENT','LATE','ON_LEAVE','HOLIDAY')),
  notes        TEXT,
  UNIQUE(employee_id, date)
);
```

### Módulo 6: Nómina

```sql
CREATE TABLE payroll_periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'OPEN'
              CHECK (status IN ('OPEN','PROCESSING','CLOSED')),
  closed_at   TIMESTAMPTZ,
  closed_by   UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_period CHECK (end_date > start_date),
  CONSTRAINT closed_requires_timestamp CHECK (status != 'CLOSED' OR closed_at IS NOT NULL)
);

CREATE TABLE payroll_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id       UUID NOT NULL REFERENCES payroll_periods(id),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  base_salary     NUMERIC(15,2) NOT NULL,
  worked_days     NUMERIC(5,1) NOT NULL,
  absent_days     NUMERIC(5,1) NOT NULL DEFAULT 0,
  gross_salary    NUMERIC(15,2) NOT NULL,
  deductions      NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_salary      NUMERIC(15,2) NOT NULL,
  is_locked       BOOLEAN NOT NULL DEFAULT false,  -- true cuando el período cierra
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_id, employee_id)
);
```

### Módulo 7: Beneficios

```sql
CREATE TABLE benefit_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(50) NOT NULL,  -- 'health'|'life_insurance'|'dental'|'vision'|'pension'
  description TEXT,
  provider    VARCHAR(100),
  cost        NUMERIC(10,2),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employee_benefits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL REFERENCES employees(id),
  plan_id        UUID NOT NULL REFERENCES benefit_plans(id),
  enrolled_at    DATE NOT NULL,
  unenrolled_at  DATE,
  UNIQUE(employee_id, plan_id)
);
```

### Módulo 8: Reclutamiento

```sql
CREATE TABLE job_postings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(255) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  description  TEXT NOT NULL,
  requirements TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'OPEN'
               CHECK (status IN ('OPEN','CLOSED','ON_HOLD')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ
);

CREATE TABLE candidates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id   UUID NOT NULL REFERENCES job_postings(id),
  full_name    VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  phone        VARCHAR(50),
  resume_url   TEXT,
  status       VARCHAR(30) NOT NULL DEFAULT 'APPLIED'
               CHECK (status IN ('APPLIED','SCREENING','INTERVIEW','OFFER','HIRED','REJECTED')),
  notes        TEXT,
  hired_as_employee_id UUID REFERENCES employees(id),  -- se llena al contratar
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Módulo 9: Notificaciones (Slack)

```sql
CREATE TABLE notification_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  VARCHAR(100) NOT NULL,  -- 'absence_approved'|'document_expiring'|'payroll_closed'|etc.
  payload     JSONB NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING','SENT','FAILED')),
  sent_at     TIMESTAMPTZ,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE slack_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_name VARCHAR(100) NOT NULL,
  webhook_url   TEXT NOT NULL,
  channel       VARCHAR(100) NOT NULL,
  event_types   TEXT[] NOT NULL,  -- qué eventos enviar a este canal
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Invariantes del modelo

### Globales
1. Ningún empleado con `status = 'INACTIVE'` puede tener su `termination_date` en NULL.
2. Un empleado INACTIVE no puede tener solicitudes de ausencia en PENDING o APPROVED después de su `termination_date`.
3. Ningún documento con `status = 'SIGNED'` puede ser modificado (file_url, file_hash, signed_at son inmutables).
4. Una nómina con `status = 'CLOSED'` no puede tener entries modificadas (`is_locked = true`).
5. El balance de ausencias `used_days + pending_days <= allocated_days` antes de aprobar una solicitud.
6. Un candidato con `status = 'HIRED'` debe tener `hired_as_employee_id` no NULL.
7. Los roles de sistema (`is_system = true`) no pueden ser eliminados.
8. El Super Admin siempre tiene todos los permisos activos (se recalcula en cada login).

---

## Contratos de API

### Auth
| Método | Path | Body | Response | Efecto | Errores |
|---|---|---|---|---|---|
| POST | `/auth/login` | `{email, password}` | `{access_token, refresh_token, user}` | Crea refresh_token | 401 credenciales inválidas |
| POST | `/auth/refresh` | `{refresh_token}` | `{access_token}` | Rota token | 401 token expirado/revocado |
| POST | `/auth/logout` | `{}` | `204` | Revoca refresh_token | — |

### Employees
| Método | Path | Body/Params | Response | Efecto | Errores |
|---|---|---|---|---|---|
| GET | `/employees` | `?dept&status&page` | `{data: Employee[], total, page}` | — | 403 sin permiso view |
| POST | `/employees` | `EmployeeCreate` | `Employee` | Crea employee + user | 409 document/email duplicado |
| GET | `/employees/:id` | — | `Employee` | — | 404 |
| PATCH | `/employees/:id` | `EmployeeUpdate` | `Employee` | Actualiza | 409 dup / 422 inactivo |
| POST | `/employees/:id/terminate` | `{termination_date}` | `Employee` | status→INACTIVE | 422 ya inactivo |

### Documents
| Método | Path | Body/Params | Response | Efecto | Errores |
|---|---|---|---|---|---|
| GET | `/employees/:id/documents` | — | `Document[]` | — | 403 |
| POST | `/employees/:id/documents` | `DocumentCreate` | `Document` | Crea PENDING | — |
| POST | `/documents/:id/sign` | `{signed_by}` | `Document` | status→SIGNED + hash | 422 ya firmado |
| POST | `/documents/:id/archive` | — | `Document` | status→ARCHIVED | 422 no firmado |

### Absences
| Método | Path | Body/Params | Response | Efecto | Errores |
|---|---|---|---|---|---|
| GET | `/employees/:id/absence-balances` | `?year` | `Balance[]` | — | — |
| POST | `/absence-requests` | `AbsenceRequestCreate` | `AbsenceRequest` | Crea PENDING, reserva balance | 422 sin balance |
| PATCH | `/absence-requests/:id/approve` | `{notes?}` | `AbsenceRequest` | status→APPROVED, descuenta balance | 403 sin rol |
| PATCH | `/absence-requests/:id/reject` | `{notes}` | `AbsenceRequest` | status→REJECTED, libera balance | 403 sin rol |

### Attendance
| Método | Path | Body/Params | Response | Efecto | Errores |
|---|---|---|---|---|---|
| GET | `/attendance` | `?employee_id&from&to` | `AttendanceRecord[]` | — | — |
| POST | `/attendance/check-in` | `{employee_id, timestamp}` | `AttendanceRecord` | check_in | 409 ya registrado |
| POST | `/attendance/check-out` | `{employee_id, timestamp}` | `AttendanceRecord` | check_out | 422 sin check-in |

### Payroll
| Método | Path | Body/Params | Response | Efecto | Errores |
|---|---|---|---|---|---|
| GET | `/payroll/periods` | — | `PayrollPeriod[]` | — | 403 |
| POST | `/payroll/periods` | `{name, start_date, end_date}` | `PayrollPeriod` | Crea OPEN | — |
| POST | `/payroll/periods/:id/process` | — | `PayrollPeriod` | Calcula entries, status→PROCESSING | 422 ya cerrado |
| POST | `/payroll/periods/:id/close` | — | `PayrollPeriod` | status→CLOSED, bloquea entries | 422 ya cerrado |

### Benefits
| Método | Path | Body/Params | Response | Efecto | Errores |
|---|---|---|---|---|---|
| GET | `/benefit-plans` | — | `BenefitPlan[]` | — | — |
| POST | `/employees/:id/benefits` | `{plan_id, enrolled_at}` | `EmployeeBenefit` | Inscribe | 409 ya inscrito |
| DELETE | `/employees/:id/benefits/:planId` | — | `204` | Unenroll | 404 |

### Recruitment
| Método | Path | Body/Params | Response | Efecto | Errores |
|---|---|---|---|---|---|
| GET | `/job-postings` | `?status` | `JobPosting[]` | — | — |
| POST | `/job-postings` | `JobPostingCreate` | `JobPosting` | Crea OPEN | — |
| POST | `/candidates` | `CandidateCreate` | `Candidate` | Crea APPLIED | — |
| PATCH | `/candidates/:id/status` | `{status, notes?}` | `Candidate` | Avanza pipeline | 422 transición inválida |
| POST | `/candidates/:id/hire` | `{hire_date, salary, dept, title}` | `{candidate, employee}` | Crea employee, status→HIRED | 422 ya contratado |

### Notifications
| Método | Path | Body/Params | Response | Efecto | Errores |
|---|---|---|---|---|---|
| GET | `/slack/config` | — | `SlackConfig[]` | — | 403 |
| POST | `/slack/config` | `SlackConfigCreate` | `SlackConfig` | Registra webhook | — |
| PATCH | `/slack/config/:id` | `SlackConfigUpdate` | `SlackConfig` | Actualiza | — |
| POST | `/slack/test` | `{config_id}` | `{sent: bool}` | Envía mensaje de prueba | 422 config inactiva |

### Roles & Permissions
| Método | Path | Body/Params | Response | Efecto | Errores |
|---|---|---|---|---|---|
| GET | `/roles` | — | `Role[]` | — | 403 |
| POST | `/roles` | `RoleCreate` | `Role` | Crea con permisos | — |
| PATCH | `/roles/:id` | `RoleUpdate` | `Role` | Actualiza permisos | 422 is_system |
| DELETE | `/roles/:id` | — | `204` | Elimina | 422 is_system / 409 usuarios asignados |

---

## Máquina de estados del frontend

### Estado global de la aplicación
```
UNAUTHENTICATED
  → [login exitoso] → AUTHENTICATED
  → [token expirado] → UNAUTHENTICATED

AUTHENTICATED
  └─ módulos activos según role_permissions del usuario
```

### Estados por módulo

#### Empleados
```
LIST (tabla paginada, filtros)
  → [click empleado] → DETAIL
  → [+ nuevo] → CREATE_FORM
DETAIL
  → [editar] → EDIT_FORM
  → [dar de baja] → CONFIRM_TERMINATE → LIST
CREATE_FORM / EDIT_FORM
  → [guardar exitoso] → DETAIL
  → [cancelar] → LIST / DETAIL
```

#### Documentos
```
LIST (por empleado)
  → [subir] → UPLOAD_FORM → LIST
  → [firmar] → SIGN_CONFIRM → LIST (doc = SIGNED)
  → [archivar] → ARCHIVE_CONFIRM → LIST (doc = ARCHIVED)
  → [renovar] → RENEW_FORM → LIST (nuevo doc PENDING)
```

#### Ausencias
```
EMPLOYEE_VIEW: balance + solicitudes propias
  → [solicitar] → REQUEST_FORM
    → [balance suficiente] → PENDING_CONFIRMATION
    → [sin balance] → ERROR_NO_BALANCE
MANAGER_VIEW: cola de aprobaciones
  → [aprobar/rechazar] → CONFIRMATION_MODAL → LIST actualizado
```

#### Nómina
```
PERIODS_LIST
  → [nueva período] → PERIOD_FORM → PERIODS_LIST (OPEN)
  → [procesar] → PROCESSING (entries calculadas)
  → [cerrar] → CONFIRM_CLOSE → CLOSED (inmutable)
  → [ver detalle] → PERIOD_DETAIL (entries por empleado)
```

#### Reclutamiento
```
POSTINGS_LIST
  → [ver candidatos] → CANDIDATES_LIST
  → [candidato] → CANDIDATE_PROFILE
    → [avanzar] → STATUS_MODAL → CANDIDATE_PROFILE actualizado
    → [contratar] → HIRE_FORM → EMPLOYEE_CREATED (redirect a expediente)
```

---

## Invariantes del sistema

| # | Invariante |
|---|---|
| 1 | Un empleado INACTIVE no puede ser editado — cualquier PATCH retorna 422 |
| 2 | Un documento SIGNED no puede cambiar de estado ni de contenido |
| 3 | Una nómina CLOSED no puede reabrirse ni modificar sus entries |
| 4 | El balance de ausencias no puede quedar negativo en ningún momento |
| 5 | El rol Super Admin siempre tiene todos los permisos (no editable vía API) |
| 6 | Un candidato solo puede ser contratado una vez (hired_as_employee_id único) |
| 7 | Al contratar un candidato se crea el empleado Y se dispara onboarding automáticamente |
| 8 | Los eventos de dominio (aprobación, cierre de nómina, etc.) se persisten en notification_events antes de enviar a Slack — si Slack falla, el evento queda FAILED y reintentable |
| 9 | Solo usuarios con can_export=true pueden descargar CSV/reportes |
| 10 | Un usuario desactivado (is_active=false) no puede autenticarse aunque tenga credenciales válidas |

---

## Impacto en archivos existentes

| Archivo | Cambio |
|---|---|
| `docs/specs/hrms-hex.spec.md` | NUEVO — este archivo |
| (Todo lo demás) | NUEVO — proyecto desde cero |

---

## Internacionalización (i18n)

### Decisión arquitectónica
`@ngx-translate/core` con `TranslateHttpLoader`. Las traducciones se cargan en runtime desde `src/assets/i18n/{lang}.json` — sin recompilación al cambiar de idioma. El idioma se persiste en `localStorage` key `hrms_lang`.

### Idiomas soportados
| Código | Idioma | Locale Angular |
|---|---|---|
| `es` | Español | `es-VE` (default) |
| `en` | English | `en-US` |
| `pt` | Português | `pt-BR` |

### Estructura de claves de traducción (namespaced por módulo)
```json
{
  "common": {
    "save": "...", "cancel": "...", "edit": "...", "delete": "...",
    "search": "...", "filter": "...", "export": "...", "loading": "...",
    "error": { "required": "...", "duplicate": "...", "unauthorized": "..." }
  },
  "auth": {
    "login": { "title": "...", "email": "...", "password": "...", "submit": "..." },
    "logout": "..."
  },
  "employees": {
    "title": "...", "new": "...", "status": {
      "ACTIVE": "...", "REMOTE": "...", "ON_LEAVE": "...", "INACTIVE": "..."
    },
    "fields": { "fullName": "...", "documentId": "...", "hireDate": "...", "salary": "..." }
  },
  "documents": { "title": "...", "sign": "...", "archive": "...", "renew": "...",
    "status": { "PENDING": "...", "SIGNED": "...", "ARCHIVED": "..." }
  },
  "absences": { "title": "...", "request": "...", "approve": "...", "reject": "...",
    "balance": "...", "error": { "insufficientBalance": "..." }
  },
  "attendance": { "title": "...", "checkIn": "...", "checkOut": "..." },
  "payroll": { "title": "...", "process": "...", "close": "...",
    "status": { "OPEN": "...", "PROCESSING": "...", "CLOSED": "..." }
  },
  "benefits": { "title": "...", "enroll": "...", "unenroll": "..." },
  "recruitment": { "title": "...", "hire": "...",
    "status": { "APPLIED": "...", "SCREENING": "...", "INTERVIEW": "...", "OFFER": "...", "HIRED": "...", "REJECTED": "..." }
  },
  "notifications": { "title": "...", "test": "...", "configure": "..." },
  "roles": { "title": "...", "permissions": "..." },
  "admin": { "dashboard": "...", "reports": "...", "settings": "..." }
}
```

### Invariante i18n
- Ningún texto hardcodeado en templates Angular — todo pasa por `| translate`
- Fechas via `| date` con locale inyectado
- Monedas via `| currency` con locale inyectado
- El sub-spec `hrms-auth-roles` configura el módulo i18n en el AppModule — todos los demás sub-specs lo heredan

---

## Fuera de scope (explícito)

- Evaluaciones de desempeño (sin pantallas en Stitch v1)
- OAuth / SSO (v1 solo email+contraseña)
- Aplicación móvil (diseño es desktop únicamente)
- Multi-tenancy (una sola organización por instancia)
- Integración con sistemas de contabilidad externos
- Portal público de postulación (reclutamiento es solo interno)
- Nómina con impuestos/retenciones legales (cálculo es base — no fiscal)
