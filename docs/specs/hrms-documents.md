# hrms-documents

**Fecha**: 2026-06-13
**Estado**: Implementado
**Actualizado**: 2026-06-18 — post INC-002 (refactor a use cases atómicos, ver `docs/sdd-incident-log.md`)
**Sub-spec**: 3 de 10 — hrms-hex
**Dependencia**: hrms-employees completo

---

## Qué es este feature

Los empleados firman contratos, NDAs, políticas y certificados durante su ciclo de vida laboral. Este módulo gestiona el ciclo completo de cada documento: carga como pendiente, firma con hash de integridad, archivado histórico, y renovación cuando vence. La empresa obtiene trazabilidad auditable de qué documentos firmó cada empleado, cuándo y quién los firmó.

Los binarios (PDFs) viven en un storage externo (S3/GCS). Este módulo gestiona los metadatos, el estado y la inmutabilidad del registro de firma — no almacena binarios.

---

## Qué se construyó

### Modelo de datos

```sql
CREATE TABLE document_templates (
  id UUID PRIMARY KEY, name VARCHAR(255) UNIQUE, description TEXT, created_at TIMESTAMPTZ
);

CREATE TABLE employee_documents (
  id              UUID PRIMARY KEY,
  employee_id     UUID NOT NULL REFERENCES employees(id),
  template_id     UUID REFERENCES document_templates(id),
  name            VARCHAR(255) NOT NULL,
  type            VARCHAR(50)  CHECK (type IN ('contract','nda','policy','certificate','other')),
  status          VARCHAR(20)  DEFAULT 'PENDING' CHECK (status IN ('PENDING','SIGNED','ARCHIVED')),
  file_url        TEXT NOT NULL,
  file_hash       VARCHAR(64),
  signed_at       TIMESTAMPTZ,
  signed_by       UUID REFERENCES users(id),
  archived_at     TIMESTAMPTZ,
  expires_at      DATE,
  renewed_from_id UUID REFERENCES employee_documents(id),
  created_at      TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  CONSTRAINT signed_complete
    CHECK (status != 'SIGNED' OR (signed_at IS NOT NULL AND signed_by IS NOT NULL AND file_hash IS NOT NULL))
);
```

### Contratos de API

| Endpoint | Permiso | Efecto |
|---|---|---|
| `GET /employees/:id/documents?status&type` | canView | Lista documentos del empleado con filtros opcionales |
| `POST /employees/:id/documents` | canCreate | Crea documento PENDING |
| `GET /documents/:id` | canView | Detalle de un documento |
| `POST /documents/:id/sign` body: `{ fileHash }` | canEdit | PENDING → SIGNED; registra hash, signed_by, signed_at |
| `POST /documents/:id/archive` | canEdit | SIGNED → ARCHIVED; registra archived_at |
| `POST /documents/:id/renew` body: `{ fileUrl, expiresAt? }` | canCreate | Crea nuevo PENDING con renewed_from_id apuntando al original |
| `GET /documents/expiring?days=30` | canView | Documentos que vencen en los próximos N días (máx 365) con info del empleado |

### Invariantes del sistema

1. Un documento SIGNED no puede volver a ser firmado ni cambiar de estado a PENDING.
2. Solo un documento SIGNED puede ser archivado.
3. La renovación crea un nuevo documento PENDING — el original no se modifica.
4. Un documento SIGNED siempre tiene `file_hash`, `signed_at` y `signed_by` (garantía de DB constraint).

---

## Cómo está estructurado el código

### Patrón arquitectónico
Hexagonal — mismo que sub-specs 1 y 2. Core sin dependencias externas, DocumentRepository como adaptador postgres, controlador con dos Hono instances para manejar el dual-prefix de URLs.

### Archivos creados / modificados

| Archivo | Capa | Responsabilidad |
|---|---|---|
| `packages/core/src/contracts/documents.ts` | dominio | Tipos `DocumentStatus`, `DocumentType`; contratos atómicos por operación; puerto completo `IDocumentRepository` |
| `packages/core/src/domain/employee-document.ts` | dominio | Entidad `EmployeeDocument` con `assertCanBeSigned` / `assertCanBeArchived` |
| `packages/core/src/usecases/create-document.usecase.ts` | aplicación | `CreateDocumentUseCase` — crea documento PENDING validando empleado activo |
| `packages/core/src/usecases/get-document.usecase.ts` | aplicación | `GetDocumentUseCase` — carga detalle por id |
| `packages/core/src/usecases/list-documents.usecase.ts` | aplicación | `ListDocumentsUseCase` — lista documentos de un empleado con filtros |
| `packages/core/src/usecases/list-expiring-documents.usecase.ts` | aplicación | `ListExpiringDocumentsUseCase` — documentos que vencen en los próximos N días |
| `packages/core/src/usecases/sign-document.usecase.ts` | aplicación | `SignDocumentUseCase` — PENDING → SIGNED con hash de integridad |
| `packages/core/src/usecases/archive-document.usecase.ts` | aplicación | `ArchiveDocumentUseCase` — SIGNED → ARCHIVED |
| `packages/core/src/usecases/renew-document.usecase.ts` | aplicación | `RenewDocumentUseCase` — crea nuevo PENDING con `renewed_from_id` |
| `packages/boundary-postgres/src/migrations/003_documents.sql` | infra | Tablas document_templates + employee_documents |
| `packages/boundary-postgres/src/repositories/document.repository.ts` | infra | Implementación IDocumentRepository con postgres.js |
| `packages/api/src/controllers/documents.controller.ts` | presentación | employeeRoutes + documentRoutes (dual-prefix) |
| `packages/api/src/mappers/document.mapper.ts` | presentación | toDocumentDTO, toExpiringDocumentDTO |
| `apps/hrms-ui/src/app/documents/documents.service.ts` | UI | HTTP calls a todos los endpoints de documentos |
| `apps/hrms-ui/src/app/documents/documents-page.component.ts` | UI | Smart: lista + filtros + modales sign/upload/renew |

