# SDD Spec: hrms-documents

**Feature**: Ciclo de vida de documentos y firma digital por empleado
**User story**: Como HR Manager quiero gestionar los documentos del empleado desde su carga hasta su firma y archivo, garantizando inmutabilidad del documento firmado
**Estado**: Draft
**Fecha**: 2026-06-12
**Parte de**: hrms-hex.split.md — Sub-spec 3 de 10
**Dependencias**: hrms-employees completo

---

## Decisiones fijas

| Decisión | Valor |
|---|---|
| Ciclo de vida | PENDING → SIGNED → ARCHIVED |
| Inmutabilidad | Documento SIGNED: file_url, file_hash, signed_at inmutables |
| Hash | SHA-256 del contenido del archivo al momento de firmar |
| Almacenamiento | URLs externas (S3/GCS) — este sub-spec gestiona metadatos, no binarios |
| Renovación | Crea un nuevo documento PENDING a partir del vencido/archivado |
| Rama Git | `feat/hrms-documents` (parte desde main después de merge de hrms-employees) |

---

## Modelo de datos

```sql
CREATE TABLE document_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employee_documents (
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
  CONSTRAINT signed_complete
    CHECK (status != 'SIGNED' OR
           (signed_at IS NOT NULL AND signed_by IS NOT NULL AND file_hash IS NOT NULL))
);
```

### Invariantes del modelo
1. Un documento SIGNED no puede cambiar status, file_url ni file_hash.
2. Solo se puede archivar un documento que está SIGNED.
3. La renovación crea un nuevo documento PENDING con `renewed_from_id` apuntando al original.
4. `expires_at = NULL` significa que el documento no vence.

---

## Contratos de API

**GET /employees/:id/documents**
```
Query: ?status&type
Response 200: EmployeeDocument[]
Requiere: can_view en 'documents'
```

**POST /employees/:id/documents**
```
Body: { name, type, file_url, template_id?, expires_at? }
Response 201: EmployeeDocument (status=PENDING)
Errores: 404 employee | 422 employee INACTIVE
```

**POST /documents/:id/sign**
```
Body: { file_hash: string }
Response 200: EmployeeDocument (status=SIGNED)
Efecto: status→SIGNED, sets signed_at=now(), signed_by=current_user, file_hash
Errores: 422 ya SIGNED | 422 ya ARCHIVED
```

**POST /documents/:id/archive**
```
Response 200: EmployeeDocument (status=ARCHIVED)
Efecto: status→ARCHIVED, sets archived_at=now()
Errores: 422 no está SIGNED (solo se archivan documentos firmados)
```

**POST /documents/:id/renew**
```
Body: { file_url, expires_at? }
Response 201: EmployeeDocument (nuevo PENDING, renewed_from_id = :id)
Errores: 404 documento original
```

**GET /documents/expiring**
```
Query: ?days=30 (documentos que vencen en los próximos N días)
Response 200: EmployeeDocument[] con employee info
Requiere: can_view en 'documents'
```

---

## Máquina de estados del frontend

```
DOCUMENTS_LIST (por empleado, filtrable por status/tipo)
  → [+ subir documento]  → UPLOAD_FORM
  → [firmar]             → SIGN_CONFIRM_MODAL  (solo PENDING)
  → [archivar]           → ARCHIVE_CONFIRM     (solo SIGNED)
  → [renovar]            → RENEW_FORM          (cualquier estado)
  → [ver detalle]        → DOCUMENT_DETAIL

UPLOAD_FORM
  → [guardar]            → DOCUMENTS_LIST (nuevo PENDING)
  → [cancelar]           → DOCUMENTS_LIST

SIGN_CONFIRM_MODAL
  → [confirmar firma]    → DOCUMENTS_LIST (doc=SIGNED, acciones limitadas)
  → [cancelar]           → DOCUMENTS_LIST

DOCUMENT_DETAIL
  → badge de status: PENDING (amarillo) | SIGNED (verde) | ARCHIVED (gris)
  → muestra expires_at con alerta si vence en < 30 días
  → botón renovar siempre visible
```

---

## Invariantes del sistema

| # | Invariante |
|---|---|
| 1 | POST /documents/:id/sign falla si status != 'PENDING' |
| 2 | POST /documents/:id/archive falla si status != 'SIGNED' |
| 3 | Un documento SIGNED no puede ser modificado por ningún endpoint |
| 4 | La renovación no cambia el documento original — crea uno nuevo |

---

## Impacto en archivos

| Archivo | Cambio |
|---|---|
| `packages/core/src/contracts/documents.ts` | NUEVO |
| `packages/core/src/domain/employee-document.ts` | NUEVO — con invariante inmutabilidad |
| `packages/core/src/usecases/sign-document.usecase.ts` | NUEVO |
| `packages/core/src/usecases/renew-document.usecase.ts` | NUEVO |
| `packages/boundary-postgres/migrations/003_documents.sql` | NUEVO |
| `packages/api/src/controllers/documents.controller.ts` | NUEVO |
| `apps/hrms-ui/src/app/documents/` | NUEVO — list, upload, sign, detail |
| `apps/hrms-ui/src/assets/i18n/*.json` | MODIFICADO — claves documents.* |

---

## Fuera de scope

- Almacenamiento de binarios (gestiona URLs, no archivos)
- Firma electrónica avanzada con PKI (v2)
- Versionado de plantillas de documentos
- Notificación de vencimiento (hrms-notifications)
