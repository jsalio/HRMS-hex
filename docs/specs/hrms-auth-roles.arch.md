# Architecture Decision: hrms-auth-roles

**Feature**: Autenticación JWT + roles/permisos + app shell i18n
**Spec de origen**: docs/specs/hrms-auth-roles.spec.md
**Fecha**: 2026-06-12
**Modo**: Definición nueva (proyecto desde cero)
**Patrón arquitectónico**: Hexagonal (Ports & Adapters) — monorepo con Bun workspaces

---

## Patrón definido

### Descripción

Arquitectura hexagonal pura: el **Core** es el hexágono central — contiene contratos (puertos), entidades de dominio y casos de uso. No tiene dependencias externas. Los **Boundaries** son adaptadores de salida (implementan los puertos del Core). El **API package** es el adaptador de entrada (HTTP). La **UI Angular** consume el API.

```
┌─────────────────────────────────────────────────────────────┐
│  apps/hrms-ui  (Angular — adaptador de entrada visual)       │
│    └── consume HTTP API                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────────┐
│  packages/api  (Hono/Bun — adaptador de entrada HTTP)        │
│    ├── controllers/   ← driving adapters                     │
│    ├── middleware/    ← auth.middleware, permission.middleware│
│    └── container.ts  ← composition root (DI manual)         │
└──────────────────────┬──────────────────────────────────────┘
                       │ import (usa contratos del Core)
┌──────────────────────▼──────────────────────────────────────┐
│  packages/core  (el hexágono — cero dependencias externas)   │
│    ├── contracts/     ← puertos (interfaces TS)              │
│    ├── domain/        ← entidades + invariantes              │
│    └── usecases/      ← orquestación de negocio             │
└──────────────────────┬──────────────────────────────────────┘
                       │ implementa contratos del Core
┌──────────────────────▼──────────────────────────────────────┐
│  packages/boundary-postgres  (adaptador de salida — DB)      │
│    ├── repositories/  ← implementan IUserRepository, etc.   │
│    └── migrations/    ← SQL puro                            │
└─────────────────────────────────────────────────────────────┘
```

### Regla de dependencias
```
api         →  core  (usa contratos, instancia use cases)
boundary-*  →  core  (implementa contratos)
hrms-ui     →  api   (consume HTTP, nunca importa paquetes TS del backend)
core        →  nadie (cero imports externos salvo tipos TS nativos)
```

---

## Estructura física del monorepo

