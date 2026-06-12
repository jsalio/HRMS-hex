# Impact Analysis: hrms-auth-roles

**Feature**: Autenticación JWT + roles/permisos + app shell i18n
**Spec de origen**: docs/specs/hrms-auth-roles.spec.md
**Fecha**: 2026-06-12
**Epicentro del cambio**: Tablas `users`, `roles`, `role_permissions`, `refresh_tokens` + middleware JWT + app shell Angular
**Tipo de cambio**: Aditivo puro (proyecto nuevo) — sin código existente que romper

---

## Resumen ejecutivo

Por ser el sub-spec #1 de un proyecto desde cero, no hay riesgo de romper código existente. El riesgo real es **tomar aquí decisiones que los 9 sub-specs restantes hereden y no puedan cambiar sin una migración o refactor global**. Hay 4 decisiones de diseño con ese carácter: la estructura del JWT payload, los nombres exactos de módulos en `role_permissions`, la firma de `PermissionGuard`, y la estructura de namespaces i18n. Además se identifican 3 gaps de seguridad que deben resolverse antes de implementar.

---

## Mapa de zonas afectadas

| Archivo / Módulo | Capa | Tipo de cambio | Severidad |
|---|---|---|---|
| `packages/core/src/contracts/auth.ts` | Dominio/Contratos | NUEVO | 🟠 ALTO — contrato que 9 sub-specs importarán |
| `packages/core/src/contracts/roles.ts` | Dominio/Contratos | NUEVO | 🟠 ALTO — `PermissionService` usado por todos |
| `packages/api/src/middleware/auth.middleware.ts` | API | NUEVO | 🟠 ALTO — todos los endpoints protegidos dependen de esto |
| `packages/api/src/middleware/permission.middleware.ts` | API | NUEVO | 🟠 ALTO — `PermissionGuard(module, action)` debe ser correcto desde el día 1 |
| `role_permissions.module CHECK constraint` | DB | NUEVO | 🟠 ALTO — lista de módulos hardcodeada; agregar módulo nuevo = migración |
| `users.employee_id FK` | DB | diferida | 🟡 MEDIO — se crea sin FK; hrms-employees agrega la FK en su migración |
| `apps/hrms-ui/src/app/app.module.ts` | UI | NUEVO | 🟡 MEDIO — TranslateModule configurado aquí; error aquí rompe toda la UI |
| `apps/hrms-ui/src/assets/i18n/` | UI | NUEVO | 🟡 MEDIO — estructura de namespaces; cambios rompen traducciones de otros sub-specs |
| `apps/hrms-ui/src/app/shell/` | UI | NUEVO | 🟡 MEDIO — routing del sidebar; cada sub-spec agrega sus rutas aquí |
| `packages/boundary-postgres/migrations/001_auth_roles.sql` | Infra | NUEVO | 🟢 BAJO — migración base |
| `apps/hrms-ui/src/app/auth/` | UI | NUEVO | 🟢 BAJO — solo afecta login |
| `apps/hrms-ui/src/app/roles/` | UI | NUEVO | 🟢 BAJO — solo afecta gestión de roles |

---

## Side-effects por severidad

### 🟠 Altos — Decisiones que no se pueden cambiar después sin impacto global

**1. Estructura del JWT payload**
El payload que retorna `POST /auth/login` incluye `user.role.permissions: RolePermission[]`. Este payload lo leen el `AuthGuard` y el `PermissionGuard` de **todos** los sub-specs. Si se cambia el nombre del campo (ej. `permissions` → `perms`) después de implementar hrms-employees, todos los guards fallan silenciosamente (no error, solo acceso denegado).
- **Acción**: definir y congelar la interfaz `AuthenticatedUser` en `packages/core/src/contracts/auth.ts` antes de continuar con el sub-spec #2.

**2. Nombres de módulos en `role_permissions.module`**
El CHECK constraint hardcodea: `'dashboard','employees','attendance','payroll','reports','settings','documents','absences','benefits','recruitment','notifications'`. Cada `PermissionGuard('employees', 'view')` que escriban los sub-specs 2-10 debe usar exactamente estos strings. Un typo es un fallo silencioso de permisos.
- **Acción**: exportar estas cadenas como un enum `AppModule` en `packages/core/src/contracts/roles.ts` — nunca usar strings literales en los guards.

**3. Firma de `PermissionGuard`**
Todos los sub-specs protegerán rutas con `PermissionGuard`. Si la firma cambia de `PermissionGuard(module, action)` a cualquier otra forma después del sub-spec #2, hay que tocar todas las rutas del sistema.
- **Acción**: definir y congelar la interfaz del guard en este sub-spec.

**4. Estructura de namespaces i18n**
La estructura `{ "module": { "key": "..." } }` se establece aquí. Si se cambia (ej. de `employees.title` a `employee.title`) después de que hrms-employees escriba sus traducciones, los textos silenciosamente muestran la clave en lugar de la traducción.
- **Acción**: documentar la convención de namespacing en un comentario en `es.json` raíz.

### 🟡 Medios — Requieren atención pero no bloquean otros sub-specs

**5. FK diferida `users.employee_id`**
La tabla `users` se crea sin la FK a `employees` (que no existe todavía). `hrms-employees` deberá agregar `ALTER TABLE users ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id)` en su migración `002`. Si se olvida, la relación user↔employee queda sin integridad referencial.
- **Acción**: documentar esta FK pendiente explícitamente en el spec de hrms-employees.

**6. Seed de roles del sistema**
El seed inserta los 4 roles (`super_admin`, `hr_manager`, `finance`, `employee`) en la migración. Si se ejecuta dos veces (ej. en CI que resetea la DB), fallará por el UNIQUE constraint. Debe ser idempotente.
- **Acción**: usar `INSERT ... ON CONFLICT DO NOTHING` en el seed.

