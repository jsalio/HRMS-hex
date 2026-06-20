# SDD Incident Log — HRMS-HEX

Registro de violaciones al flujo SDD detectadas durante la implementación.
Cada incidente incluye: qué se violó, en qué fase ocurrió, cuál fue la brecha de contexto que lo causó, y por qué no se emitió advertencia.

---

## INC-001 — Ausencia de documentación inline

**Severidad**: Alta
**Sub-specs afectados**: 1 (hrms-auth-roles) al 5 (hrms-attendance)
**Detectado por**: Usuario — sesión 2026-06-14

### Qué se violó

Regla del skill `/implement`, paso 4.3:
> "Documentación inline en TODAS las funciones y métodos públicos — obligatoria, no es opcional ni se deja para después."

### En qué fase ocurrió

Durante `/implement` — la violación ocurrió en el momento de escribir el código, no en la planificación.

### Brecha de contexto

El system prompt built-in de Claude Code contiene:
> "Default to writing no comments. Only add one when the WHY is non-obvious."

Esta instrucción es cargada **antes** que cualquier skill. Al ejecutar `/implement`, la instrucción built-in silencia la regla del skill porque ambas operan en el mismo nivel de ejecución y la built-in tiene precedencia implícita por orden de carga.

Al inicio del proyecto no existía un `CLAUDE.md` de proyecto que la sobrescribiera. El override correcto (añadir la regla al `CLAUDE.md`) no fue propuesto ni aplicado antes de comenzar la implementación.

### Por qué no se emitió advertencia

El proyecto empezó desde cero — no había código existente que impusiera silencio en comentarios. El conflicto entre la instrucción built-in y la regla del skill era detectable desde el primer sub-spec. Debí haberlo identificado al leer las instrucciones del skill antes de escribir la primera línea de código y advertir: *"Existe un conflicto entre la instrucción built-in de Claude Code y esta regla del skill. Para resolver, agrega X al CLAUDE.md del proyecto."*

No lo hice porque no ejecuté una verificación de conflictos entre instrucciones antes de implementar.

### Resolución — RESUELTO (2026-06-18)

- CLAUDE.md de proyecto creado con la regla en modo estricto — commit `6cc1e69`
- Pasada retroactiva de TSDoc completa sobre toda la superficie pública de los sub-specs 1–5:
  - **Use cases** (los 32 atómicos), **contratos** y **controllers** — durante el refactor de INC-002
  - **Dominio** (`packages/core/src/domain/`: errors, employee, user, absence-balance, attendance-record, employee-document, role)
  - **Repositorios** (`packages/boundary-postgres/src/repositories/`: los 8 adapters)
  - **Mappers y services** (`packages/api/src/mappers`, `packages/api/src/services`)
- Verificación: cambios solo de comentarios (789 inserciones de TSDoc), suite verde (core 96/96, api 8/8).

---

## INC-002 — Violación SRP: patrón ManageX en use cases

**Severidad**: Alta
**Sub-specs afectados**: 1 (hrms-auth-roles) al 5 (hrms-attendance)
**Detectado por**: Usuario — sesión 2026-06-14

### Qué se violó

**SRP (Single Responsibility Principle)** — cada clase debe tener una sola razón para cambiar.

Regla del skill `/arch`:
> `application/use-cases/Y` — *un archivo por caso de uso*

Regla del skill `/sdd` — tabla SOLID:
> SRP: un caso de uso por clase.

Lo implementado:

```
ManageRolesUseCase        → listRoles, createRole, updatePermissions, deleteRole
ManageEmployeesUseCase    → listEmployees, getEmployee, createEmployee, updateEmployee, ...
ManageDocumentsUseCase    → listDocuments, createDocument, signDocument, ...
ManageAbsencesUseCase     → requestAbsence, approveAbsence, rejectAbsence, cancelAbsence
ManageAttendanceUseCase   → listRecords, getSummary, checkIn, checkOut, editRecord
```

Lo correcto según SRP:

```
ListRolesUseCase / CreateRoleUseCase / UpdateRolePermissionsUseCase / DeleteRoleUseCase
CheckInUseCase / CheckOutUseCase / ListAttendanceUseCase / ...
```

