# TDD Plan UI: hrms-benefits

**Feature**: Planes de beneficios y asignación por empleado
**Spec de origen**: docs/specs/hrms-benefits.spec.md
**Fecha**: 2026-06-18
**Framework UI**: Angular 17+ — Standalone components + Signals + Karma/Jasmine
**Total de tests planificados**: 18

> **Nota de contexto**: No existen `.spec.ts` en el proyecto — estos serán los primeros tests Angular del sistema. La configuración de Karma y Jasmine ya está en `apps/hrms-ui/package.json`. Los tests usarán `TestBed.configureTestingModule()` con `provideHttpClientTesting()` para aislar las llamadas HTTP.

---

## Resumen

| Componente | Tipo | Tests planificados |
|---|---|---|
| `BenefitsAdminPageComponent` | Smart | 9 |
| `MyBenefitsPageComponent` | Smart | 7 |
| `BenefitsService` | Servicio HTTP | 2 |
| **Total** | | **18** |

No hay componentes Dumb identificados en el spec. Ambas páginas son Smart: inyectan `BenefitsService` y `AuthService`, gestionan estado con signals, y orquestan modales.

---

## Clasificación de componentes

| Componente | Tipo | Responsabilidad | Dependencias |
|---|---|---|---|
| `BenefitsAdminPageComponent` | Smart | Gestión de planes + inscripciones + bajas | `BenefitsService`, `AuthService` |
| `MyBenefitsPageComponent` | Smart | Lista de beneficios propios (solo lectura) | `BenefitsService`, `AuthService` |
| `BenefitsService` | Servicio | HTTP client — todos los endpoints | `HttpClient` |

---

## Estados por componente

| Componente | IDLE | LOADING | SUCCESS | ERROR | EMPTY |
|---|---|---|---|---|---|
| `BenefitsAdminPageComponent` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `MyBenefitsPageComponent` | — | ✅ | ✅ | ✅ | ✅ |

---

## Plan por componente

### BenefitsAdminPageComponent — Smart

Archivo: `apps/hrms-ui/src/app/benefits/benefits-admin-page.component.spec.ts`

Setup común:
```typescript
let service: jasmine.SpyObj<BenefitsService>
TestBed.configureTestingModule({
  imports: [BenefitsAdminPageComponent],
  providers: [{ provide: BenefitsService, useValue: service }]
})
```

#### Test A.1 — Estado loading al iniciar
- **Nombre**: `dado_que_el_componente_carga_cuando_ngOnInit_entonces_muestra_spinner_y_oculta_tabla`
- **Tipo**: unitario con mock
- **Arrange**: `service.getBenefitPlans` pendiente (no resuelto)
- **Act**: `fixture.detectChanges()`
- **Assert**: elemento con selector de spinner visible; tabla de planes no visible

#### Test A.2 — Lista de planes (happy path)
- **Nombre**: `dado_que_el_servicio_retorna_planes_cuando_carga_entonces_renderiza_tabla_con_N_filas`
- **Tipo**: unitario con mock
- **Arrange**: `service.getBenefitPlans` resuelve con `[plan1, plan2]`
- **Act**: `fixture.detectChanges()` + await async
- **Assert**: número de filas en la tabla coincide con el array retornado; spinner no visible

#### Test A.3 — Estado vacío
- **Nombre**: `dado_que_no_hay_planes_cuando_carga_entonces_muestra_estado_vacio`
- **Tipo**: unitario con mock
- **Arrange**: `service.getBenefitPlans` resuelve con `[]`
- **Act**: `fixture.detectChanges()` + await
- **Assert**: mensaje de estado vacío visible; tabla no visible

#### Test A.4 — Estado error
- **Nombre**: `dado_que_el_servicio_falla_cuando_carga_entonces_muestra_mensaje_de_error`
- **Tipo**: unitario con mock
- **Arrange**: `service.getBenefitPlans` rechaza con error
- **Act**: `fixture.detectChanges()` + await
- **Assert**: elemento de error visible; spinner no visible