**7. Routing del app shell**
El sidebar se construye aquí con rutas hacia módulos que aún no existen. Las rutas de los módulos 2-10 serán lazy-loaded. El `RouterModule` del AppShell necesita un `routes` array que se irá completando con cada sub-spec.
- **Acción**: definir las rutas como `loadChildren: () => import('...')` con paths ya fijos desde el inicio; cada sub-spec solo crea el módulo en esa ruta esperada.

### 🟢 Bajos — Recomendados pero no bloqueantes

**8. `app-root` component**
Angular necesita un componente raíz. Al ser proyecto nuevo, hay que decidir si el app shell vive en `AppComponent` directamente o en un `ShellComponent` separado. Recomendado: `AppComponent` solo hace el router-outlet; `ShellComponent` tiene sidebar + header.

**9. Locale pipes Angular**
`@ngx-translate` maneja strings, pero las pipes `date` y `currency` de Angular necesitan el locale registrado con `registerLocaleData`. Hay que registrar `es`, `en-US` y `pt-BR` en `AppModule`. Si se omite, las fechas y monedas no se formatean correctamente en los sub-specs posteriores.

---

## Base de datos

- **Migración necesaria**: Sí — `001_auth_roles.sql`
- **Datos existentes en riesgo**: No (proyecto nuevo)
- **Seed idempotente requerido**: Sí — `INSERT INTO roles ... ON CONFLICT DO NOTHING`
- **FK diferida**: `users.employee_id` → se completa en migración `002_employees.sql`
- **Requisito PostgreSQL**: versión ≥ 13 para `gen_random_uuid()` nativo (sin extensión pgcrypto)

---

## Gaps de seguridad — deben resolverse antes de implementar

| # | Gap | Riesgo | Resolución |
|---|---|---|---|
| S1 | Sin rate limiting en `POST /auth/login` | Fuerza bruta de contraseñas | Implementar rate limit: 5 intentos / 15 min por IP/email en el middleware de Bun/Hono |
| S2 | JWT_SECRET no especificado | Si el secret es débil o estático en código, tokens fabricables | Variable de entorno `JWT_SECRET` obligatoria, mínimo 256 bits, validada al arrancar |
| S3 | Invariante `super_admin` = all permissions enforced solo en app | Si se inserta directo a DB, se puede quitar permiso al super_admin | Aceptable en v1; documentar que el invariante es de aplicación, no de DB |
| S4 | `refresh_token` almacenado como hash pero la rotación invalida solo el anterior | Un token robado antes de la rotación sigue siendo válido hasta que expire | Aceptable con TTL 7d; para v2 considerar refresh token families |

---

## Contratos que quedan congelados desde este sub-spec

Estos contratos **no pueden cambiar** sin impacto en los sub-specs 2-10:

```typescript
// packages/core/src/contracts/auth.ts
interface AuthenticatedUser {
  id: string
  email: string
  role: {
    id: string
    name: string
    permissions: Array<{
      module: AppModule        // ← enum, no string literal
      canView: boolean
      canCreate: boolean
      canEdit: boolean
      canDelete: boolean
      canExport: boolean
    }>
  }
}

// packages/core/src/contracts/roles.ts
enum AppModule {
  DASHBOARD      = 'dashboard',
  EMPLOYEES      = 'employees',
  ATTENDANCE     = 'attendance',
  PAYROLL        = 'payroll',
  REPORTS        = 'reports',
  SETTINGS       = 'settings',
  DOCUMENTS      = 'documents',
  ABSENCES       = 'absences',
  BENEFITS       = 'benefits',
  RECRUITMENT    = 'recruitment',
  NOTIFICATIONS  = 'notifications',
}

// Guard signature — congelado
// PermissionGuard(AppModule.EMPLOYEES, 'view')
```

---

## Puntos ciegos (verificación manual requerida)

- [ ] Confirmar versión de PostgreSQL disponible en el servidor de deploy (necesita ≥ 13 para `gen_random_uuid()` sin pgcrypto)
- [ ] Confirmar que Bun soporta la versión de `@ngx-translate/core` elegida (Angular CLI versión a definir)
- [ ] Verificar que el hosting/CDN del frontend sirve correctamente archivos `.json` de `src/assets/` sin caché agresivo (los archivos i18n deben recargarse al actualizar la app)
- [ ] Decidir si el `JWT_SECRET` se gestiona con un secret manager (AWS Secrets Manager, HashiCorp Vault) o variables de entorno planas — afecta el setup de CI/CD

---

## Checklist antes de implementar

- [ ] `AuthenticatedUser` interface definida y congelada en `packages/core/src/contracts/auth.ts`
- [ ] `AppModule` enum definido con los 11 módulos exactos del CHECK constraint
- [ ] `PermissionGuard` firma decidida y documentada
- [ ] Estructura de namespaces i18n documentada con ejemplo en `es.json`
- [ ] `JWT_SECRET` en variables de entorno del proyecto (`.env.example` con descripción)
- [ ] Rate limiting en login decidido (librería o middleware propio)
- [ ] Migración `001_auth_roles.sql` con seed idempotente (`ON CONFLICT DO NOTHING`)
- [ ] `registerLocaleData` para es/en/pt en `AppModule`
- [ ] Rutas lazy-loaded del sidebar definidas con paths fijos para los 10 módulos

---

## Próximo paso

Continuar con `/arch` para definir la estructura física de paquetes del monorepo y el mapeo hexagonal de este sub-spec.
