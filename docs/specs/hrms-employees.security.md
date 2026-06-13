# Security Analysis: hrms-auth-roles + hrms-employees

**Feature**: Autenticación/roles (sub-spec 1) + gestión de empleados (sub-spec 2)
**Modo**: Código (Modo B — implementación completa)
**Fecha**: 2026-06-13
**Spec de origen**: docs/specs/hrms-auth-roles.md · docs/specs/hrms-employees.md
**Nivel de riesgo general**: 🟠 Alto

---

## Resumen ejecutivo

Análisis de 16 hallazgos: **0 críticos, 6 altos, 9 medios, 1 bajo**. El riesgo principal es la combinación de tokens de larga duración almacenados en `localStorage` junto con la ausencia de rate limiting en `/auth/login`, lo que abre vectores de brute-force y XSS-token-theft. No hay hallazgos críticos — el pipeline **no está bloqueado**, pero los 6 hallazgos 🟠 deben resolverse antes del primer deploy.

---

## Hallazgos

| ID | Categoría | Severidad | Descripción | Ubicación |
|---|---|---|---|---|
| SEC-1 | 1 — Secretos | 🟡 | Credenciales débiles de dev en docker-compose.yml commiteado | `docker-compose.yml:10,32` |
| SEC-2 | 2 — Auth | 🟠 | Timing attack — enumeración de usuarios por tiempo de respuesta en login | `login.usecase.ts:29,34` |
| SEC-3 | 2 — Auth | 🟠 | IDOR — sin filtro de ownership en `GET /employees/:id`; cualquier usuario con `canView` puede ver el salario de cualquier empleado | `employees.controller.ts:80` |
| SEC-4 | 3 — Inyección | 🟡 | `status: q.status as any` bypasea type-checking; parámetro no validado pasa al repositorio | `employees.controller.ts:54` |
| SEC-5 | 4 — Datos | 🟡 | Sin HTTPS en docker-compose.yml — todo el tráfico es HTTP plano | `docker-compose.yml` |
| SEC-6 | 4 — Datos | 🟢 | Hono logger activo — no loguea bodies por defecto, riesgo bajo | `packages/api/src/index.ts:15` |
| SEC-7 | 5 — Dependencias | 🟠 | 47 vulnerabilidades conocidas en npm de Angular UI (29 high, 13 moderate) | `apps/hrms-ui/package.json` |
| SEC-8 | 6 — Infra | 🟠 | Sin rate limiting en `POST /auth/login` — brute-force irrestricto | `auth.controller.ts:29` |
| SEC-9 | 6 — Infra | 🟠 | Puerto PostgreSQL 5432 expuesto al host en docker-compose.yml | `docker-compose.yml:12` |
| SEC-10 | 6 — Infra | 🟡 | Sin cap en el parámetro `limit` de paginación — potencial DoS por consultas masivas | `employees.controller.ts:57` |
| SEC-11 | 6 — Infra | 🟡 | Sin headers HTTP de seguridad (CSP, X-Frame-Options, HSTS, X-Content-Type-Options) | `packages/api/src/index.ts` |
| SEC-12 | 7 — Crypto | 🟡 | `container.ts` valida presencia de `JWT_SECRET` pero no longitud mínima (256 bits = 64 chars hex) | `packages/api/src/container.ts:13` |
| SEC-13 | 8 — Errores | 🟡 | Sin error handler global — excepciones no controladas pueden exponer stack traces | `packages/api/src/index.ts` |
| SEC-14 | 8 — Errores | 🟡 | Sin audit trail para operaciones críticas (login, cambios de rol, terminaciones) | global |
| SEC-15 | 9 — Frontend | 🟠 | Access token y refresh token ambos en `localStorage` — legibles por cualquier XSS | `auth.service.ts:23-24` |
| SEC-16 | 9 — Frontend | 🟡 | Lógica de autorización `super_admin` implementada en cliente sin validación equivalente de UI | `auth.service.ts:61` |

---

## Detalle de hallazgos

### SEC-1 — Credenciales de desarrollo commiteadas en docker-compose.yml
- **Severidad**: 🟡 Medio
- **Categoría**: 1 — Secretos y configuración
- **Descripción**: `JWT_SECRET` con valor `0000…0000dev` y `POSTGRES_PASSWORD: hrms_dev` están en el repositorio. El comentario advierte cambiarlos en producción, pero no hay mecanismo que lo fuerce.
- **Vector de ataque**: Si alguien accede al repositorio (breach de código, repo público, CI logs), obtiene credenciales válidas. Un deploy descuidado que omita sobreescribir estas variables expone la BD y puede forjar JWT arbitrarios.
- **Ubicación**: `docker-compose.yml:10` (POSTGRES_PASSWORD), `docker-compose.yml:32` (JWT_SECRET)
- **Remediación**: Crear `docker-compose.override.yml` (gitignored) para los valores de producción. Documentar en README que las variables deben ser sobreescritas. Considerar usar `docker secret` o un `.env` gitignored con valores de ejemplo en `.env.example`.