### En qué fase ocurrió

En `/arch` — la violación fue introducida en la fase de arquitectura, no en la implementación. El archivo arch (ya eliminado en la consolidación) nombró `manage-roles.usecase.ts` como unidad de aplicación. Desde ese momento `/implement` siguió fielmente el arch sin re-validar SOLID.

### Brecha de contexto

El pipeline SDD trata SOLID como **artefacto de planificación**, no como **restricción de ejecución**:

| Fase | Cómo aparece SOLID | ¿Bloquea si se viola? |
|---|---|---|
| `/sdd` | Tabla que YO lleno con mis intenciones | No — es declarativo |
| `/arch` | Menciona "un archivo por caso de uso" | No — es una guía de nombrado |
| `/security` (Categoría 10) | Revisa arquitectura en modo código | No — registra, no rechaza |
| `/implement` | "Seguir las decisiones del arch" | No — delega ciegamente al arch |

El ManageX es un patrón común en otros ecosistemas (ApplicationService en DDD, Facade en Spring/NestJS). El skill `/arch` no tiene una regla explícita que diga *"si el nombre del use case contiene múltiples verbos de acción, RECHAZAR y descomponer"*. Eso abre la puerta a que un patrón Facade pase como válido.

### Por qué no se emitió advertencia

El proyecto empezó desde cero. No había estructuras existentes que forzaran el patrón ManageX. La elección fue completamente mía. Las condiciones para emitir advertencia estaban todas dadas:

1. El skill `/arch` tenía la regla "un archivo por caso de uso"
2. SOLID SRP estaba en la tabla del spec
3. No había código heredado que obligara a agrupar

**No emití advertencia porque ningún skill tiene un paso explícito que valide: "¿Esta clase tiene más de una responsabilidad de negocio? → DETENER."** El check existe como texto descriptivo pero no como punto de bloqueo en el flujo. Pasó por todos los filtros del pipeline sin disparar ninguno.

### Resolución — RESUELTO (2026-06-18)

Se aplicó el **refactor completo** (opción 1). Los 6 `ManageXUseCase` se descompusieron en use cases atómicos (un caso de uso por clase, método único `execute`):

| Módulo | ManageX eliminado | Use cases atómicos |
|---|---|---|
| roles | `ManageRolesUseCase` | 4 (List/Create/Update/Delete) |
| employees | `ManageEmployeesUseCase` | 7 |
| departments | `ManageDepartmentsUseCase` | 2 |
| documents | `ManageDocumentsUseCase` | 7 |
| absences | `ManageAbsencesUseCase` | 7 |
| attendance | `ManageAttendanceUseCase` | 5 |

Además se aplicó **composición de contratos** (skill `contract-composition`): capacidades atómicas + contratos compuestos por use case + puerto completo `I<Entidad>Repository` que las une. Cada use case depende solo de lo que usa.

Decisión formalizada en **ADR-0001** (`docs/adr/0001-atomic-use-cases-and-contract-composition.md`).
Verificación: core 96/96, api 8/8, carga del módulo API OK.

---

## Brecha sistémica común a INC-001 e INC-002

Ambos incidentes comparten la misma causa raíz:

> **El pipeline SDD documenta las reglas pero no las enforcea.**

Las reglas de SOLID, documentación inline, y estructura de archivos existen en los skills como texto. Ningún skill tiene un paso que diga explícitamente *"antes de escribir código, verificar que las instrucciones del skill no colisionan con instrucciones de mayor precedencia"* ni *"si esta clase tiene N responsabilidades distintas, BLOQUEAR y pedir descomposición"*.

El pipeline confía en que el modelo aplicará las reglas correctamente en cada ejecución. Cuando el modelo tiene instrucciones en conflicto o usa un patrón conocido que superficialmente satisface la guía, las reglas se evaden sin advertencia.

### Solución estructural sugerida

Un skill `/sdd-preflight` que se ejecute al inicio de cada `/implement` y verifique explícitamente:

1. ¿Existe CLAUDE.md con overrides de documentación? → si no, crearlo antes de continuar
2. ¿Cada use case en el arch tiene exactamente un verbo de acción de negocio? → si no, DETENER y descomponer
3. ¿Hay conflicto entre instrucciones built-in y reglas del skill activo? → reportar antes de implementar

Skill creado: `~/.claude/skills/sdd-preflight/SKILL.md`
Registrado en: `~/.claude/CLAUDE.md`
Se ejecuta automáticamente al inicio de cada `/implement` y Fase 7 de `/dev`.

---

---

## INC-003 — Acción "Nueva vacante" sin implementar (botón no-op)

**Severidad**: Media
**Sub-spec afectado**: Sub-spec 4 (UI) — hrms-recruitment
**Detectado por**: Usuario — sesión 2026-06-20

### Qué se violó

El TDD plan UI (`docs/specs/hrms-recruitment.tdd-plan-ui.md`), Test 2.6:

> `cuando_el_usuario_hace_click_en_crear_vacante_entonces_muestra_formulario_de_nueva_vacante`
> **Assert**: formulario de creación visible O `Router.navigate` llamado con ruta de creación.

El botón "Nueva vacante" en `RecruitmentPageComponent` fue implementado como un no-op:

```typescript
onCreatePosting(): void {
  // v1: no inline form — placeholder for future implementation
}
```

### En qué fase ocurrió

Durante `/implement` — Sub-spec 4 (UI). El comportamiento del botón fue registrado en `why.md` como *"scope creep"* sin que eso fuera correcto: el Test 2.6 del plan de TDD está en el contrato. La acción de crear vacante no es una adición fuera de scope — es un requisito explícito del plan.

### Brecha de contexto

El `why.md` documentó la decisión como "formulario de hire usa inputs de texto para `departmentId`/`documentId` — sin selectors en v1". Esta redacción mezclaba una desviación legítima (selectors faltantes) con la omisión del flujo completo de creación. El resultado fue que la acción quedó silenciada sin un test fallido que la detectara, porque los tests de UI no se ejecutan automáticamente en el pipeline actual.

### Resolución — RESUELTO (2026-06-20)

- `apps/hrms-ui/src/app/recruitment/job-posting-form-page.component.ts` — NUEVO. Formulario de creación de vacante con campos: título, departamento (UUID), descripción, requisitos (opcional).
- `apps/hrms-ui/src/app/recruitment/recruitment.routes.ts` — ruta `new` añadida antes de `:postingId`.
- `apps/hrms-ui/src/app/recruitment/recruitment-page.component.ts` — `onCreatePosting()` navega a `/recruitment/new`.

---

## INC-005 — Gestión de departamentos ausente como prerrequisito bloqueante

**Severidad**: Alta
**Módulo afectado**: hrms-employees (sub-spec de empleados), todas las pantallas que requieren seleccionar departamento
**Detectado por**: Usuario — sesión 2026-06-20

### Qué se violó

La creación de empleados requiere un `departmentId` válido. El formulario de empleado y el formulario de contratación (`hire-form-page.component.ts`) solicitan un UUID de departamento, pero el sistema no disponía de ninguna UI que permitiera:

1. Ver qué departamentos existen
2. Crear nuevos departamentos
3. Modificar el nombre de un departamento
4. Eliminar departamentos con reglas de negocio

Los departamentos eran de facto datos estáticos cargados por un seed SQL (`002_employees.sql`): Engineering, Finance, HR, Operations, Sales. El usuario no tenía forma de adaptar esta estructura sin acceso directo a la base de datos.

### En qué fase ocurrió

En el **análisis de prerequisites del sub-spec de empleados** — antes de implementar la creación de empleados. El pipeline debió haber detectado que `CreateEmployeeInput.departmentId` requería una UI de origen de datos gestionable.

### Brecha de contexto

El spec de empleados (`hrms-employees.md`) define `departmentId` como un campo requerido. El pipeline `/impact` debió haber trazado la cadena: *empleado requiere departamento → departamento es FK → los datos estáticos de seed son un parche temporal, no gestión real*.

El pipeline confió en que el seed inicial era suficiente. No identificó que la ausencia de una UI de gestión convierte los departamentos en datos de solo lectura en producción.

