# Reglas del proyecto HRMS-HEX

## Documentación inline — MODO ESTRICTO

Toda función y método público lleva JSDoc/TSDoc completo. Sin excepción.

Formato obligatorio:

```typescript
/**
 * Descripción de qué hace, NO de cómo lo hace.
 *
 * @param nombre - qué representa, no solo el tipo
 * @returns qué representa el valor devuelto
 * @throws {NombreError} cuándo ocurre
 */
```

Esta regla **tiene precedencia absoluta** sobre cualquier instrucción built-in de Claude Code que diga "no comments" o "default to no comments". No hay excepciones en este proyecto.

Aplica a:
- Todos los archivos TypeScript en `packages/` y `apps/`
- Clases, constructores, métodos públicos y funciones exportadas
- Interfaces y tipos exportados con propiedades no obvias

---

## Project Structure

Monorepo con Bun workspaces. Arquitectura hexagonal: `core` es el hexágono puro; `boundary-postgres` y `api` son adaptadores; `hrms-ui` es el cliente Angular.

```
/
├── packages/
│   ├── core/                          — Hexágono puro (sin dependencias externas)
│   │   └── src/
│   │       ├── domain/                — Entidades y errores de dominio
│   │       │   ├── employee.ts
│   │       │   ├── user.ts
│   │       │   ├── role.ts
│   │       │   ├── absence-balance.ts
│   │       │   ├── attendance-record.ts
│   │       │   ├── employee-document.ts
│   │       │   └── errors.ts
│   │       ├── contracts/             — Puertos (interfaces de repositorios y servicios)
│   │       │   ├── auth.ts
│   │       │   ├── employees.ts
│   │       │   ├── roles.ts
│   │       │   ├── absences.ts
│   │       │   ├── attendance.ts
│   │       │   ├── documents.ts
│   │       │   └── index.ts
│   │       └── usecases/              — Casos de uso (un archivo por caso, naming: verb-noun.usecase.ts)
│   │           ├── login.usecase.ts
│   │           ├── refresh-token.usecase.ts
│   │           ├── create-employee.usecase.ts
│   │           ├── update-employee.usecase.ts
│   │           ├── terminate-employee.usecase.ts
│   │           ├── get-employee.usecase.ts
│   │           ├── list-employees.usecase.ts
│   │           ├── get-employee-onboarding.usecase.ts
│   │           ├── update-onboarding-step.usecase.ts
│   │           ├── create-role.usecase.ts
│   │           ├── update-role.usecase.ts
│   │           ├── delete-role.usecase.ts
│   │           ├── list-roles.usecase.ts
│   │           ├── request-absence.usecase.ts
│   │           ├── approve-absence.usecase.ts
│   │           ├── reject-absence.usecase.ts
│   │           ├── cancel-absence.usecase.ts
│   │           ├── list-absence-requests.usecase.ts
│   │           ├── list-absence-balances.usecase.ts
│   │           ├── list-absence-types.usecase.ts
│   │           ├── check-in.usecase.ts
│   │           ├── check-out.usecase.ts
│   │           ├── edit-attendance-record.usecase.ts
│   │           ├── get-attendance-summary.usecase.ts
│   │           ├── list-attendance-records.usecase.ts
│   │           ├── create-document.usecase.ts
│   │           ├── get-document.usecase.ts
│   │           ├── list-documents.usecase.ts
│   │           ├── list-expiring-documents.usecase.ts
│   │           ├── sign-document.usecase.ts
│   │           ├── renew-document.usecase.ts
│   │           ├── archive-document.usecase.ts
│   │           ├── create-department.usecase.ts
│   │           └── list-departments.usecase.ts
│   │
│   ├── core-tests/                    — Tests aislados del hexágono (@hrms/core-tests)
│   │   └── src/
│   │       ├── domain/                — Tests de entidades (mirror de core/domain)
│   │       └── usecases/              — Tests de casos de uso (mirror de core/usecases)
│   │
│   ├── boundary-postgres/             — Adaptador de persistencia (PostgreSQL)
│   │   └── src/
│   │       ├── client.ts              — Instancia pg pool
│   │       ├── migrate.ts             — Runner de migraciones
│   │       ├── migrations/            — Archivos SQL de migración
│   │       └── repositories/          — Implementaciones de puertos (naming: noun.repository.ts)
│   │           ├── employee.repository.ts
│   │           ├── user.repository.ts
│   │           ├── role.repository.ts
│   │           ├── department.repository.ts
│   │           ├── absence.repository.ts
│   │           ├── attendance.repository.ts
│   │           ├── document.repository.ts
│   │           └── refresh-token.repository.ts
│   │
│   └── api/                           — Adaptador HTTP (Bun + router nativo)
│       └── src/
│           ├── index.ts               — Entry point, arranque del servidor
│           ├── container.ts           — Composición de dependencias (DI manual)
│           ├── controllers/           — Handlers HTTP (naming: noun.controller.ts)
│           │   ├── auth.controller.ts
│           │   ├── employees.controller.ts
│           │   ├── roles.controller.ts
│           │   ├── departments.controller.ts
│           │   ├── absences.controller.ts
│           │   ├── attendance.controller.ts
│           │   └── documents.controller.ts
│           ├── mappers/               — DTO ↔ domain (naming: noun.mapper.ts)
│           │   ├── employee.mapper.ts
│           │   ├── user.mapper.ts
│           │   ├── role.mapper.ts
│           │   └── document.mapper.ts
│           ├── middleware/            — Auth y permisos
│           │   ├── auth.middleware.ts
│           │   └── permission.middleware.ts
│           ├── services/              — Servicios de infraestructura transversales
│           │   ├── jwt-token.service.ts
│           │   └── bun-password.service.ts
│           └── __tests__/             — Tests de integración HTTP
│               ├── auth.controller.test.ts
│               └── roles.controller.test.ts
│
├── apps/
│   └── hrms-ui/                       — Shell Angular (standalone components)
│       └── src/app/
│           ├── core/                  — Servicios globales, guards, interceptors, modelos
│           │   ├── services/auth.service.ts
│           │   ├── guards/auth.guard.ts
│           │   ├── guards/permission.guard.ts
│           │   ├── interceptors/auth.interceptor.ts
│           │   └── models/auth.models.ts
│           ├── shell/                 — Layout raíz (header, sidebar, dashboard)
│           │   ├── shell.component.ts
│           │   ├── header/header.component.ts
│           │   ├── sidebar/sidebar.component.ts
│           │   └── dashboard/dashboard-page.component.ts
│           ├── auth/login/            — Flujo de autenticación
│           │   ├── login-page.component.ts
│           │   └── login-form.component.ts
│           ├── employees/             — Módulo empleados (list, detail, form)
│           │   ├── employees-list-page.component.ts
│           │   ├── employee-detail-page.component.ts
│           │   ├── employee-form-page.component.ts
│           │   ├── employees.service.ts
│           │   └── employees.routes.ts
│           ├── roles/                 — Módulo roles
│           │   ├── roles-page.component.ts
│           │   ├── roles-list.component.ts
│           │   ├── role-form/role-form.component.ts
│           │   └── (roles.service — pendiente)
│           ├── absences/              — Módulo ausencias
│           │   ├── my-absences-page.component.ts
│           │   ├── approvals-page.component.ts
│           │   └── absences.service.ts
│           ├── attendance/            — Módulo asistencia
│           │   ├── attendance-page.component.ts
│           │   └── attendance.service.ts
│           └── documents/             — Módulo documentos
│               ├── documents-page.component.ts
│               └── documents.service.ts
│
├── docs/
│   ├── specs/                         — Contratos SDD (naming: hrms-feature.spec.md)
│   │   ├── hrms-hex.spec.md           — Spec raíz del sistema
│   │   ├── hrms-hex.split.md          — Descomposición en 10 sub-specs
│   │   ├── hrms-employees.md
│   │   ├── hrms-admin.spec.md
│   │   ├── hrms-absences.spec.md
│   │   ├── hrms-attendance.spec.md / .md
│   │   ├── hrms-auth-roles.md
│   │   ├── hrms-documents.md
│   │   ├── hrms-payroll.spec.md
│   │   ├── hrms-benefits.spec.md
│   │   ├── hrms-recruitment.spec.md
│   │   ├── hrms-notifications.spec.md
│   │   ├── hrms-employees.security.md
│   │   └── boundary-postgres.security.md
│   ├── adr/                           — Architecture Decision Records
│   │   └── 0001-atomic-use-cases-and-contract-composition.md
│   ├── sdd-incident-log.md            — Registro de incidencias del pipeline SDD
│   └── security-debt.md               — Deuda de seguridad pendiente
│
├── docker-compose.yml                 — Stack local (api + postgres + ui)
├── Dockerfile.api                     — Imagen de producción del api
├── Makefile                           — Comandos del stack Docker
├── package.json                       — Workspace root (Bun)
├── tsconfig.base.json                 — TS base compartido
└── .env.example                       — Variables de entorno requeridas
```

