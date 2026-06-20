# Security Analysis: hrms-recruitment

**Feature**: Pipeline de reclutamiento — vacantes, candidatos y contratación que dispara alta de empleado
**Modo**: Diseño
**Fecha**: 2026-06-19
**Spec de origen**: docs/specs/hrms-recruitment.spec.md
**Nivel de riesgo general**: 🟠 Alto

---

## Resumen ejecutivo

4 hallazgos detectados: 0 críticos, 1 alto, 3 medios. El pipeline **no está bloqueado**. El riesgo principal es la ausencia de modelo de permisos explícito en el spec — el endpoint `/candidates/:id/hire` crea un empleado y dispara onboarding sin especificar qué rol puede ejecutarlo. Ningún hallazgo impide continuar, pero el modelo de permisos debe definirse antes de implementar el controlador.

---

## Hallazgos

| ID | Categoría | Severidad | Descripción | Ubicación |
|---|---|---|---|---|
| SEC-1 | 2 — Autenticación y autorización | 🟠 Alto | Endpoints sin modelo de permisos explícito en el spec | spec — Contratos de API |
| SEC-2 | 10 — Arquitectura y diseño | 🟡 Medio | `resume_url` acepta URLs arbitrarias sin validación de esquema | spec — Modelo de datos |
| SEC-3 | 10 — Arquitectura y diseño | 🟡 Medio | Hire endpoint recoge PII sensible sin reglas de validación definidas | spec — Contratos de API |
| SEC-4 | 10 — Arquitectura y diseño | 🟡 Medio | Schema no impone unicidad email+posting para candidatos | spec — Modelo de datos |

---

## Detalle de hallazgos

### SEC-1 — Endpoints sin modelo de permisos explícito
- **Severidad**: 🟠 Alto
- **Categoría**: Autenticación y autorización
- **Descripción**: El spec define 6 endpoints (job-postings CRUD, candidates, status, hire) sin especificar qué `AppModule` permission o rol puede ejecutar cada uno. En el sistema actual, la autorización se gobierna por `permissionGuard(AppModule.X, 'canView'|'canEdit')`. El endpoint `POST /candidates/:id/hire` en particular crea un empleado y dispara onboarding — operación de alto impacto que debería requerir `canEdit` explícito y posiblemente un rol mínimo de HR Manager.
- **Vector de ataque**: Un usuario con token JWT válido pero rol de empleado (sin permisos de recruitment) podría intentar llamar directamente a `POST /candidates/:id/hire` si el controlador no aplica `requirePermission` con el módulo correcto.
- **Ubicación**: `docs/specs/hrms-recruitment.spec.md` — sección "Contratos de API"
- **Remediación**: Añadir al spec una tabla de permisos por endpoint antes de implementar el controlador:
  ```
  GET  /job-postings                     → RECRUITMENT canView
  POST /job-postings                     → RECRUITMENT canEdit
  PATCH /job-postings/:id               → RECRUITMENT canEdit
  GET  /job-postings/:id/candidates     → RECRUITMENT canView
  POST /candidates                       → RECRUITMENT canEdit
  PATCH /candidates/:id/status          → RECRUITMENT canEdit
  POST /candidates/:id/hire             → RECRUITMENT canEdit (+ validar rol mínimo HR Manager)
  ```
  Registrar `AppModule.RECRUITMENT` en el enum y en el seed de roles antes del controlador.

---

### SEC-2 — `resume_url` acepta URLs arbitrarias sin validación
- **Severidad**: 🟡 Medio
- **Categoría**: Arquitectura y diseño
- **Descripción**: El campo `resume_url TEXT` almacena una URL externa proporcionada por el operador de RRHH. No hay regla de validación definida en el spec. Si en algún momento la API o el frontend intenta hacer fetch de esa URL (preview de CV), se convierte en SSRF. Incluso sin fetch, URLs arbitrarias permiten almacenar enlaces de phishing o contenido malicioso en la BD.
- **Vector de ataque**: Un operador malintencionado envía `resume_url: "http://internal-service:8080/admin"`. Si el backend hace fetch para generar un preview, puede leer servicios internos. Si el frontend la renderiza como `<a href>`, puede redirigir a contenido malicioso.
- **Ubicación**: `docs/specs/hrms-recruitment.spec.md` — tabla `candidates`, campo `resume_url`
- **Remediación**: En el use case de creación de candidato, validar que `resume_url` (si presente) tenga esquema `https://` y formato de URL válido. Nunca hacer server-side fetch de este campo. En la UI, renderizar como `<a href>` con `target="_blank" rel="noopener noreferrer"`.