#### Test A.5 — Abrir modal de nuevo plan
- **Nombre**: `cuando_el_usuario_hace_click_en_nuevo_plan_entonces_el_modal_de_creacion_es_visible`
- **Tipo**: unitario de interacción
- **Arrange**: componente en estado SUCCESS con planes cargados
- **Act**: click en botón "nuevo plan"
- **Assert**: modal de formulario de plan es visible (el elemento existe en el DOM)

#### Test A.6 — Abrir modal de inscripción
- **Nombre**: `cuando_el_usuario_hace_click_en_inscribir_entonces_el_modal_de_inscripcion_es_visible`
- **Tipo**: unitario de interacción
- **Arrange**: componente con planes cargados
- **Act**: click en botón "inscribir" de la primera fila
- **Assert**: modal de inscripción visible

#### Test A.7 — Confirmar dar de baja
- **Nombre**: `cuando_el_usuario_confirma_dar_de_baja_entonces_llama_unenroll_y_actualiza_la_vista`
- **Tipo**: unitario con mock
- **Arrange**: componente con inscripciones cargadas; `service.unenroll` resuelve con `enrollmentWithDate`
- **Act**: click en "dar de baja" + confirmar
- **Assert**: `service.unenroll` llamado con `(employeeId, planId)`; la fila actualizada muestra `unenrolledAt`

#### Test A.8 — Crear plan con éxito (modal submit)
- **Nombre**: `dado_formulario_valido_cuando_el_usuario_guarda_nuevo_plan_entonces_el_plan_aparece_en_la_tabla`
- **Tipo**: unitario con mock
- **Arrange**: modal de creación abierto; `service.createBenefitPlan` resuelve con `newPlan`
- **Act**: rellenar nombre y tipo → click guardar
- **Assert**: modal cierra; tabla tiene un item más; `service.createBenefitPlan` llamado con los datos del formulario

#### Test A.9 — Crear plan con nombre duplicado
- **Nombre**: `dado_formulario_valido_cuando_el_servicio_retorna_409_entonces_muestra_error_en_el_modal`
- **Tipo**: unitario con mock
- **Arrange**: `service.createBenefitPlan` rechaza con error 409
- **Act**: rellenar formulario → click guardar
- **Assert**: modal sigue abierto; mensaje de error "nombre duplicado" visible dentro del modal

---

### MyBenefitsPageComponent — Smart

Archivo: `apps/hrms-ui/src/app/benefits/my-benefits-page.component.spec.ts`

Setup: mockear `BenefitsService` + `AuthService` (para `currentUser().id`).

#### Test B.1 — Estado loading
- **Nombre**: `dado_que_el_componente_carga_cuando_ngOnInit_entonces_muestra_spinner`
- **Tipo**: unitario con mock
- **Arrange**: `service.getEmployeeBenefits` pendiente
- **Act**: `fixture.detectChanges()`
- **Assert**: spinner visible; lista no visible

#### Test B.2 — Lista de beneficios (happy path)
- **Nombre**: `dado_que_el_servicio_retorna_beneficios_cuando_carga_entonces_renderiza_lista_con_nombre_tipo_proveedor`
- **Tipo**: unitario con mock
- **Arrange**: `auth.currentUser()` retorna `{ id: 'e1' }`; `service.getEmployeeBenefits('e1')` resuelve con `[enrollment1]`; `enrollment1.plan.name = 'Health Plan'`, `enrollment1.plan.type = 'health'`
- **Act**: `fixture.detectChanges()` + await
- **Assert**: "Health Plan" visible en el DOM; spinner no visible

#### Test B.3 — Estado vacío
- **Nombre**: `dado_que_el_empleado_no_tiene_beneficios_cuando_carga_entonces_muestra_estado_vacio`
- **Tipo**: unitario con mock
- **Arrange**: `service.getEmployeeBenefits` resuelve con `[]`
- **Act**: `fixture.detectChanges()` + await
- **Assert**: mensaje de estado vacío visible; lista no visible

#### Test B.4 — Estado error
- **Nombre**: `dado_que_el_servicio_falla_cuando_carga_entonces_muestra_mensaje_de_error`
- **Tipo**: unitario con mock
- **Arrange**: `service.getEmployeeBenefits` rechaza
- **Act**: `fixture.detectChanges()` + await
- **Assert**: mensaje de error visible; spinner no visible