---

### SEC-2 — Timing attack: enumeración de usuarios en login
- **Severidad**: 🟠 Alto
- **Categoría**: 2 — Autenticación y autorización
- **Descripción**: En `login.usecase.ts`, si el email no existe (línea 29), se lanza `UnauthorizedError()` inmediatamente sin llamar a `passwordSvc.verify()`. Si el email existe pero la contraseña es incorrecta (línea 34), se llama a `bcrypt.verify()` que toma ~100ms. La diferencia de tiempo es observable y permite a un atacante enumerar qué emails tienen cuenta en el sistema.
- **Vector de ataque**: El atacante envía peticiones con emails conocidos. Si la respuesta es rápida (~1ms), el email no existe. Si la respuesta tarda ~100ms, el email es válido aunque la contraseña sea incorrecta.
- **Ubicación**: `packages/core/src/usecases/login.usecase.ts:29,34`
- **Remediación**:
  ```typescript
  const user = await this.userRepo.findByEmail(input.email)
  // Siempre llamar verify — si no hay user, comparar contra un hash dummy
  const dummyHash = '$2b$10$dummyhashtopreventtimingattacks000000000000000000000000'
  const passwordValid = await this.passwordSvc.verify(
    input.password,
    user?.passwordHash ?? dummyHash
  )
  if (!user || !passwordValid) throw new UnauthorizedError()
  ```

---

### SEC-3 — IDOR: sin filtro de ownership en GET /employees/:id
- **Severidad**: 🟠 Alto
- **Categoría**: 2 — Autenticación y autorización
- **Descripción**: `GET /employees/:id` devuelve el detalle completo de cualquier empleado (incluyendo salario, documentId, fecha de contratación) a cualquier usuario con permiso `canView` en el módulo EMPLOYEES. No hay verificación de que el usuario autenticado es el propio empleado o tiene un rol que le permite ver todos. Si el rol "Employee" recibe `canView: true` en alguna configuración, puede ver los datos de todos sus compañeros.
- **Vector de ataque**: Un empleado raso con `canView` puede iterar IDs (`/employees/emp-1`, `/employees/emp-2`, …) y extraer salarios y datos personales de toda la plantilla.
- **Ubicación**: `packages/api/src/controllers/employees.controller.ts:80-88`
- **Remediación**: Agregar verificación de ownership o restricción por rol. Opción A — filtrar por `employeeId` del usuario autenticado cuando el rol no es HR/Admin. Opción B — asegurar que el rol "Employee" recibe `canView: false` en EMPLOYEES y tiene un endpoint separado `/me` para su propio perfil. Opción B es más simple y correcta arquitectónicamente.

---

### SEC-4 — Parámetro `status` sin validar pasa al repositorio
- **Severidad**: 🟡 Medio
- **Categoría**: 3 — Inyección / validación
- **Descripción**: `q.status as any` bypasea el sistema de tipos sin validar el valor. Aunque postgres.js previene SQL injection, un valor inesperado puede causar filtros silenciosos (sin resultados, o todos los resultados si la capa repositorio hace comparación directa que no coincide).
- **Vector de ataque**: `GET /employees?status=DELETED` o `status=1; DROP TABLE` — el primero retorna resultado vacío silencioso (confusion attack), el segundo es inofensivo por parametrización pero revela falta de validación.
- **Ubicación**: `packages/api/src/controllers/employees.controller.ts:54`
- **Remediación**:
  ```typescript
  const STATUS_FILTER = z.enum(['ACTIVE', 'REMOTE', 'ON_LEAVE', 'INACTIVE']).optional()
  // En el handler:
  const parsed = STATUS_FILTER.safeParse(q.status)
  status: parsed.success ? parsed.data : undefined,
  ```
  La constante `EMPLOYEE_STATUS` ya está definida en el mismo archivo (línea 14) — reutilizarla.

---

