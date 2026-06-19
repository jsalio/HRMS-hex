# Security Analysis: hrms-benefits

**Feature**: Planes de beneficios y asignación por empleado
**Modo**: Código (actualizado desde Diseño)
**Fecha**: 2026-06-18
**Spec de origen**: docs/specs/hrms-benefits.spec.md
**Nivel de riesgo general**: 🟠 Alto

---

## Resumen ejecutivo

Modo diseño (4 hallazgos — 0🔴, 2🟠, 2🟡) seguido de modo código (3 hallazgos nuevos — 0🔴, 1🟠, 2🟡).
Los 4 hallazgos de diseño fueron resueltos durante la implementación, excepto SEC-BEN-2 que fue **parcialmente mal implementado**: el check de ownership existe en el use case pero compara identificadores de diferentes namespaces (`user.id` vs `employeeId`), haciendo que los empleados siempre reciban 403 al acceder a sus propios beneficios. El pipeline **no está bloqueado** (0 hallazgos críticos), pero SEC-BEN-CODE-1 debe resolverse antes del deploy.

---

## Hallazgos — Modo Diseño (estado final)

| ID | Severidad | Descripción | Estado tras implementación |
|---|---|---|---|
| SEC-BEN-1 | 🟠 | Endpoints sin especificación de permisos | ✅ Resuelto — todos los endpoints tienen `authMiddleware` + `requirePermission()` |
| SEC-BEN-2 | 🟠 | IDOR en `GET /employees/:id/benefits` | ⚠️ Parcialmente implementado — ownership check existe pero usa el identificador incorrecto (ver SEC-BEN-CODE-1) |
| SEC-BEN-3 | 🟡 | Validación de `type` solo en DB | ✅ Resuelto — `assertValidPlanType()` en dominio + `z.enum()` en controller |
| SEC-BEN-4 | 🟡 | DELETE sin invariante de autorización | ✅ Resuelto — `requirePermission(BENEFITS, 'canEdit')` aplicado |

---

## Hallazgos — Modo Código

| ID | Categoría | Severidad | Descripción | Ubicación |
|---|---|---|---|---|
| SEC-BEN-CODE-1 | 2 — Autenticación y autorización | 🟠 Alto | Ownership check compara `user.id` (user UUID) vs `employeeId` (employee record UUID) — namespaces distintos; empleados siempre obtienen 403 en su propio endpoint | `benefits.controller.ts:119`, `get-employee-benefits.usecase.ts:37` |
| SEC-BEN-CODE-2 | 8 — Errores e información | 🟡 Medio | `throw err` en `handleError()` propaga errores inesperados al handler global de Hono, que puede incluir stack traces en ciertas configuraciones | `benefits.controller.ts:47` |
| SEC-BEN-CODE-3 | 2 — Autenticación y autorización | 🟡 Medio | Parámetros de ruta `:id` y `:planId` no validados como UUID — strings inválidos llegan a PostgreSQL y producen error de tipo sin pasar por `handleError()` | `benefits.controller.ts:100, 135, 152, 113` |

---

## Detalle de hallazgos (Modo Código)

### SEC-BEN-CODE-1 — Ownership check con namespaces incorrectos

- **Severidad**: 🟠 Alto
- **Categoría**: 2 — Autenticación y autorización
- **Descripción**: La función `verifyJwt()` en `jwt-token.service.ts:109` reconstruye `AuthenticatedUser` con `{ id: payload.sub, email, role }` — omite `employeeId` aunque el JWT lo lleva (se genera en la línea 44). La interfaz `AuthenticatedUser` no declara `employeeId`. El controller pasa `user.id` (UUID del usuario) como `requestingUserId`, pero la URL `:id` es el UUID del registro de empleado. Estos son identificadores de tablas distintas: `users.id ≠ employees.id`. El resultado es que `isOwner` siempre es `false` para empleados regulares, y como tampoco tienen rol de manager, todos reciben `ForbiddenError`.
- **Vector de ataque**: No es un vector de exposición de datos — falla de forma segura (deniega). El impacto es que el rol `employee` no puede acceder al endpoint `/benefits/my` aunque tiene permiso `canView`. Abre a confusión operacional y eventual intentos de escalar privilegios para obtener acceso.
- **Ubicación**: `jwt-token.service.ts:44,68,109`, `benefits.controller.ts:118-119`, `get-employee-benefits.usecase.ts:37`
- **Remediación**:
  1. Añadir `employeeId?: string` a la interfaz `AuthenticatedUser` en `packages/core/src/contracts/auth.ts`
  2. Extraer `employeeId` en `verifyJwt()`: `return { id: payload.sub, email, role, employeeId: payload.employeeId ?? undefined }`
  3. Extraer `employeeId` en `verifyAccessToken()`: misma línea 68
  4. En `benefits.controller.ts:118` usar `requestingUserId: user.employeeId ?? user.id` para que el check de ownership sea correcto

