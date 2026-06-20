# Gestión de Departamentos

**Fecha**: 2026-06-20
**Estado**: Implementado
**Commit**: feat(departments): implement full department management CRUD with empty-check constraint

---

## Qué es este feature

Los departamentos eran datos estáticos en la base de datos — cinco registros de seed que el usuario no podía modificar sin acceso directo a la BD. Esto creaba un bloqueo silencioso: crear un empleado requiere un `departmentId` válido, pero no existía ninguna forma de agregar nuevos departamentos ni de adaptar la estructura organizativa de la empresa a la realidad del negocio.

Este feature convierte los departamentos en entidades de primera clase, gestionables desde la UI. Cualquier usuario con permisos de empleados puede ahora ver, crear y renombrar departamentos. La eliminación está controlada por una regla de negocio explícita: solo se puede eliminar un departamento si no tiene empleados activos asignados.

El feature fue identificado como INC-005 — un prerequisito bloqueante que debió haberse detectado antes de permitir la creación de empleados.

---

## Qué se construyó

### Modelo de datos

```
Department {
  id:        UUID (PK, DEFAULT gen_random_uuid())
  name:      VARCHAR(100) UNIQUE NOT NULL
  createdAt: TIMESTAMPTZ NOT NULL DEFAULT now()
}
```

Sin migración de BD — la tabla `departments` ya existía. Solo se añadieron operaciones nuevas al repositorio.

### Contratos de API

| Método | Ruta | Permiso | Respuesta |
|---|---|---|---|
| GET | `/departments` | EMPLOYEES canView | `200 Department[]` |
| POST | `/departments` | EMPLOYEES canCreate | `201 Department` / `409 name conflict` |
| PUT | `/departments/:id` | EMPLOYEES canEdit | `200 Department` / `404` / `409 name conflict` / `422 empty name` |
| DELETE | `/departments/:id` | EMPLOYEES canDelete | `204` / `404` / `409 active employees` |

### Invariantes del sistema

1. No pueden existir dos departamentos con el mismo nombre
2. Un departamento con empleados activos (ACTIVE, REMOTE, ON_LEAVE) no puede ser eliminado
3. Los empleados INACTIVE no bloquean la eliminación a nivel de regla de negocio
4. El nombre del departamento se normaliza (trim) antes de cualquier validación o persistencia
5. El id de un departamento es inmutable

---

## Cómo está estructurado el código

### Patrón arquitectónico

Hexagonal (Ports & Adapters). El hexágono puro define las reglas de negocio; la capa de infra las implementa; la capa HTTP las expone.

### Archivos creados / modificados

| Archivo | Capa | Responsabilidad |
|---|---|---|
| `packages/core/src/domain/errors.ts` | Dominio | Añade `DepartmentNotEmptyError` |
| `packages/core/src/contracts/employees.ts` | Contratos | Añade `IUpdateDepartment`, `IDeleteDepartment`, `ICountActiveEmployeesInDepartment`, `UpdateDepartmentRepository`, `DeleteDepartmentRepository`; extiende `IDepartmentRepository` |
| `packages/core/src/usecases/update-department.usecase.ts` | Aplicación | Actualiza nombre con validación de existencia y unicidad |
| `packages/core/src/usecases/delete-department.usecase.ts` | Aplicación | Elimina con verificación de empleados activos |
| `packages/core/src/index.ts` | Core barrel | Exporta nuevos use cases y error |
| `packages/boundary-postgres/src/repositories/department.repository.ts` | Infra | Añade `update`, `delete`, `countActiveEmployees` |
| `packages/boundary-postgres/src/migrations/007_recruitment.sql` | Infra | Fix: añade `IF NOT EXISTS` — el migration runner re-ejecuta en cada boot |
| `packages/api/src/controllers/departments.controller.ts` | Adaptador HTTP | Añade `PUT /:id` y `DELETE /:id` con mapeo de errores de dominio |
| `packages/api/src/container.ts` | DI | Instancia `UpdateDepartmentUseCase` y `DeleteDepartmentUseCase` |
| `packages/api/src/index.ts` | Entry point | Pasa nuevos use cases al controller |
| `apps/hrms-ui/src/app/departments/departments.service.ts` | UI | HTTP client para `/api/departments` |
| `apps/hrms-ui/src/app/departments/departments-page.component.ts` | UI | Smart component: lista + formulario inline + confirmación de borrado |
| `apps/hrms-ui/src/app/departments/departments.routes.ts` | UI | Rutas del módulo |
| `apps/hrms-ui/src/app/app.routes.ts` | UI | Añade ruta `/departments` bajo EMPLOYEES canView |
| `apps/hrms-ui/src/app/shell/shell.component.ts` | UI | Añade nav item "Departamentos" |
| `apps/hrms-ui/src/assets/i18n/*.json` | UI | Sección `departments.*` en es/en/pt + clave `shell.nav.departments` |