```
hrms-hex/
├── package.json                  ← workspace root (Bun workspaces)
├── tsconfig.base.json            ← paths compartidos
├── .env.example
├── CHANGELOG.md
│
├── packages/
│   │
│   ├── core/                     ← El hexágono
│   │   ├── package.json          { "name": "@hrms/core" }
│   │   └── src/
│   │       ├── contracts/
│   │       │   ├── auth.ts       ← IAuthService, ITokenService, IUserRepository
│   │       │   ├── roles.ts      ← IRoleRepository, IPermissionService, AppModule enum
│   │       │   └── index.ts      ← re-exports públicos
│   │       ├── domain/
│   │       │   ├── user.ts       ← entidad User
│   │       │   ├── role.ts       ← entidad Role (invariante super_admin)
│   │       │   └── errors.ts     ← DomainError base + tipos (UnauthorizedError, etc.)
│   │       └── usecases/
│   │           ├── login.usecase.ts
│   │           ├── refresh-token.usecase.ts
│   │           └── manage-roles.usecase.ts
│   │
│   ├── boundary-postgres/        ← Adaptador PostgreSQL
│   │   ├── package.json          { "name": "@hrms/boundary-postgres", "dependencies": { "@hrms/core": "*" } }
│   │   └── src/
│   │       ├── client.ts         ← pool de conexiones (postgres.js)
│   │       ├── repositories/
│   │       │   ├── user.repository.ts   ← implementa IUserRepository
│   │       │   └── role.repository.ts   ← implementa IRoleRepository
│   │       └── migrations/
│   │           └── 001_auth_roles.sql
│   │
│   ├── boundary-slack/           ← Adaptador Slack (vacío hasta sub-spec 9)
│   │   └── package.json          { "name": "@hrms/boundary-slack" }
│   │
│   └── api/                      ← Adaptador HTTP (Hono + Bun)
│       ├── package.json          { "name": "@hrms/api", "dependencies": { "@hrms/core": "*", "@hrms/boundary-postgres": "*" } }
│       └── src/
│           ├── index.ts          ← entry point: new Hono(), app.route(), Bun.serve()
│           ├── container.ts      ← composition root (wiring manual)
│           ├── middleware/
│           │   ├── auth.middleware.ts        ← verifica JWT, inyecta user en ctx
│           │   └── permission.middleware.ts  ← PermissionGuard factory
│           ├── controllers/
│           │   ├── auth.controller.ts
│           │   └── roles.controller.ts
│           └── mappers/
│               ├── user.mapper.ts    ← domain User → UserDTO (nunca expone entity directa)
│               └── role.mapper.ts
│
└── apps/
    └── hrms-ui/                  ← Angular 17 standalone
        ├── package.json
        └── src/
            ├── main.ts           ← bootstrapApplication(AppComponent, appConfig)
            ├── app.config.ts     ← provideRouter, provideHttpClient, TranslateModule
            ├── app.component.ts  ← router-outlet únicamente
            ├── assets/
            │   └── i18n/
            │       ├── es.json
            │       ├── en.json
            │       └── pt.json
            └── app/
                ├── core/
                │   ├── guards/
                │   │   ├── auth.guard.ts        ← verifica token en localStorage
                │   │   └── permission.guard.ts  ← PermissionGuard(AppModule, action)
                │   ├── interceptors/
                │   │   └── auth.interceptor.ts  ← adjunta Bearer token + auto-refresh
                │   ├── services/
                │   │   └── auth.service.ts      ← login/logout/token management
                │   └── models/
                │       └── auth.models.ts       ← AuthenticatedUser interface (espejo del Core)
                ├── shell/
                │   ├── shell.component.ts       ← Smart: sidebar + header + router-outlet
                │   ├── sidebar/
                │   │   └── sidebar.component.ts ← Dumb: recibe navItems[], emite navigate
                │   └── header/
                │       └── header.component.ts  ← Dumb: usuario + selector de idioma
                ├── auth/
                │   └── login/
                │       ├── login-page.component.ts  ← Smart
                │       └── login-form.component.ts  ← Dumb
                └── roles/
                    ├── roles-page.component.ts      ← Smart
                    ├── roles-list.component.ts      ← Dumb
                    └── role-form.component.ts       ← Dumb (permission matrix)
```

---

## Mapeo del feature a la arquitectura

| Elemento del spec | Capa | Archivo | Responsabilidad |
|---|---|---|---|
| Entidad `Role` + invariante super_admin | Core/Domain | `packages/core/src/domain/role.ts` | Modelo + regla de negocio |
| Entidad `User` | Core/Domain | `packages/core/src/domain/user.ts` | Modelo + is_active check |
| `IUserRepository` | Core/Contracts | `packages/core/src/contracts/auth.ts` | Puerto de salida |
| `IRoleRepository` | Core/Contracts | `packages/core/src/contracts/roles.ts` | Puerto de salida |
| `ITokenService` | Core/Contracts | `packages/core/src/contracts/auth.ts` | Puerto de salida |
| `AppModule` enum | Core/Contracts | `packages/core/src/contracts/roles.ts` | Contrato congelado |
| `AuthenticatedUser` interface | Core/Contracts | `packages/core/src/contracts/auth.ts` | Contrato congelado |
| `LoginUseCase` | Core/UseCase | `packages/core/src/usecases/login.usecase.ts` | Orquesta auth |
| `RefreshTokenUseCase` | Core/UseCase | `packages/core/src/usecases/refresh-token.usecase.ts` | Rota token |
| `ManageRolesUseCase` | Core/UseCase | `packages/core/src/usecases/manage-roles.usecase.ts` | CRUD roles + permisos |
| `UserRepository` (impl) | Boundary-Postgres | `packages/boundary-postgres/src/repositories/user.repository.ts` | SQL queries |
| `RoleRepository` (impl) | Boundary-Postgres | `packages/boundary-postgres/src/repositories/role.repository.ts` | SQL queries |
| Migración `001` | Boundary-Postgres | `packages/boundary-postgres/src/migrations/001_auth_roles.sql` | DDL + seed |
| `AuthController` | API | `packages/api/src/controllers/auth.controller.ts` | Rutas HTTP auth |
| `RolesController` | API | `packages/api/src/controllers/roles.controller.ts` | Rutas HTTP roles |
| `auth.middleware` | API | `packages/api/src/middleware/auth.middleware.ts` | Verifica JWT |
| `permission.middleware` | API | `packages/api/src/middleware/permission.middleware.ts` | Guard factory |
| `container.ts` | API | `packages/api/src/container.ts` | Composition root |
| Login UI | Angular/Auth | `apps/hrms-ui/src/app/auth/login/` | Smart + Dumb |
| App Shell | Angular/Shell | `apps/hrms-ui/src/app/shell/` | Smart + 2 Dumb |
| Roles UI | Angular/Roles | `apps/hrms-ui/src/app/roles/` | Smart + 2 Dumb |
| `AuthGuard` | Angular/Core | `apps/hrms-ui/src/app/core/guards/auth.guard.ts` | Protege rutas |
| `PermissionGuard` | Angular/Core | `apps/hrms-ui/src/app/core/guards/permission.guard.ts` | Verifica permisos |

