# SDD Split: HRMS-HEX — Aplicación de RRHH Completa

**Spec original**: docs/specs/hrms-hex.spec.md
**Motivo del split**: 10 módulos de dominio, 35+ endpoints, 27 pantallas, dependencias cruzadas entre módulos
**Eje de corte**: Por dominio de negocio (bounded context por módulo)
**Fecha**: 2026-06-12
**Total sub-specs**: 10

---

## Decisiones transversales (aplican a TODOS los sub-specs)

| Decisión | Valor |
|---|---|
| Stack backend | PostgreSQL + Bun + TypeScript |
| Stack frontend | Angular + Smart/Dumb components |
| Arquitectura | Hexagonal — Core(contratos) + Boundaries(tecnología) + API(ensamblaje) |
| Idioma código | Inglés (variables, clases, columnas SQL, rutas) |
| Idioma UI | i18n: es (default), en, pt — @ngx-translate/core |
| Archivos traducción | `src/assets/i18n/{es,en,pt}.json` — namespaced por módulo |
| Diseño fuente | Stitch proyecto `13650739638263912450` — desktop, #0f49bd, Inter, light |
| Auth guard | Cada ruta Angular protegida por `AuthGuard` + `PermissionGuard(module, action)` |
| Error HTTP | 401 → redirect login; 403 → página sin permiso; 404 → not-found |

---

## Mapa de dependencias

```
hrms-auth-roles (independiente — base de todo)
    └── hrms-employees (requiere auth-roles)
            ├── hrms-documents   (paralelo)
            ├── hrms-absences    (paralelo)
            ├── hrms-attendance  (paralelo)
            ├── hrms-benefits    (paralelo)
            └── hrms-recruitment (paralelo)
                    └── hrms-payroll (requiere employees + absences + attendance)
                            └── hrms-notifications (requiere todos los anteriores)
                                    └── hrms-admin (requiere todos)
```

---

## Sub-specs

### Sub-spec 1: hrms-auth-roles
- **Archivo**: `docs/specs/hrms-auth-roles.spec.md`
- **Cubre**: Login JWT, gestión de roles y permisos, app shell con i18n y sidebar
- **Entrega valor por sí solo**: Sí — sistema funcional con acceso controlado
- **Dependencias**: ninguna
- **Criterio de completitud**: Login funciona, roles CRUD, permisos por módulo configurables, sidebar con navegación y selector de idioma
- **Pantallas Stitch**: Login (diseño mínimo coherente), "Gestión de Roles y Permisos"
- **Pipeline**: /impact → /arch → /tdd-plan → /tdd-plan-ui → /why

### Sub-spec 2: hrms-employees
- **Archivo**: `docs/specs/hrms-employees.spec.md`
- **Cubre**: Expediente de empleados (CRUD), departamentos, onboarding, estados
- **Entrega valor por sí solo**: Sí — directorio de empleados navegable
- **Dependencias**: hrms-auth-roles completo
- **Criterio de completitud**: CRUD completo, baja lógica funcional, flujo onboarding verificable
- **Pantallas Stitch**: "Gestión de Empleados", "Perfil de Empleado", "Onboarding de Empleado"
- **Pipeline**: /impact → /arch → /tdd-plan → /tdd-plan-ui → /why

### Sub-spec 3: hrms-documents
- **Archivo**: `docs/specs/hrms-documents.spec.md`
- **Cubre**: Ciclo de vida de documentos (PENDING→SIGNED→ARCHIVED), firma digital, renovación
- **Entrega valor por sí solo**: Sí — gestión documental completa por empleado
- **Dependencias**: hrms-employees completo
- **Criterio de completitud**: Subir, firmar (con hash), archivar y renovar documentos; inmutabilidad verificada en tests
- **Pantallas Stitch**: "Documentos y Firmas Digitales", "Firma de Documento", "Historial de Documentos Firmados", "Detalle de Documento Archivado", "Renovación de Documento"
- **Pipeline**: /impact → /arch → /tdd-plan → /tdd-plan-ui → /why

### Sub-spec 4: hrms-absences
- **Archivo**: `docs/specs/hrms-absences.spec.md`
- **Cubre**: Tipos de ausencia, balances, solicitudes, flujo de aprobación
- **Entrega valor por sí solo**: Sí — empleados pueden solicitar ausencias y gerentes aprobar/rechazar
- **Dependencias**: hrms-employees completo
- **Criterio de completitud**: Solicitud con validación de balance, aprobación/rechazo, balance actualizado correctamente
- **Pantallas Stitch**: "Solicitud de Ausencia", "Panel de Ausencias", "Gestión de Aprobaciones"
- **Pipeline**: /impact → /arch → /tdd-plan → /tdd-plan-ui → /why

