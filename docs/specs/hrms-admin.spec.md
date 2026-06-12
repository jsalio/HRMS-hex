# SDD Spec: hrms-admin

**Feature**: Dashboard ejecutivo, informes/analíticas exportables y configuración del sistema
**User story**: Como Super Admin quiero ver KPIs en tiempo real de toda la organización, exportar reportes y configurar parámetros del sistema
**Estado**: Draft
**Fecha**: 2026-06-12
**Parte de**: hrms-hex.split.md — Sub-spec 10 de 10
**Dependencias**: todos los sub-specs anteriores completos

---

## Decisiones fijas

| Decisión | Valor |
|---|---|
| Sin tablas nuevas | Lee de todos los módulos anteriores — no crea entidades propias |
| KPIs en tiempo real | Queries directas (no cache en v1) |
| Exportación | CSV via endpoint; PDF fuera de scope v1 |
| Configuración del sistema | Key-value persistido en tabla `system_settings` |
| Landing page | Pública (sin auth) — sirve como página de presentación del sistema |
| Rama Git | `feat/hrms-admin` (último sub-spec) |

---

## Modelo de datos

```sql
-- Única tabla nueva en este sub-spec
CREATE TABLE system_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES users(id)
);

INSERT INTO system_settings (key, value, description) VALUES
  ('org_name', 'HRMS-HEX', 'Nombre de la organización'),
  ('org_timezone', 'America/Caracas', 'Zona horaria base del sistema'),
  ('org_currency', 'USD', 'Moneda base para nómina'),
  ('working_hours_per_day', '8', 'Horas laborales por día');
```

---

## KPIs del dashboard

| KPI | Fuente |
|---|---|
| Total empleados activos | `COUNT employees WHERE status IN ('ACTIVE','REMOTE')` |
| Crecimiento últimos 30 días | empleados con hire_date en últimos 30 días |
| Empleados de licencia | `COUNT WHERE status = 'ON_LEAVE'` |
| Tasa de rotación anual | bajas / total × 100 |
| Solicitudes de ausencia pendientes | `COUNT absence_requests WHERE status = 'PENDING'` |
| Documentos por vencer (30 días) | `COUNT employee_documents WHERE expires_at <= now()+30` |
| Última nómina procesada | último payroll_period con status = 'CLOSED' |
| Candidatos activos en pipeline | `COUNT candidates WHERE status NOT IN ('HIRED','REJECTED')` |

---

## Contratos de API

**GET /dashboard/kpis**
```
Response 200: DashboardKPIs (objeto con todos los KPIs)
Requiere: can_view en 'dashboard'
```

**GET /reports/employees**
```
Query: ?department_id&status&from&to&format=csv
Response 200: Employee[] o CSV
Requiere: can_view en 'reports' | can_export para CSV
```

**GET /reports/attendance**
```
Query: ?employee_id&from&to&format=csv
Response 200: AttendanceSummary[] o CSV
```

**GET /reports/payroll**
```
Query: ?period_id&format=csv
Response 200: PayrollEntry[] o CSV
```

**GET /reports/absences**
```
Query: ?employee_id&absence_type_id&year&format=csv
Response 200: AbsenceRequest[] o CSV
```

**GET /settings**
```
Response 200: SystemSetting[]
Requiere: can_view en 'settings'
```

**PATCH /settings/:key**
```
Body: { value: string }
Response 200: SystemSetting
Requiere: can_edit en 'settings' + rol super_admin
```

---

## Máquina de estados del frontend

```
ADMIN_DASHBOARD (página principal post-login para super_admin/hr_manager)
  → KPI cards con valores en tiempo real
  → gráficas de asistencia y ausencias (últimos 30 días)
  → accesos directos a módulos

REPORTS_PAGE
  → selector de tipo de reporte
  → filtros por período/departamento/empleado
  → [exportar CSV]       → descarga directa

SETTINGS_PAGE (solo super_admin)
  → lista key-value editables inline
  → [guardar cambio]     → confirmación inline

LANDING_PAGE (pública, sin auth)
  → presentación del sistema con selector de idioma
  → [iniciar sesión]     → LOGIN_PAGE
```

---

## Invariantes del sistema

| # | Invariante |
|---|---|
| 1 | Solo super_admin puede modificar system_settings |
| 2 | CSV export requiere can_export=true en el módulo correspondiente |
| 3 | La landing page es accesible sin autenticación |
| 4 | Los KPIs son calculados en tiempo real — sin cache en v1 |

---

## Impacto en archivos

| Archivo | Cambio |
|---|---|
| `packages/core/src/usecases/get-dashboard-kpis.usecase.ts` | NUEVO |
| `packages/core/src/usecases/generate-report.usecase.ts` | NUEVO |
| `packages/boundary-postgres/migrations/010_admin.sql` | NUEVO — system_settings |
| `packages/api/src/controllers/dashboard.controller.ts` | NUEVO |
| `packages/api/src/controllers/reports.controller.ts` | NUEVO |
| `packages/api/src/controllers/settings.controller.ts` | NUEVO |
| `apps/hrms-ui/src/app/dashboard/` | NUEVO |
| `apps/hrms-ui/src/app/reports/` | NUEVO |
| `apps/hrms-ui/src/app/settings/` | NUEVO |
| `apps/hrms-ui/src/app/landing/` | NUEVO — ruta pública |
| `apps/hrms-ui/src/assets/i18n/*.json` | MODIFICADO — claves admin.* |

---

## Fuera de scope

- Gráficas avanzadas con BI (Tableau, PowerBI)
- Exportación a PDF
- Dashboards personalizables por usuario
- Cache / materialización de KPIs (v2 cuando el volumen lo justifique)
- Audit log de cambios del sistema (v2)
