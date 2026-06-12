# SDD Spec: hrms-notifications

**Feature**: Adaptador Slack de salida — eventos de dominio publicados a canales configurables
**User story**: Como HR Admin quiero configurar notificaciones automáticas en Slack para eventos del sistema (aprobaciones, vencimientos, cierres de nómina) sin que el sistema dependa de Slack
**Estado**: Draft
**Fecha**: 2026-06-12
**Parte de**: hrms-hex.split.md — Sub-spec 9 de 10
**Dependencias**: hrms-auth-roles hasta hrms-recruitment completos

---

## Decisiones fijas

| Decisión | Valor |
|---|---|
| Patrón | Puerto de salida: el dominio publica `DomainEvent`, el adaptador Slack lo consume |
| Persistencia | Todo evento se persiste en `notification_events` antes de enviar |
| Fallo Slack | Si el webhook falla, status→FAILED; reintento manual o automático (job) |
| Retry | Cola con 3 reintentos con backoff exponencial (60s, 300s, 900s) |
| Multi-canal | Un evento puede enviarse a múltiples canales según configuración |
| Rama Git | `feat/hrms-notifications` (parte desde main cuando todos los sub-specs previos están mergeados) |

---

## Eventos de dominio soportados

| Evento | Fuente | Descripción |
|---|---|---|
| `absence.approved` | hrms-absences | Ausencia aprobada por manager |
| `absence.rejected` | hrms-absences | Ausencia rechazada |
| `document.expiring` | hrms-documents | Documento vence en ≤ 30 días |
| `document.signed` | hrms-documents | Documento firmado |
| `payroll.closed` | hrms-payroll | Período de nómina cerrado |
| `employee.hired` | hrms-recruitment | Nuevo empleado creado por contratación |
| `employee.terminated` | hrms-employees | Empleado dado de baja |
| `user.created` | hrms-auth-roles | Nueva cuenta de usuario creada |

---

## Modelo de datos

```sql
CREATE TABLE notification_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  VARCHAR(100) NOT NULL,
  payload     JSONB NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING','SENT','FAILED')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  sent_at     TIMESTAMPTZ,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE slack_configs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_name VARCHAR(100) NOT NULL,
  webhook_url    TEXT NOT NULL,
  channel        VARCHAR(100) NOT NULL,
  event_types    TEXT[] NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_events_retry
  ON notification_events(next_retry_at)
  WHERE status = 'FAILED' AND attempts < 3;
```

### Invariantes del modelo
1. Todo evento se persiste con status=PENDING antes de intentar el envío.
2. Si el envío falla: status→FAILED, attempts++, next_retry_at calculado con backoff.
3. Si el envío exitoso: status→SENT, sent_at=now().
4. Después de 3 intentos fallidos, el evento queda FAILED permanente (requiere intervención manual).

---

## Contratos de API

**GET /slack/configs**
```
Response 200: SlackConfig[]
Requiere: can_view en 'settings'
```

**POST /slack/configs**
```
Body: { workspace_name, webhook_url, channel, event_types: string[] }
Response 201: SlackConfig
Errores: 422 event_type desconocido | 403
```

**PATCH /slack/configs/:id**
```
Body: Partial<{ webhook_url, channel, event_types, is_active }>
Response 200: SlackConfig
```

**DELETE /slack/configs/:id** → `204`

**POST /slack/configs/:id/test**
```
Response 200: { sent: boolean, error?: string }
Efecto: envía mensaje de prueba al webhook configurado
Errores: 422 config inactiva
```

**GET /notifications/events**
```
Query: ?status&event_type&from&to&page
Response 200: { data: NotificationEvent[], total }
Requiere: can_view en 'notifications'
```

**POST /notifications/events/:id/retry**
```
Response 200: NotificationEvent
Efecto: reintenta envío manual, status→PENDING
Errores: 422 ya SENT
```

---

## Máquina de estados del frontend

```
INTEGRATIONS_PAGE (Configuración → Integraciones)
  → [+ configurar Slack] → SLACK_CONFIG_FORM
  → [test webhook]       → TEST_MODAL (muestra resultado)
  → [activar/desactivar] → toggle inline

SLACK_CONFIG_FORM
  → selección de eventos a notificar (checkboxes por tipo)
  → [guardar]            → INTEGRATIONS_PAGE

NOTIFICATIONS_LOG (vista admin)
  → tabla de eventos: tipo, status, fecha, intentos
  → [reintentar]         → PENDING → SENT/FAILED actualizado
```

---

## Puerto de salida (hexagonal)

```typescript
// Core — el dominio solo conoce este puerto
interface INotificationPort {
  publish(event: DomainEvent): Promise<void>
}

// Boundary — adaptador Slack implementa el puerto
class SlackNotificationAdapter implements INotificationPort {
  async publish(event: DomainEvent): Promise<void> {
    // 1. Persiste en notification_events (status=PENDING)
    // 2. Busca slack_configs activas para event.type
    // 3. Envía webhook por cada config
    // 4. Actualiza status (SENT / FAILED)
  }
}
```

---

## Invariantes del sistema

| # | Invariante |
|---|---|
| 1 | El dominio publica eventos sin conocer Slack — desacoplamiento total |
| 2 | Ningún evento se pierde — siempre se persiste antes de enviar |
| 3 | Un evento FAILED con attempts≥3 no se reintenta automáticamente |
| 4 | El test de webhook no crea un `notification_event` real |

---

## Impacto en archivos

| Archivo | Cambio |
|---|---|
| `packages/core/src/contracts/notifications.ts` | NUEVO — INotificationPort, DomainEvent |
| `packages/core/src/domain/domain-event.ts` | NUEVO — base class + tipos de evento |
| `packages/boundary-slack/src/slack-notification.adapter.ts` | NUEVO — Boundary de Slack |
| `packages/boundary-postgres/migrations/009_notifications.sql` | NUEVO |
| `packages/api/src/controllers/notifications.controller.ts` | NUEVO |
| (Todos los use cases previos) | MODIFICADO — inyectan INotificationPort y publican evento |
| `apps/hrms-ui/src/app/notifications/` | NUEVO |
| `apps/hrms-ui/src/assets/i18n/*.json` | MODIFICADO — claves notifications.* |

---

## Fuera de scope

- Email / push notifications (v2 — solo Slack en v1)
- Notificaciones in-app (v2)
- Templates de mensajes Slack personalizables (v2)
- Webhooks de entrada (v1 solo salida)
