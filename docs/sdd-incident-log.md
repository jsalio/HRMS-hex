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

### Resolución

- CLAUDE.md de proyecto creado con la regla en modo estricto — commit `6cc1e69`
- Los sub-specs 1–5 tienen funciones públicas sin JSDoc. Pendiente retroactivo o aceptado como deuda técnica documentada.

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

### Resolución pendiente

Dos opciones:
1. **Refactor completo** — descomponer todos los ManageX en use cases atómicos antes de continuar
2. **Deuda documentada** — continuar con la estructura correcta desde sub-spec 6, refactorizar los 1–5 en una sesión dedicada

Pendiente decisión del usuario.

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

¿Quieres que cree este skill?

---

## Estado del log

| ID | Estado | Resolución |
|---|---|---|
| INC-001 | Mitigado parcialmente | CLAUDE.md creado. Sub-specs 1–5 sin JSDoc pendiente decisión |
| INC-002 | Abierto | Pendiente decisión: refactor inmediato vs deuda documentada |