---

### SEC-3 — Hire endpoint recoge PII sensible sin reglas de validación
- **Severidad**: 🟡 Medio
- **Categoría**: Arquitectura y diseño
- **Descripción**: El body de `POST /candidates/:id/hire` incluye `salary` (dato financiero), `document_id` (identificación nacional — PII sensible), y `corporate_email`. El spec no define rangos válidos para salary ni formato para document_id. Sin estas reglas, el use case no tiene contrato claro para validar, lo que puede resultar en datos corruptos (salary=0, salary negativo) o en document_id con formato incorrecto que pase la validación de unicidad de empleados pero sea inválido en reportes.
- **Vector de ataque**: `salary: -1` o `salary: 999999999` pasan sin rechazo. `document_id: ""` puede crear un empleado con ID vacío que colisione con el constraint de unicidad de formas inesperadas.
- **Ubicación**: `docs/specs/hrms-recruitment.spec.md` — endpoint `POST /candidates/:id/hire`
- **Remediación**: Añadir al spec las reglas de validación mínimas:
  ```
  salary      → number, > 0
  hire_date   → date, no futura
  corporate_email → formato email válido
  document_id → string no vacío, máx 50 chars
  ```
  Aplicar en el use case `hire-candidate`, no solo en el controlador.

---

### SEC-4 — Sin constraint de unicidad email+posting en candidatos
- **Severidad**: 🟡 Medio
- **Categoría**: Arquitectura y diseño
- **Descripción**: El schema `candidates` no tiene `UNIQUE(posting_id, email)`. Esto permite que el mismo candidato aplique múltiples veces a la misma vacante, generando duplicados en el pipeline que el HR Manager debe gestionar manualmente. También permite que un bug o script externo inunde una vacante con candidatos duplicados del mismo email.
- **Vector de ataque**: Script que llama `POST /candidates` repetidamente con el mismo `{posting_id, email}` — sin constraint de BD, todos se insertan creando ruido en el pipeline.
- **Ubicación**: `docs/specs/hrms-recruitment.spec.md` — tabla `candidates`
- **Remediación**: Añadir al DDL de la migración:
  ```sql
  CONSTRAINT unique_candidate_per_posting UNIQUE (posting_id, email)
  ```
  Y manejar `ConflictError` en el use case de creación de candidato.

---

## Categorías auditadas

| # | Categoría | Estado | Hallazgos |
|---|---|---|---|
| 1 | Secretos y configuración | ✅ auditada | 0 — sin secretos ni config expuesta en el spec |
| 2 | Autenticación y autorización | ✅ auditada | 1 — SEC-1 🟠 |
| 3 | Inyección | ⚠️ N/A | Modo diseño — no hay código a auditar |
| 4 | Datos sensibles | ✅ auditada | 0 — datos en línea con sub-specs anteriores; `document_id` ya existe en employees |
| 5 | Dependencias y supply chain | ⚠️ N/A | Sin dependencias nuevas en el spec |
| 6 | Infraestructura | ⚠️ N/A | Sin cambios de infraestructura en el spec |
| 7 | Criptografía | ✅ auditada | 0 — sin tokens ni hashing nuevos |
| 8 | Errores e información | ⚠️ N/A | Modo diseño — evaluar en modo código |
| 9 | Frontend | ✅ auditada | 0 — flujo UI usa patrones establecidos; `resume_url` cubierto en SEC-2 |
| 10 | Arquitectura y diseño | ✅ auditada | 3 — SEC-2, SEC-3, SEC-4 🟡 |
| 11 | Memoria | ⚠️ N/A | Stack TypeScript/Bun — sin gestión manual de memoria |

---

## Verificación manual requerida

- [ ] Confirmar que `AppModule.RECRUITMENT` se añade al enum y al seed de roles antes del controlador
- [ ] Verificar en runtime que el middleware `requirePermission(RECRUITMENT, canEdit)` se aplica a `POST /candidates/:id/hire`
- [ ] Validar que `resume_url` no se renderiza con `innerHTML` ni se fetcha en servidor en ninguna pantalla

---

## Próximo paso

Sin hallazgos críticos — continuar con `/impact`.