---

### SEC-BEN-CODE-2 — `throw err` en handleError puede filtrar stack traces

- **Severidad**: 🟡 Medio
- **Categoría**: 8 — Errores e información
- **Descripción**: La función `handleError()` termina con `throw err` para errores no catalogados. En Hono, esto resulta en un rechazo que llega al handler global de la app. Si ese handler no está configurado para enmascarar el stack, el cliente puede recibir detalles internos (nombre de tabla, ruta de archivo, versión de dependencia) en la respuesta 500.
- **Vector de ataque**: Un error inesperado de Postgres (e.g., connection timeout, constraint violation no prevista) llega como `throw err` → Hono devuelve la excepción raw con su stack trace al cliente.
- **Ubicación**: `benefits.controller.ts:47`
- **Remediación**: Reemplazar `throw err` por `return c.json({ error: 'Internal server error' }, 500)`. Loguear el error internamente antes.

---

### SEC-BEN-CODE-3 — Parámetros de ruta no validados como UUID

- **Severidad**: 🟡 Medio
- **Categoría**: 2 — Autenticación y autorización
- **Descripción**: Los parámetros de ruta `:id` (employeeId) y `:planId` en los endpoints de inscripción no son validados como UUID antes de pasarlos a los use cases y al repositorio. Si un cliente envía `GET /employees/not-a-uuid/benefits`, PostgreSQL lanza `invalid input syntax for type uuid` que no es una instancia de ningún error de dominio, pasa directamente por `throw err` en `handleError()`, y llega como excepción sin manejo estructurado al handler global.
- **Vector de ataque**: Un atacante envía rutas con UUIDs malformados para obtener mensajes de error de PostgreSQL que revelan el nombre de la columna y el tipo de dato esperado.
- **Ubicación**: `benefits.controller.ts:100, 113, 135, 152`
- **Remediación**: Añadir validación Zod en el path param mediante `zValidator('param', z.object({ id: z.string().uuid() }))` en cada ruta que recibe un UUID. Alternativamente, manejar el error de PostgreSQL en `handleError()` detectando el mensaje de error de tipo UUID y devolviendo 422.

---

## Categorías auditadas (Modo Código)

| # | Categoría | Estado | Hallazgos |
|---|---|---|---|
| 1 | Secretos y configuración | ✅ auditada | 0 — sin credenciales hardcodeadas, ENV vars correctas |
| 2 | Autenticación y autorización | ✅ auditada | 2 — SEC-BEN-CODE-1 (🟠), SEC-BEN-CODE-3 (🟡) |
| 3 | Inyección | ✅ auditada | 0 — todas las queries usan tagged templates de postgres.js (parameterized) |
| 4 | Datos sensibles | ✅ auditada | 0 — costo/proveedor no son PII; no se expone más de lo necesario |
| 5 | Dependencias y supply chain | ⚠️ N/A — sin dependencias nuevas en este feature | 0 |
| 6 | Infraestructura | ✅ auditada | 0 — FK constraints presentes, índices definidos, sin puertos nuevos expuestos |
| 7 | Criptografía | ⚠️ N/A — sin operaciones criptográficas | 0 |
| 8 | Errores e información | ✅ auditada | 1 — SEC-BEN-CODE-2 (🟡) |
| 9 | Frontend | ✅ auditada | 0 — no usa localStorage para datos sensibles; lógica de auth solo en backend |
| 10 | Arquitectura y diseño | ✅ auditada | 0 — validación en dominio, puertos limpios, sin violaciones de capas |
| 11 | Memoria | ⚠️ N/A — TypeScript/Node.js, sin gestión manual de memoria | 0 |

---

## Verificación manual requerida

- [ ] Verificar que el handler global de errores en `packages/api/src/index.ts` enmascara stacks antes de servir la respuesta 500 (relacionado con SEC-BEN-CODE-2)
- [ ] Confirmar en runtime que con el fix de SEC-BEN-CODE-1, un empleado autenticado puede acceder a `/employees/:suEmployeeId/benefits` y recibe su propio listado

---

## Próximo paso

Sin hallazgos 🔴 críticos — **el pipeline no está bloqueado**.

**SEC-BEN-CODE-1 (🟠)** debe resolverse antes del deploy: los empleados no pueden acceder a sus propios beneficios con el código actual. La remediación es pequeña (4 líneas en 2 archivos). Puede resolverse ahora o registrarse como deuda técnica de prioridad alta.

Continuar con **Fase 8 — Consolidación** del pipeline.