#### Test B.5 — Solo lectura (sin botones de acción)
- **Nombre**: `dado_que_el_usuario_es_empleado_entonces_no_hay_botones_de_inscribir_ni_dar_de_baja`
- **Tipo**: unitario de render
- **Arrange**: componente renderizado con beneficios
- **Act**: `fixture.detectChanges()` + await
- **Assert**: no existe ningún elemento con texto "inscribir" o "dar de baja"

#### Test B.6 — Usa el employeeId del usuario autenticado para la query
- **Nombre**: `dado_un_usuario_autenticado_cuando_carga_entonces_llama_al_servicio_con_el_id_correcto`
- **Tipo**: unitario con mock
- **Arrange**: `auth.currentUser()` retorna `{ id: 'e42' }`
- **Act**: `fixture.detectChanges()` + await
- **Assert**: `service.getEmployeeBenefits` llamado con `'e42'`
- **Cubre invariante**: #4 — la vista de empleado solo solicita sus propios datos

#### Test B.7 — Muestra fecha de inscripción
- **Nombre**: `dado_que_hay_beneficios_activos_entonces_se_muestra_la_fecha_de_inscripcion`
- **Tipo**: unitario de render
- **Arrange**: `enrollment.enrolledAt = '2026-01-15'`
- **Act**: `fixture.detectChanges()` + await
- **Assert**: "2026-01-15" visible en la lista

---

### BenefitsService — Tests de contrato HTTP

Archivo: `apps/hrms-ui/src/app/benefits/benefits.service.spec.ts`

Usar `HttpClientTestingModule` + `HttpTestingController`.

#### Test S.1 — getBenefitPlans serializa correctamente
- **Nombre**: `dado_que_el_backend_retorna_plans_cuando_getBenefitPlans_entonces_retorna_el_array`
- **Tipo**: unitario HTTP mock
- **Arrange**: `HttpTestingController` espera `GET /benefit-plans` → responde `[planData]`
- **Act**: `service.getBenefitPlans()`
- **Assert**: resultado es array con el plan; no hay requests pendientes

#### Test S.2 — getEmployeeBenefits construye URL correctamente
- **Nombre**: `dado_employee_id_cuando_getEmployeeBenefits_entonces_llama_a_la_ruta_correcta`
- **Tipo**: unitario HTTP mock
- **Arrange**: `HttpTestingController` espera `GET /employees/e1/benefits`
- **Act**: `service.getEmployeeBenefits('e1')`
- **Assert**: request match a `/employees/e1/benefits`; no hay requests pendientes

---

## Tests de segunda prioridad

- `cuando_el_formulario_de_creacion_de_plan_esta_vacio_y_se_hace_submit_entonces_el_boton_esta_deshabilitado` — comportamiento UX de validación de formulario; menor prioridad que los flujos de negocio principales.
- `service.createBenefitPlan_serializa_el_body_correctamente` — la serialización HTTP del servicio; útil pero cubierto implícitamente por los tests del controlador backend.
- `dado_plan_inactivo_en_la_lista_entonces_muestra_badge_de_estado_inactivo` — visual state de badge; importante pero no bloquea la entrega.

---

## Tests excluidos y motivo

| Test candidato | Motivo de exclusión |
|---|---|
| Verificar que el spinner tiene la clase CSS correcta | Detalle de implementación visual, no comportamiento |
| Test de que el modal se cierra al hacer click en backdrop | Comportamiento UX secundario; no vinculado a invariantes del spec |
| `BenefitsService` — todos los métodos (createBenefitPlan, updateBenefitPlan, enroll, unenroll) | El contrato HTTP está cubierto por los tests de integración del controller (backend). Los tests S.1 y S.2 validan que el servicio construye las URLs y deserializa — el resto sigue el mismo patrón. |
| E2E del flujo completo admin → inscribir → empleado ve beneficio | No hay setup E2E en el proyecto (Playwright/Cypress). Fuera de scope. |

---

## Próximo paso

Continuar con `/why` para documentar el motivo de cada cambio antes de implementar.