### SEC-5 — Sin HTTPS en docker-compose.yml
- **Severidad**: 🟡 Medio
- **Categoría**: 4 — Datos sensibles
- **Descripción**: Toda la comunicación entre UI y API es HTTP plano. Credenciales de login, tokens JWT y datos de empleados (salarios, documentIds) viajan sin cifrado.
- **Vector de ataque**: En redes locales o WiFi compartido, cualquier sniffer puede capturar credenciales y tokens en texto plano.
- **Ubicación**: `docker-compose.yml` (sin configuración TLS)
- **Remediación**: Para producción, agregar un reverse proxy (nginx/Caddy) con terminación TLS. Para desarrollo local no es crítico, pero documentarlo explícitamente.

---

### SEC-6 — Hono logger activo en todos los endpoints
- **Severidad**: 🟢 Bajo
- **Categoría**: 4 — Datos sensibles
- **Descripción**: `app.use('*', logger())` loguea todas las peticiones. El logger por defecto de Hono registra método, path, status y tiempo — no loguea headers ni bodies. Riesgo bajo en la configuración actual.
- **Vector de ataque**: Si el logger se modifica para incluir headers o body en el futuro, los tokens y contraseñas aparecerían en logs.
- **Ubicación**: `packages/api/src/index.ts:15`
- **Remediación**: Mantener el logger en su forma actual. Si se necesita logging extendido, asegurarse de filtrar `Authorization` header y el campo `password`.

---

### SEC-7 — 47 vulnerabilidades en dependencias npm de Angular UI
- **Severidad**: 🟠 Alto
- **Categoría**: 5 — Dependencias y supply chain
- **Descripción**: El build de Docker reportó 47 vulnerabilidades (29 high, 13 moderate, 5 low) en las dependencias de `apps/hrms-ui`. Muchas pueden ser de herramientas de build que no llegan al bundle de producción, pero deben auditarse.
- **Vector de ataque**: Dependencias comprometidas con CVEs conocidos pueden ser explotadas si sus vectores son accesibles en el bundle final o en el servidor de desarrollo.
- **Ubicación**: `apps/hrms-ui/package.json`
- **Remediación**: Ejecutar `npm audit --production` para distinguir vulnerabilidades de producción vs desarrollo. Ejecutar `npm audit fix` para las resolubles sin breaking changes. Agregar `npm audit --audit-level=high --production` como gate en CI.

---

### SEC-8 — Sin rate limiting en POST /auth/login
- **Severidad**: 🟠 Alto
- **Categoría**: 6 — Infraestructura
- **Descripción**: El endpoint `POST /auth/login` no tiene rate limiting. Un atacante puede intentar contraseñas sin límite, convirtiendo el timing attack (SEC-2) en un vector de brute-force completo.
- **Vector de ataque**: Ataque de diccionario o brute-force contra emails conocidos. Con bcrypt a ~100ms/intento, 10 peticiones paralelas = 6 intentos/segundo por IP.
- **Ubicación**: `packages/api/src/controllers/auth.controller.ts:29`
- **Remediación**: Añadir middleware de rate limiting (ej. `hono-rate-limiter` o similar). Configurar `max: 10, windowMs: 15 * 60 * 1000` (10 intentos por 15 minutos por IP) en `/auth/login` y `/auth/refresh`.

---

### SEC-9 — Puerto PostgreSQL expuesto al host
- **Severidad**: 🟠 Alto
- **Categoría**: 6 — Infraestructura
- **Descripción**: `docker-compose.yml` expone el puerto 5432 de PostgreSQL al host con `ports: "5432:5432"`. Cualquier proceso o usuario del host (y en red local si el firewall lo permite) puede conectarse directamente a la base de datos sin pasar por la API.
- **Vector de ataque**: Un atacante con acceso a la red puede conectarse a PostgreSQL con credenciales `hrms/hrms_dev` y leer/modificar datos directamente, bypasseando toda la lógica de permisos de la API.
- **Ubicación**: `docker-compose.yml:12`
- **Remediación**: Quitar el mapping de puerto del servicio `db`:
  ```yaml
  db:
    # Sin "ports" — solo accesible dentro de la red Docker interna
  ```
  Para acceso de administración, usar `docker exec -it expriments-db-1 psql -U hrms`.

---

### SEC-10 — Sin cap en el parámetro `limit` de paginación
- **Severidad**: 🟡 Medio
- **Categoría**: 6 — Infraestructura
- **Descripción**: `GET /employees?limit=999999` pasa el número sin validación al repositorio. Una consulta masiva puede saturar la base de datos y la memoria del proceso.
- **Vector de ataque**: DoS de baja intensidad — un usuario autenticado con `canView` puede degradar el servicio para otros.
- **Ubicación**: `packages/api/src/controllers/employees.controller.ts:57`
- **Remediación**:
  ```typescript
  const MAX_LIMIT = 100
  limit: q.limit ? Math.min(Number(q.limit), MAX_LIMIT) : undefined,
  ```