---

## Contratos entre capas

### Puerto de salida: `IUserRepository`
```typescript
// packages/core/src/contracts/auth.ts
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  create(data: CreateUserData): Promise<User>
  deactivate(id: string): Promise<User>
  setEmployee(userId: string, employeeId: string): Promise<void>  // usado en hrms-employees
}
```

### Puerto de salida: `IRoleRepository`
```typescript
// packages/core/src/contracts/roles.ts
export interface IRoleRepository {
  findAll(): Promise<Role[]>
  findById(id: string): Promise<Role | null>
  create(data: CreateRoleData): Promise<Role>
  update(id: string, data: UpdateRoleData): Promise<Role>
  delete(id: string): Promise<void>
}
```

### Puerto de salida: `ITokenService`
```typescript
// packages/core/src/contracts/auth.ts
export interface ITokenService {
  generateAccessToken(user: AuthenticatedUser): string
  verifyAccessToken(token: string): AuthenticatedUser
  generateRefreshToken(): string
  hashToken(token: string): string
}
```

### Contrato congelado: `AuthenticatedUser`
```typescript
// packages/core/src/contracts/auth.ts
export interface AuthenticatedUser {
  id: string
  email: string
  role: {
    id: string
    name: string
    permissions: Array<{
      module: AppModule
      canView: boolean
      canCreate: boolean
      canEdit: boolean
      canDelete: boolean
      canExport: boolean
    }>
  }
}
```

### Contrato congelado: `AppModule` enum
```typescript
// packages/core/src/contracts/roles.ts
export enum AppModule {
  DASHBOARD     = 'dashboard',
  EMPLOYEES     = 'employees',
  ATTENDANCE    = 'attendance',
  PAYROLL       = 'payroll',
  REPORTS       = 'reports',
  SETTINGS      = 'settings',
  DOCUMENTS     = 'documents',
  ABSENCES      = 'absences',
  BENEFITS      = 'benefits',
  RECRUITMENT   = 'recruitment',
  NOTIFICATIONS = 'notifications',
}
```

### DI — Composition root (Bun, sin framework)
```typescript
// packages/api/src/container.ts
import { sql } from '@hrms/boundary-postgres/client'
import { UserRepository } from '@hrms/boundary-postgres/repositories/user.repository'
import { RoleRepository } from '@hrms/boundary-postgres/repositories/role.repository'
import { JwtTokenService } from './services/jwt-token.service'
import { LoginUseCase } from '@hrms/core/usecases/login.usecase'
import { ManageRolesUseCase } from '@hrms/core/usecases/manage-roles.usecase'

// Instanciación manual — cada dependencia explícita, nada mágico
const userRepo   = new UserRepository(sql)
const roleRepo   = new RoleRepository(sql)
const tokenSvc   = new JwtTokenService(process.env.JWT_SECRET!)

export const loginUseCase       = new LoginUseCase(userRepo, roleRepo, tokenSvc)
export const manageRolesUseCase = new ManageRolesUseCase(roleRepo)
// Los controllers importan de container.ts, no instancian nada
```