### Sub-spec 5: hrms-attendance
- **Archivo**: `docs/specs/hrms-attendance.spec.md`
- **Cubre**: Registro de asistencia diaria (check-in/check-out), cálculo de horas trabajadas
- **Entrega valor por sí solo**: Sí — control de asistencia operativo
- **Dependencias**: hrms-employees completo
- **Criterio de completitud**: Check-in/out registrado, horas calculadas automáticamente, reporte por empleado/período
- **Pantallas Stitch**: "Asistencia y Tiempo"
- **Pipeline**: /impact → /arch → /tdd-plan → /tdd-plan-ui → /why

### Sub-spec 6: hrms-payroll
- **Archivo**: `docs/specs/hrms-payroll.spec.md`
- **Cubre**: Períodos de nómina, cálculo de entries (salario + asistencia + ausencias), cierre inmutable
- **Entrega valor por sí solo**: Sí — nómina procesable y cerrable
- **Dependencias**: hrms-employees + hrms-absences + hrms-attendance completos
- **Criterio de completitud**: Período creado, procesado (entries calculadas) y cerrado; nómina cerrada no modificable
- **Pantallas Stitch**: "Gestión de Nómina"
- **Pipeline**: /impact → /arch → /tdd-plan → /tdd-plan-ui → /why

### Sub-spec 7: hrms-benefits
- **Archivo**: `docs/specs/hrms-benefits.spec.md`
- **Cubre**: Planes de beneficios, inscripción y baja de empleados en planes
- **Entrega valor por sí solo**: Sí — gestión de beneficios visible para admin y empleado
- **Dependencias**: hrms-employees completo
- **Criterio de completitud**: Admin crea planes, inscribe/baja empleados; empleado ve sus beneficios activos
- **Pantallas Stitch**: "Beneficios y Seguros - Empleado", "Gestión de Beneficios - Admin"
- **Pipeline**: /impact → /arch → /tdd-plan → /tdd-plan-ui → /why

### Sub-spec 8: hrms-recruitment
- **Archivo**: `docs/specs/hrms-recruitment.spec.md`
- **Cubre**: Vacantes, pipeline de candidatos (APPLIED→HIRED|REJECTED), contratación→alta empleado
- **Entrega valor por sí solo**: Sí — reclutamiento completo con onboarding automático al contratar
- **Dependencias**: hrms-employees completo
- **Criterio de completitud**: Candidato avanza por pipeline, al contratar se crea empleado y se dispara onboarding
- **Pantallas Stitch**: "Gestión de Reclutamiento", "Perfil del Candidato", "Oferta y Contratación"
- **Pipeline**: /impact → /arch → /tdd-plan → /tdd-plan-ui → /why

### Sub-spec 9: hrms-notifications
- **Archivo**: `docs/specs/hrms-notifications.spec.md`
- **Cubre**: Eventos de dominio, adaptador Slack de salida, configuración de webhooks, reintentos
- **Entrega valor por sí solo**: Sí — notificaciones Slack operativas para todos los módulos
- **Dependencias**: hrms-auth-roles hasta hrms-recruitment completos
- **Criterio de completitud**: Evento publicado → persiste en notification_events → enviado a Slack; fallo → FAILED reintentable
- **Pantallas Stitch**: "Configuración de Slack", "Integraciones", "Notificación en Slack", "Notificación de Renovación - Vista Empleado"
- **Pipeline**: /impact → /arch → /tdd-plan → /tdd-plan-ui → /why

### Sub-spec 10: hrms-admin
- **Archivo**: `docs/specs/hrms-admin.spec.md`
- **Cubre**: Dashboard con métricas, informes/analíticas exportables, configuración del sistema, landing page
- **Entrega valor por sí solo**: Sí — visibilidad ejecutiva completa de la plataforma
- **Dependencias**: todos los sub-specs anteriores completos
- **Criterio de completitud**: Dashboard muestra KPIs en tiempo real, reportes exportables a CSV, configuración del sistema editable
- **Pantallas Stitch**: "HRMS-HEX Admin Dashboard", "Informes y Analíticas", "Configuración del Sistema", "HRMS-HEX Landing Page"
- **Pipeline**: /impact → /arch → /tdd-plan → /tdd-plan-ui → /why

---

## Orden de implementación recomendado

| Orden | Sub-spec | Motivo |
|---|---|---|
| 1 | hrms-auth-roles | Base de todo — sin auth no hay nada |
| 2 | hrms-employees | Entidad central — todos los demás la referencian |
| 3-7 | hrms-documents, hrms-absences, hrms-attendance, hrms-benefits, hrms-recruitment | Paralelos — solo dependen de employees |
| 8 | hrms-payroll | Requiere absences + attendance para calcular |
| 9 | hrms-notifications | Consume eventos de todos los módulos |
| 10 | hrms-admin | Lee de todos — implementar al final |

---

## Qué se mueve del spec original

Todo el contenido del spec master `hrms-hex.spec.md` se distribuye en los 10 sub-specs.
El spec master queda como **documento de contexto arquitectónico** — no es un spec activo.
