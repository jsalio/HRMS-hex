# Security Analysis: Capa de persistencia (boundary-postgres)

**Feature**: Auditoría de inyección SQL en la capa de repositorios con SQL puro (postgres.js)
**Modo**: Código
**Fecha**: 2026-06-18
**Spec de origen**: docs/specs/hrms-auth-roles.md (decisión "postgres.js como driver", línea 168)
**Nivel de riesgo general**: 🟡 Medio

---

## Resumen ejecutivo

Auditados los 8 repositorios de `packages/boundary-postgres/src/repositories`. **No se detectó ningún vector de inyección SQL activo**: todas las queries usan tagged templates de `postgres.js`, que parametrizan valores; no hay `sql.unsafe`, ni concatenación de strings, ni identificadores dinámicos desde input. El riesgo real es **latente y arquitectónico** (SEC-1): la seguridad depende únicamente de la convención de usar tagged templates, sin guardrail que impida introducir un vector en el futuro — y al ser SQL puro, ninguna otra capa puede cubrir ese hueco. El pipeline **no se bloquea**.

---

## Hallazgos

| ID | Categoría | Severidad | Descripción | Ubicación |
|---|---|---|---|---|
| SEC-1 | 10 — Arquitectura | 🟡 | Prevención de SQLi garantizada solo por convención; sin guardrail (lint/CI) que prohíba `sql.unsafe`/concatenación | `packages/boundary-postgres/src/repositories/*` |
| SEC-2 | 3 — Inyección | 🟡 | LIKE wildcard injection: `%`/`_` no escapados en búsqueda | `employee.repository.ts:83-85` |
| SEC-3 | 6 — Infraestructura | 🟡 | `findAll` de empleados sin tope de `limit` (DoS por página grande) | `employee.repository.ts:88` |

---

## Detalle de hallazgos

### SEC-1 — La inmunidad a SQLi depende solo de la convención, sin guardrail
- **Severidad**: 🟡 Medio
- **Categoría**: 10 — Arquitectura y diseño
- **Descripción**: La decisión de usar SQL puro (sin ORM, justificada en `hrms-auth-roles.md:168`) traslada el 100% de la responsabilidad de parametrización a la capa de repositorios. Hoy se cumple correctamente vía tagged templates, pero nada lo *fuerza*: un futuro `sql.unsafe(\`... ${input}\`)`, una concatenación, o un `ORDER BY ${sort}` dinámico (previsible en los reports exportables de `hrms-admin`, aún no implementado) introduciría SQLi sin que ninguna otra capa pueda interceptarlo.
- **Vector de ataque**: Latente. Se materializa con un cambio futuro que rompa la convención; el input ya llega como string desde use case/controller, que no pueden re-protegerlo.
- **Ubicación**: `packages/boundary-postgres/src/repositories/*` (transversal)
- **Remediación**:
  1. Regla ESLint que prohíba `sql.unsafe` y la concatenación dentro de literales de query (allowlist por revisión).
  2. Para identificadores dinámicos (sort/columnas en reports), exigir el helper `sql(identifier)` de postgres.js o un mapeo a allowlist de columnas — nunca interpolar el string crudo.
  3. Promover la decisión "SQL puro + parametrización obligatoria" de la spec a un **ADR** (`docs/adr/`), para que sea visible globalmente y no quede enterrada en el sub-spec de auth.

### SEC-2 — LIKE wildcard injection en búsqueda de empleados
- **Severidad**: 🟡 Medio
- **Categoría**: 3 — Inyección
- **Descripción**: `search` se interpola como `'%' + search + '%'` sin escapar los metacaracteres `%` y `_` de LIKE/ILIKE. No es SQLi (el valor sigue parametrizado), pero un usuario puede inyectar wildcards para forzar match de tabla completa o degradar rendimiento.
- **Vector de ataque**: Búsqueda con `%` o `_` repetidos → escaneo amplio / abuso de CPU de la DB.
- **Ubicación**: `employee.repository.ts:83-85`
- **Remediación**: Escapar `%`, `_` y `\` en el término antes de envolverlo, o usar `ILIKE ... ESCAPE`. Ej.: `search.replace(/[\\%_]/g, c => '\\' + c)`.

### SEC-3 — Ausencia de tope de `limit` en findAll de empleados
- **Severidad**: 🟡 Medio
- **Categoría**: 6 — Infraestructura (resource exhaustion)
- **Descripción**: `limit = query.limit ?? 20` sin máximo. `absence.repository.ts:133` sí capa con `Math.min(query.limit ?? 20, 100)` — inconsistencia. Un `limit` enorme devuelve toda la tabla.
- **Vector de ataque**: `GET /employees?limit=1000000` → carga masiva en DB y memoria.
- **Ubicación**: `employee.repository.ts:88`
- **Remediación**: Aplicar el mismo tope que en absences: `Math.min(query.limit ?? 20, 100)`.

---

## Categorías auditadas

| # | Categoría | Estado | Hallazgos |
|---|---|---|---|
| 1 | Secretos y configuración | ⚠️ N/A | fuera de scope (solo repositorios) |
| 2 | Autenticación y autorización | ⚠️ N/A | fuera de scope (capa API) |
| 3 | Inyección | ✅ auditada | 1 (SEC-2) |
| 4 | Datos sensibles | ✅ auditada | 0 |
| 5 | Dependencias y supply chain | ⚠️ N/A | fuera de scope |
| 6 | Infraestructura | ✅ auditada | 1 (SEC-3) |
| 7 | Criptografía | ⚠️ N/A | fuera de scope |
| 8 | Errores e información | ✅ auditada | 0 |
| 9 | Frontend | ⚠️ N/A | fuera de scope |
| 10 | Arquitectura y diseño | ✅ auditada | 1 (SEC-1) |
| 11 | Memoria | ⚠️ N/A | no aplica al stack (TS/Bun) |

---

## Verificación manual requerida

- [ ] Reports exportables de `hrms-admin` (no implementado aún): el filtrado/orden dinámico con `?sort`, `?format` es el punto donde SEC-1 se materializaría — auditar al implementarlo.
- [ ] Confirmar que ninguna migración (`packages/boundary-postgres/src/migrations`) construye DDL desde input externo.

---

## Próximo paso

Sin hallazgos críticos → el pipeline puede continuar. Recomendado antes de producción: aplicar SEC-2 y SEC-3 (cambios puntuales) y resolver SEC-1 con la regla de lint + ADR para hacer permanente la garantía hoy mantenida por convención.