---

## Cómo se verifica

### Tests de backend

| Test | Capa | Qué verifica |
|---|---|---|
| `dado_id_existente_cuando_nombre_nuevo_entonces_actualiza()` | Aplicación | Update happy path |
| `dado_id_inexistente_entonces_lanza_NotFoundError()` | Aplicación | NotFoundError en update |
| `dado_nombre_igual_al_actual_entonces_actualiza_sin_verificar_unicidad()` | Aplicación | No falso conflicto al mantener mismo nombre |
| `dado_nombre_tomado_por_otro_dept_entonces_lanza_ConflictError()` | Aplicación | ConflictError en update |
| `dado_nombre_con_espacios_entonces_trim_antes_de_persistir()` | Aplicación (NFR) | Trim aplicado |
| `dado_nombre_vacio_entonces_lanza_ValidationError()` | Aplicación (NFR) | ValidationError |
| `dado_id_existente_y_departamento_vacio_entonces_elimina()` | Aplicación | Delete happy path |
| `dado_id_inexistente_entonces_lanza_NotFoundError()` (delete) | Aplicación | NotFoundError en delete |
| `dado_departamento_con_empleados_activos_entonces_lanza_DepartmentNotEmptyError()` | Aplicación | Constraint de negocio |
| `delete_no_se_llama_cuando_dept_no_existe()` | Aplicación | Orden de verificaciones |
| `delete_no_se_llama_cuando_hay_empleados_activos()` | Aplicación | Orden de verificaciones |
| `countActiveEmployees_no_se_llama_cuando_dept_no_existe()` | Aplicación | Short-circuit en NotFoundError |

**Resultado**: 12/12 tests pasan.

---

## Decisiones tomadas y por qué

### AppModule.EMPLOYEES para gestión de departamentos

Los departamentos son entidades organizativas del dominio de empleados. El enum `AppModule` estaba marcado como "FROZEN CONTRACT" — añadir `DEPARTMENTS` rompería sub-specs 2-10. Se reutiliza `AppModule.EMPLOYEES` con la granularidad `canView/canCreate/canEdit/canDelete` ya existente. Alternativa descartada: nuevo AppModule — costo alto, beneficio nulo.

### DepartmentNotEmptyError como error de dominio específico

La regla "no eliminar con empleados activos" es una invariante de negocio, no un error genérico. Un `ConflictError` genérico no tendría semántica distinguible del error de nombre duplicado. `DepartmentNotEmptyError` permite que el controlador devuelva un 409 con mensaje específico y que la UI muestre el texto correcto (`departments.delete_blocked`).

### countActiveEmployees como capability atómica separada

La query de conteo es una operación de lectura independiente del delete físico. Modelarla como `ICountActiveEmployeesInDepartment` permite que `DeleteDepartmentUseCase` declare solo lo que necesita: `findById + countActiveEmployees + delete`. Sin acoplamiento innecesario.

### Update permite mantener el mismo nombre (no falso ConflictError)

Si el usuario abre el formulario de edición y guarda sin cambiar el nombre, no debe recibir un error de conflicto. La verificación de unicidad en `UpdateDepartmentUseCase` se salta cuando el nombre enviado es idéntico al nombre actual del departamento.

### UI como Smart component único sin sub-rutas

El catálogo de departamentos es pequeño. Formulario de creación/edición inline, confirmación de borrado como banner en la misma página. Sub-rutas adicionales añadirían fricción de navegación sin valor para un catálogo de entidades simples.

---

## Side-effects manejados

- **Migration 007 sin IF NOT EXISTS**: El migration runner re-ejecuta todos los SQL en cada boot. La migración de recruitment no tenía `IF NOT EXISTS`, causando crash al reiniciar el API. Corregido añadiendo `IF NOT EXISTS` a las tres instrucciones DDL de `007_recruitment.sql`.

---

## Deuda técnica

| # | Descripción | Impacto | Cuándo resolver |
|---|---|---|---|
| 1 | La BD tiene FK activa para empleados INACTIVE → DELETE físico fallará si hay INACTIVE en el depto, aunque la regla de negocio lo permite | Medio | Próximo sprint: reasignar `department_id = NULL` o a depto "Archivo" al terminar un empleado |
| 2 | Demo users tienen hashes placeholder (`$argon2id$...$test$test`) — `Bun.password.verify` lanza "WeakParameters" | Medio | Resetear passwords de usuarios demo o regenerar en seed |

---

## Desviaciones del spec original

Ninguna. La implementación siguió el spec exactamente.