### PermissionGuard factory (Angular)
```typescript
// apps/hrms-ui/src/app/core/guards/permission.guard.ts
export const permissionGuard = (module: AppModule, action: keyof Omit<RolePermission,'module'>) =>
  inject(AuthService).hasPermission(module, action)
    ? true
    : inject(Router).createUrlTree(['/forbidden'])

// Uso en routing (todos los sub-specs usan esta firma):
{
  path: 'employees',
  canActivate: [() => permissionGuard(AppModule.EMPLOYEES, 'canView')],
  loadComponent: () => import('../employees/employees-page.component')
}
```

---

## Decisiones arquitectónicas

| # | Decisión | Motivo | Alternativa descartada |
|---|---|---|---|
| 1 | Bun workspaces (no Nx, no Turborepo) | Proyecto nuevo — Bun nativo es suficiente, cero overhead de herramientas | Nx: potente pero introduce 2+ capas de abstracción innecesarias en este stage |
| 2 | Hono como HTTP framework | Diseñado para Bun, TypeScript-first, middleware tipado, peso mínimo | Express: no tiene tipos nativos; Fastify: más configuración para el mismo resultado |
| 3 | DI manual con composition root | Explícito y trazable — todo el wiring visible en un archivo. Sin reflection ni decorators | tsyringe / inversify: añaden complejidad y dependen de reflect-metadata |
| 4 | Angular 17 standalone components | No hay NgModules de feature — menos boilerplate, lazy loading más simple | Feature modules: patrón Angular pre-v14, más verboso, menos idiomático en v17 |
| 5 | `postgres.js` como driver PostgreSQL | API async/await nativa, zero deps, compatible Bun, tagged template literals evitan SQLi | Prisma: genera código, introduce una capa ORM que viola el patrón hexagonal al filtrar en la entidad |
| 6 | Invariante super_admin en domain entity, no en DB | El dominio controla la regla; la DB tiene el constraint is_system para prevenir eliminación | CHECK constraint en DB: no puede expresar "recalcular todos los permisos a true" |
| 7 | Rutas Angular lazy-loaded definidas desde el inicio con paths fijos | Cada sub-spec crea el módulo en el path esperado; el shell no cambia al agregar módulos | Rutas dinámicas: complejidad innecesaria cuando los módulos son conocidos desde el diseño |

---

## Violaciones detectadas y corregidas

| Violación | Dónde estaba | Corrección aplicada |
|---|---|---|
| Entidad `User` expuesta directamente en response de login | Spec original: `user: { id, email, role... }` sin mencionar mapper | Agregado `user.mapper.ts` — el controller nunca devuelve la entidad, siempre pasa por el mapper a `UserDTO` |
| Invariante super_admin: "se recalcula al leer" estaba implícito en repositorio | Impact analysis lo señaló | La recalculación vive en `Role.toAuthPermissions()` — método de la entidad de dominio, no del repository. El repository solo lee de DB; la entidad aplica la regla. |

---

## Lo que NO debe cruzar capas

- Las entidades `User` y `Role` de `packages/core` **nunca** salen del Core hacia la API o la UI — siempre se mapean a DTOs en `packages/api/src/mappers/`
- Los imports de `postgres.js`, `Hono`, o cualquier librería externa **nunca** entran a `packages/core`
- La UI Angular **nunca** importa tipos de `packages/core` directamente — define sus propios modelos en `apps/hrms-ui/src/app/core/models/` que espejean los contratos
- El `container.ts` **solo** vive en `packages/api` — ningún otro paquete hace wiring
- La lógica "¿tiene permiso?" vive en `LoginUseCase` (backend) y `AuthService` (frontend) — **nunca** en un controller o un componente Angular directamente

---

## Próximo paso

Continuar con `/tdd-plan` para definir el plan de tests Red/Green/Refactor del backend, y `/tdd-plan-ui` para los tests Angular.
