# HRMS-HEX

Sistema de Gestión de Recursos Humanos construido con arquitectura hexagonal.

## Stack

| Capa | Tecnología |
|---|---|
| Base de datos | PostgreSQL 16 |
| Runtime backend | Bun + TypeScript |
| Framework HTTP | Hono |
| Frontend | Angular 18 (standalone components) |
| i18n | @ngx-translate — es (default) / en / pt |
| Autenticación | JWT (access 15 min + refresh 7 días) |
| Hash de contraseñas | argon2id (Bun nativo) |
| Contenerización | Docker + Docker Compose |

## Arranque rápido

### Con Docker (recomendado)

```bash
docker compose up
```

- UI: http://localhost:4200
- API: http://localhost:3000
- DB: localhost:5432

La migración se ejecuta automáticamente al arrancar el contenedor `api`.

### Sin Docker

Requiere Bun ≥ 1.0 y PostgreSQL 16 corriendo localmente.

```bash
# instalar dependencias
bun install

# variables de entorno
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/hrms"
export JWT_SECRET="<mínimo 64 caracteres hex>"

# migrar
bun run migrate

# API (puerto 3000)
bun run dev:api

# UI (puerto 4200) — requiere Node 20 y npm
cd apps/hrms-ui && npm install && npx ng serve
```

## Usuario de demostración

| Campo | Valor |
|---|---|
| Email | `admin@hrms.com` |
| Contraseña | `Admin1234!` |
| Rol | Super Admin (acceso total) |

El usuario se crea automáticamente via seed en la migración `001_auth_roles.sql`.

## Estructura del monorepo

```
hrms-hex/
├── packages/
│   ├── core/               # Dominio, contratos, casos de uso (sin deps externas)
│   ├── core-tests/         # Tests del core, aislados del runtime (depende de core)
│   ├── boundary-postgres/  # Repositorios con postgres.js + migraciones
│   └── api/                # Hono app — composition root
├── apps/
│   └── hrms-ui/            # Angular 18 SPA
├── docker/
│   └── entrypoint.api.sh
├── docker-compose.yml
├── Dockerfile.api
└── package.json            # Bun workspaces root
```

### Flujo de dependencias

```
apps/hrms-ui ──────────────────────────────► packages/api
                                                   │
packages/boundary-postgres ──► packages/core ◄────┘
                                     ▲
packages/core-tests ─────────────────┘
```

El núcleo (`packages/core`) no tiene dependencias externas: ni siquiera el runtime de test (`bun:test`). Las capas externas dependen de él, nunca al revés. Los tests del core viven en `packages/core-tests`, que depende de `core` y carga el runtime de test sin contaminar el dominio.

## API — Endpoints disponibles

### Auth

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Login con email + password → `{ accessToken, refreshToken, user }` |
| `POST` | `/api/auth/refresh` | Renovar access token con refresh token |
| `POST` | `/api/auth/logout` | Invalidar refresh token |

### Roles

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `GET` | `/api/roles` | Listar roles con permisos | ✅ |
| `POST` | `/api/roles` | Crear rol | ✅ Super Admin |
| `PUT` | `/api/roles/:id` | Actualizar permisos de rol | ✅ Super Admin |
| `DELETE` | `/api/roles/:id` | Eliminar rol personalizado | ✅ Super Admin |

## Tests

```bash
# todos los tests (backend)
bun test

# por paquete
bun run test:core      # → @hrms/core-tests (tests del dominio, aislados)
bun run test:boundary
bun run test:api
```

Los tests de `boundary-postgres` requieren la base de datos activa. Con Docker:

```bash
docker compose up db -d
bun run test:boundary
```

## Sub-specs — Estado de implementación

| # | Sub-spec | Estado |
|---|---|---|
| 1 | hrms-auth-roles — Login, JWT, roles, i18n | ✅ Completo |
| 2 | hrms-employees — Expediente de empleado | ⏳ Pendiente |
| 3 | hrms-documents — Documentos y firmas | ⏳ Pendiente |
| 4 | hrms-absences — Solicitudes de ausencia | ⏳ Pendiente |
| 5 | hrms-attendance — Registro de asistencia | ⏳ Pendiente |
| 6 | hrms-payroll — Nómina por período | ⏳ Pendiente |
| 7 | hrms-benefits — Planes de beneficios | ⏳ Pendiente |
| 8 | hrms-recruitment — Pipeline de candidatos | ⏳ Pendiente |
| 9 | hrms-notifications — Adaptador Slack | ⏳ Pendiente |
| 10 | hrms-admin — Dashboard y analíticas | ⏳ Pendiente |

Ver [CHANGELOG.md](CHANGELOG.md) para el historial detallado del pipeline SDD.

## Diseño UI

Las pantallas de referencia están en el proyecto Stitch `13650739638263912450` (privado). El sistema de diseño usa:

- Fuente: Inter
- Color primario: `#1a73e8`
- Bordes: `8px` de radio
- Componentes: Material Symbols Outlined (CDN)

## Notas de seguridad

- `JWT_SECRET` debe ser mínimo 256 bits (64 caracteres hex). Nunca commitear el valor real.
- Los refresh tokens se almacenan en base de datos y son revocables individualmente.
- Los tokens de demostración en `docker-compose.yml` son solo para desarrollo local.