---

### SEC-11 — Sin headers HTTP de seguridad
- **Severidad**: 🟡 Medio
- **Categoría**: 6 — Infraestructura
- **Descripción**: La API no envía `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, ni `Referrer-Policy`. El UI servido por Angular CLI tampoco los configura.
- **Vector de ataque**: Sin `X-Frame-Options`, la UI puede ser embedida en iframes para ataques de clickjacking. Sin `X-Content-Type-Options`, el browser puede interpretar respuestas con tipo incorrecto.
- **Ubicación**: `packages/api/src/index.ts`
- **Remediación**: Agregar middleware de security headers en Hono:
  ```typescript
  import { secureHeaders } from 'hono/secure-headers'
  app.use('*', secureHeaders())
  ```
  Hono incluye `secureHeaders` en su librería estándar — aplica X-Frame-Options, X-Content-Type-Options, Referrer-Policy y más con una sola línea.

---

### SEC-12 — JWT_SECRET sin validación de longitud mínima
- **Severidad**: 🟡 Medio
- **Categoría**: 7 — Criptografía
- **Descripción**: `container.ts:13-14` valida que `JWT_SECRET` existe, pero no que tenga la longitud mínima segura (256 bits = 64 caracteres hex). Un secret corto es vulnerable a brute-force.
- **Vector de ataque**: Si alguien configura `JWT_SECRET=secret` (6 chars), un atacante puede brute-forcear el secret y forjar tokens JWT válidos para cualquier usuario.
- **Ubicación**: `packages/api/src/container.ts:13-14`
- **Remediación**:
  ```typescript
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) throw new Error('JWT_SECRET is required')
  if (jwtSecret.length < 64) throw new Error('JWT_SECRET must be at least 64 characters (256 bits)')
  ```

---

### SEC-13 — Sin error handler global — potencial exposición de stack traces
- **Severidad**: 🟡 Medio
- **Categoría**: 8 — Manejo de errores
- **Descripción**: Los controladores hacen `throw err` para errores no esperados. Hono en modo desarrollo puede devolver stack traces en el response 500. No se configura un error handler explícito que garantice respuestas genéricas.
- **Vector de ataque**: Una excepción no manejada (ej. error de BD inesperado) expone nombres de tablas, rutas de archivos, o versiones de dependencias en la respuesta HTTP.
- **Ubicación**: `packages/api/src/index.ts` (falta `app.onError`)
- **Remediación**:
  ```typescript
  app.onError((err, c) => {
    console.error('[unhandled]', err)
    return c.json({ error: 'Internal server error' }, 500)
  })
  ```

---

### SEC-14 — Sin audit trail para operaciones críticas
- **Severidad**: 🟡 Medio
- **Categoría**: 8 — Manejo de errores / trazabilidad
- **Descripción**: Operaciones de alto impacto (login exitoso/fallido, cambios de rol, creación/terminación de empleados, cambios de permisos) no dejan registro de auditoría con timestamp, usuario que ejecutó la acción, y datos anteriores/nuevos.
- **Vector de ataque**: Si hay un incidente de seguridad (acceso no autorizado, cambio de permisos malicioso), es imposible reconstruir la secuencia de eventos.
- **Ubicación**: global — todos los use cases críticos
- **Remediación**: Crear tabla `audit_log` (actor_id, action, entity_type, entity_id, metadata JSON, created_at). Llamar desde los use cases de auth y employees al completar operaciones. Prioridad: login + cambios de rol + terminación de empleados.

---

### SEC-15 — Access token y refresh token en localStorage
- **Severidad**: 🟠 Alto
- **Categoría**: 9 — Frontend
- **Descripción**: `auth.service.ts:23-24` almacena ambos tokens en `localStorage`. Cualquier XSS (incluyendo en dependencias npm) puede leer y exfiltrar ambos tokens. El refresh token tiene vida de 7 días — un atacante que lo obtiene mantiene acceso persistente.
- **Vector de ataque**: Un script XSS inyectado (o en una dependencia comprometida) ejecuta `localStorage.getItem('hrms_refresh_token')` y envía el token a un servidor externo. El atacante rota el refresh token para obtener un access token y toma control de la sesión.
- **Ubicación**: `apps/hrms-ui/src/app/core/services/auth.service.ts:23-24`
- **Remediación**: Mover el refresh token a una cookie `httpOnly; Secure; SameSite=Strict` configurada desde el servidor. El access token puede mantenerse en memoria (no en `localStorage`) o en una cookie httpOnly de corta duración. Requiere modificar el endpoint `POST /auth/login` para setear la cookie en la respuesta y ajustar el flujo de refresh.

---

### SEC-16 — Lógica de autorización `super_admin` implementada solo en cliente
- **Severidad**: 🟡 Medio
- **Categoría**: 9 — Frontend
- **Descripción**: `auth.service.ts:61` usa `user.role.name === 'super_admin'` para decisiones de UI (mostrar/ocultar elementos). El objeto `user` viene del JWT almacenado en localStorage y puede ser manipulado. Si alguien modifica el objeto en localStorage para simular `super_admin`, verá UI adicional — aunque el backend sigue aplicando los permisos reales.
- **Vector de ataque**: El atacante modifica `localStorage['hrms_user']` para incluir `role.name: 'super_admin'`. Ve menús y botones de admin, pero las llamadas a la API fallan con 403. Impacto real: bajo (UI deception, no escalación de privilegios real). Impacto de confianza: medio.
- **Ubicación**: `apps/hrms-ui/src/app/core/services/auth.service.ts:61`
- **Remediación**: Extraer `isSuperAdmin` a una computed property que usa los permisos del rol (módulos con todos los flags en `true`) en lugar del nombre del rol. No depender de `role.name` hardcodeado en el cliente.

---

## Categorías auditadas

| # | Categoría | Estado | Hallazgos |
|---|---|---|---|
| 1 | Secretos y configuración | ✅ auditada | 1 (SEC-1) |
| 2 | Autenticación y autorización | ✅ auditada | 2 (SEC-2, SEC-3) |
| 3 | Inyección | ✅ auditada | 1 (SEC-4) |
| 4 | Datos sensibles | ✅ auditada | 2 (SEC-5, SEC-6) |
| 5 | Dependencias y supply chain | ✅ auditada | 1 (SEC-7) |
| 6 | Infraestructura | ✅ auditada | 4 (SEC-8, SEC-9, SEC-10, SEC-11) |
| 7 | Criptografía | ✅ auditada | 1 (SEC-12) |
| 8 | Errores e información | ✅ auditada | 2 (SEC-13, SEC-14) |
| 9 | Frontend | ✅ auditada | 2 (SEC-15, SEC-16) |
| 10 | Arquitectura y diseño | ✅ auditada | 0 — SEC-3 y SEC-4 la cubren |
| 11A | Memoria — memory attacks | ⚠️ N/A | Stack TypeScript/JS: GC managed, no buffer operations |
| 11B | Memoria — retención de datos | ✅ auditada | 0 — sin colecciones de crecimiento ilimitado |

---

## Verificación manual requerida

- [ ] Confirmar que el rol "Employee" tiene `canView: false` en el módulo EMPLOYEES en el seed. Si tiene `canView: true`, SEC-3 escala a 🔴 Crítico.
- [ ] Ejecutar `npm audit --production` en `apps/hrms-ui` para determinar cuántas de las 47 vulnerabilidades (SEC-7) afectan el bundle de producción vs herramientas de build.
- [ ] Verificar que `hono/logger` no loguea el header `Authorization` en ninguna configuración de producción (SEC-6).
- [ ] Validar que el proceso de deploy en producción sobreescribe `JWT_SECRET` y `POSTGRES_PASSWORD` del docker-compose con valores fuertes (SEC-1).

---

## Próximo paso

Sin hallazgos 🔴 — el pipeline **no está bloqueado**. Antes del primer deploy a staging o producción, resolver en este orden de prioridad:

1. **SEC-9** — quitar exposición de puerto PostgreSQL (5 minutos, sin código)
2. **SEC-8** — agregar rate limiting en `/auth/login`
3. **SEC-11** — agregar `secureHeaders()` middleware (1 línea)
4. **SEC-13** — agregar `app.onError` global (3 líneas)
5. **SEC-12** — validar longitud de `JWT_SECRET` en startup (2 líneas)
6. **SEC-4** — validar `status` con `EMPLOYEE_STATUS.optional()` (ya existe la constante)
7. **SEC-10** — agregar cap `Math.min(limit, 100)`
8. **SEC-2** — agregar hash dummy para timing attack en login
9. **SEC-15** — mover refresh token a cookie httpOnly (requiere cambio de contrato API)
10. **SEC-3** — definir política de acceso para rol Employee (endpoint `/me` vs filtro por rol)