---

## Cómo se verifica

### Tests de backend (14 tests — 61 total en suite)

| Test | Capa | Qué verifica |
|---|---|---|
| `given_PENDING_document_when_assertCanBeSigned_then_passes` | dominio | Invariante — solo PENDING puede firmarse |
| `given_SIGNED_document_when_assertCanBeSigned_then_throws` | dominio | Invariante — no re-firmar SIGNED |
| `given_ARCHIVED_document_when_assertCanBeSigned_then_throws` | dominio | Invariante — no firmar archivado |
| `given_SIGNED_document_when_assertCanBeArchived_then_passes` | dominio | Invariante — SIGNED puede archivarse |
| `given_PENDING_document_when_assertCanBeArchived_then_throws` | dominio | Invariante — no archivar PENDING |
| `createDocument_creates_PENDING_document_for_active_employee` | aplicación | Happy path create |
| `createDocument_throws_NotFoundError_when_employee_not_found` | aplicación | Empleado inexistente |
| `createDocument_throws_ValidationError_when_employee_is_INACTIVE` | aplicación | Empleado inactivo |
| `signDocument_transitions_to_SIGNED_and_stores_hash` | aplicación | Happy path sign |
| `signDocument_throws_ValidationError_when_already_SIGNED` | aplicación | No re-firmar |
| `archiveDocument_transitions_to_ARCHIVED` | aplicación | Happy path archive |
| `archiveDocument_throws_ValidationError_when_PENDING` | aplicación | No archivar pendiente |
| `renewDocument_creates_new_PENDING_with_renewed_from_id` | aplicación | Renovación no modifica original |
| `listExpiringDocuments_delegates_to_repository` | aplicación | Delegación con employee info |

---

## Decisiones tomadas y por qué

**Use cases atómicos (post INC-002)**: La implementación original agrupaba toda la lógica en `ManageDocumentsUseCase`. Refactorizado a 7 use cases atómicos siguiendo SRP. Formalizado en ADR-0001. La dependencia de `IEmployeeRepository` (para validar empleado activo) es exclusiva de `CreateDocumentUseCase` — los demás use cases no la necesitan.

**Controlador con dual Hono instance**: Las rutas abarcan dos prefijos URL. Exportar `{ employeeRoutes, documentRoutes }` y montarlos por separado preserva la separación de concerns sin modificar controladores existentes.

**`GET /documents/expiring` registrado antes que `GET /documents/:id`**: En Hono, el orden de registro determina qué ruta captura primero. "expiring" sería capturado como `:id` si se registra después.

**file_hash lo provee el cliente**: El servidor no tiene acceso a los binarios (están en S3/GCS). Se acepta el hash sin verificar que sea hexadecimal. Registrado como deuda SEC-D3.

---

## Side-effects manejados

- `AppModule.DOCUMENTS` ya existía en el enum desde sub-spec 1 — sin cambio de contrato.
- FKs a `employees` y `users` requieren migrations 001 y 002 previas — garantizado por el sistema de migraciones secuencial.
- Dos exports nuevos en `core/index.ts` y `boundary-postgres/index.ts` — aditivos, sin romper nada existente.

---

## Deuda técnica

| # | ID | Descripción | Impacto | Cuándo |
|---|---|---|---|---|
| 1 | SEC-D3 | fileHash aceptado sin verificar formato hex — cliente puede registrar hash arbitrario | medio | antes de go-live |
| 2 | SEC-D2 | DocumentRepository.findExpiring no valida daysFromNow >= 0 | bajo | próximo sprint |
| 3 | — | Link/botón "Documentos" no agregado en employee-detail-page.component.ts | bajo | próximo sprint |

---

## Desviaciones del spec original

| Qué cambió | Motivo | Impacto |
|---|---|---|
| `DocumentsPageComponent` único en lugar de múltiples componentes | Simplifica árbol de componentes | bajo |