### Por qué no se emitió advertencia

El análisis de `/impact` evaluó los side-effects de la creación de empleados pero no auditó si los datos de referencia que el feature requería (departamentos) eran gestionables por el usuario del sistema. La auditoría de datos de referencia no está como paso explícito en ningún skill del pipeline.

### Resolución — RESUELTO (2026-06-20)

Feature completo implementado vía `/sdd-dev`:
- Use cases: `UpdateDepartmentUseCase`, `DeleteDepartmentUseCase` (nuevos)
- Repositorio: `DepartmentRepository` extendido con `update`, `delete`, `countActiveEmployees`
- API: `PUT /departments/:id` y `DELETE /departments/:id` con validación y auth
- UI: Módulo Angular `departments/` con lista, formulario inline, eliminación con confirmación
- Constraint de borrado: `countActiveEmployees` > 0 → error `DepartmentNotEmptyError` (409)

---

## Estado del log

| ID | Estado | Resolución |
|---|---|---|
| INC-001 | **Resuelto** | TSDoc completo en toda la superficie pública de los sub-specs 1–5: use cases, contratos, controllers, dominio, repositorios, mappers y services |
| INC-002 | **Resuelto** | Refactor completo a use cases atómicos + composición de contratos en los 6 módulos. Formalizado en ADR-0001 |
| INC-003 | **Resuelto** | `JobPostingFormPageComponent` creado; ruta `new` y navegación desde `RecruitmentPageComponent` implementadas |
| INC-004 | **Resuelto** | `| translate` añadido a todos los bindings de error en los 5 componentes del módulo recruitment |
| INC-005 | **Resuelto** | Módulo de gestión de departamentos implementado completo (CRUD + constraint de borrado por empleados activos) |
| — | Sistémica resuelta | Skill `/sdd-preflight` creado — enforcea CHECK-1 (docs) y CHECK-2 (SRP) antes de cada implementación. ADR-0001 fija el principio como norma del proyecto |

---

## INC-004 — Mensajes de error sin pipe `| translate` en componentes recruitment

**Severidad**: Media
**Sub-spec afectado**: Sub-spec 4 (UI) — hrms-recruitment
**Detectado por**: Usuario — sesión 2026-06-20

### Qué se violó

Los mensajes de error de todos los componentes Smart del módulo se almacenan como claves i18n en signals de TypeScript:

```typescript
this.error.set('recruitment.error.load')
this.validationError.set('recruitment.hire.error.required')
```

Pero el template los renderiza sin el pipe `| translate`:

```html
<!-- incorrecto — muestra la clave cruda -->
<div *ngIf="error()" class="alert alert-error">{{ error() }}</div>

<!-- correcto -->
<div *ngIf="error()" class="alert alert-error">{{ error()! | translate }}</div>
```

El resultado es que el usuario ve `recruitment.error.load` en pantalla en lugar de "Error al cargar los datos".

### En qué fase ocurrió

Durante `/implement` — Sub-spec 4 (UI). El patrón `{{ signal() }}` sin `| translate` fue aplicado consistentemente en los 5 componentes Smart del módulo.

### Brecha de contexto

El script `bun scripts/i18n.ts scan` detecta únicamente claves literales en la forma `'key' | translate` dentro del template. No detecta el patrón donde la clave vive en un signal de TypeScript y se renderiza con `{{ signal() }}`. Esta clase de error no es visible hasta que el usuario activa el estado de error en la UI.

### Resolución — RESUELTO (2026-06-20)

`| translate` añadido a todos los bindings de error en los 5 componentes afectados:

| Componente | Bindings corregidos |
|---|---|
| `recruitment-page.component.ts` | `error()` |
| `job-posting-detail-page.component.ts` | `error()` |
| `candidate-profile-page.component.ts` | `error()`, `actionError()` |
| `hire-form-page.component.ts` | `error()`, `validationError()` |
| `job-posting-form-page.component.ts` | `error()`, `validationError()` |

Herramienta `scripts/i18n.ts` mejorada: nueva opción `scan-ts` que detecta claves pasadas a `.set()` en TypeScript.