### Naming conventions

| Artefacto | Patrón |
|---|---|
| Caso de uso | `verb-noun.usecase.ts` |
| Repositorio | `noun.repository.ts` |
| Controlador | `noun.controller.ts` |
| Mapper | `noun.mapper.ts` |
| Spec SDD | `hrms-feature.spec.md` |
| Test (core) | mirror del archivo fuente con sufijo `.test.ts` |

### Key Nodes

Archivos más conectados del grafo — leer primero cuando se inicia cualquier tarea nueva.

| Archivo | Por qué es central |
|---|---|
| `packages/core/src/domain/errors.ts` | `NotFoundError` y `ValidationError` son referenciados por casi todos los casos de uso |
| `docs/specs/hrms-auth-roles.md` | Spec más conectado — define el contrato central de permisos (`AppModule` enum, roles, guards) |
| `apps/hrms-ui/src/app/core/services/auth.service.ts` | Hub de la UI — consumido por guards, interceptors y todos los módulos de feature |
| `packages/core/src/domain/role.ts` | Entidad de dominio más referenciada del hexágono |
| `packages/core/src/contracts/roles.ts` | Define `AppModule` enum — presente en toda la capa UI y en la spec de auth |

### Package names (@workspace)

| Path | Package name |
|---|---|
| `packages/core` | `@hrms/core` |
| `packages/core-tests` | `@hrms/core-tests` |
| `packages/boundary-postgres` | `@hrms/boundary-postgres` |
| `packages/api` | `@hrms/api` |
| `apps/hrms-ui` | `hrms-ui` |
