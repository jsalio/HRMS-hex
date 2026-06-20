# TDD Plan UI: hrms-recruitment

**Feature**: Pipeline de reclutamiento — vacantes, candidatos y contratación
**Spec de origen**: docs/specs/hrms-recruitment.spec.md
**Fecha**: 2026-06-19
**Framework UI**: Angular 17+ (standalone components, Signals, ngx-translate)
**Total de tests planificados**: 28

---

## Resumen

- Componentes Smart: 4 (todos conectados a `RecruitmentService`)
- Componentes Dumb: 1 (`CandidatePipelineStepperComponent` — pipeline visual)
- Tests de integración entre componentes: 2

---

## Clasificación de componentes

| Componente | Tipo | Responsabilidad | Dependencias |
|---|---|---|---|
| `RecruitmentPageComponent` | Smart | Lista vacantes, botón crear | `RecruitmentService`, `Router` |
| `JobPostingDetailPageComponent` | Smart | Lista candidatos de una vacante, botón agregar | `RecruitmentService`, `ActivatedRoute`, `Router` |
| `CandidateProfilePageComponent` | Smart | Perfil + pipeline stepper + avanzar/rechazar/contratar | `RecruitmentService`, `ActivatedRoute`, `Router` |
| `HireFormPageComponent` | Smart | Formulario de contratación | `RecruitmentService`, `ActivatedRoute`, `Router` |
| `CandidatePipelineStepperComponent` | Dumb | Pipeline visual con steps resaltados | `@Input() status: CandidateStatus` |

---

## Estados por componente

| Componente | IDLE | LOADING | SUCCESS | ERROR | EMPTY |
|---|---|---|---|---|---|
| `RecruitmentPageComponent` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `JobPostingDetailPageComponent` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `CandidateProfilePageComponent` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `HireFormPageComponent` | ✅ | ✅ | ❌ (navega) | ✅ | ❌ |
| `CandidatePipelineStepperComponent` | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Plan por componente

### CandidatePipelineStepperComponent — Dumb

Testear primero por ser dumb y sin dependencias externas.

#### Test 1.1
- **Nombre**: `dado_status_APPLIED_entonces_primer_step_esta_activo_y_el_resto_pendientes`
- **Tipo**: unitario de render
- **Arrange**: `status = 'APPLIED'`
- **Act**: renderizar componente
- **Assert**: step "APPLIED" tiene clase `active`; steps SCREENING, INTERVIEW, OFFER no tienen clase `active`

#### Test 1.2
- **Nombre**: `dado_status_INTERVIEW_entonces_steps_anteriores_marcados_como_completados`
- **Tipo**: unitario de render
- **Arrange**: `status = 'INTERVIEW'`
- **Act**: renderizar componente
- **Assert**: APPLIED y SCREENING tienen clase `completed`; INTERVIEW tiene clase `active`

#### Test 1.3
- **Nombre**: `dado_status_HIRED_entonces_todos_los_steps_del_pipeline_estan_completados`
- **Tipo**: unitario de render
- **Arrange**: `status = 'HIRED'`
- **Act**: renderizar componente
- **Assert**: badge "Contratado" visible; todos los steps tienen clase `completed`

#### Test 1.4
- **Nombre**: `dado_status_REJECTED_entonces_muestra_badge_rechazado`
- **Tipo**: unitario de render
- **Arrange**: `status = 'REJECTED'`
- **Act**: renderizar componente
- **Assert**: badge "Rechazado" visible con estilo de rechazo (clase `rejected`)

---

### RecruitmentPageComponent — Smart

#### Test 2.1 — Estado loading
- **Nombre**: `mientras_se_cargan_las_vacantes_entonces_muestra_spinner`
- **Tipo**: unitario con mock
- **Arrange**: `RecruitmentService.listJobPostings` retorna Promise que no resuelve
- **Act**: inicializar componente
- **Assert**: spinner visible; tabla de vacantes no visible
- **Mocks**: `RecruitmentService`

#### Test 2.2 — Estado success
- **Nombre**: `dado_que_hay_vacantes_cuando_carga_entonces_renderiza_la_lista_con_titulos`
- **Tipo**: unitario con mock
- **Arrange**: `listJobPostings` resuelve `[{id:'p-1', title:'Dev Senior', status:'OPEN', ...}]`
- **Act**: inicializar componente, await ngOnInit
- **Assert**: texto "Dev Senior" visible en la lista

#### Test 2.3 — Estado empty
- **Nombre**: `dado_que_no_hay_vacantes_entonces_muestra_mensaje_de_lista_vacia`
- **Tipo**: unitario con mock
- **Arrange**: `listJobPostings` resuelve `[]`
- **Act**: inicializar componente, await ngOnInit
- **Assert**: mensaje de vacío visible; tabla no visible

#### Test 2.4 — Estado error
- **Nombre**: `dado_que_el_servicio_falla_entonces_muestra_mensaje_de_error`
- **Tipo**: unitario con mock
- **Arrange**: `listJobPostings` rechaza con Error
- **Act**: inicializar componente
- **Assert**: mensaje de error visible; spinner no visible

#### Test 2.5 — Interacción: ver candidatos
- **Nombre**: `cuando_el_usuario_hace_click_en_una_vacante_entonces_navega_a_detalle_de_vacante`
- **Tipo**: unitario con mock
- **Arrange**: `listJobPostings` → `[{id:'p-1', ...}]`; `Router` mock
- **Act**: click en fila de vacante `p-1`
- **Assert**: `Router.navigate` llamado con `['/recruitment/p-1']`

#### Test 2.6 — Interacción: crear vacante
- **Nombre**: `cuando_el_usuario_hace_click_en_crear_vacante_entonces_muestra_formulario_de_nueva_vacante`
- **Tipo**: unitario con mock
- **Arrange**: `Router` mock
- **Act**: click en botón "Nueva vacante"
- **Assert**: formulario de creación visible O `Router.navigate` llamado con ruta de creación

---

### JobPostingDetailPageComponent — Smart

#### Test 3.1 — Estado loading
- **Nombre**: `mientras_se_cargan_los_candidatos_entonces_muestra_spinner`
- **Tipo**: unitario con mock
- **Arrange**: `listCandidates` retorna Promise pendiente; `ActivatedRoute.params` → `{postingId:'p-1'}`
- **Act**: inicializar componente
- **Assert**: spinner visible

#### Test 3.2 — Estado success
- **Nombre**: `dado_que_hay_candidatos_cuando_carga_entonces_renderiza_sus_nombres_y_status`
- **Tipo**: unitario con mock
- **Arrange**: `listCandidates` resuelve `[{id:'c-1', fullName:'Ana García', status:'SCREENING', ...}]`
- **Act**: await ngOnInit
- **Assert**: "Ana García" visible; badge "SCREENING" visible

#### Test 3.3 — Estado empty
- **Nombre**: `dado_que_no_hay_candidatos_entonces_muestra_mensaje_sin_candidatos`
- **Tipo**: unitario con mock
- **Arrange**: `listCandidates` resuelve `[]`
- **Act**: await ngOnInit
- **Assert**: mensaje "Sin candidatos" visible

#### Test 3.4 — Estado error
- **Nombre**: `dado_que_el_servicio_falla_al_cargar_candidatos_entonces_muestra_error`
- **Tipo**: unitario con mock
- **Arrange**: `listCandidates` rechaza
- **Act**: await ngOnInit
- **Assert**: mensaje de error visible

#### Test 3.5 — Interacción: ver perfil de candidato
- **Nombre**: `cuando_el_usuario_hace_click_en_un_candidato_entonces_navega_a_su_perfil`
- **Tipo**: unitario con mock
- **Arrange**: candidato `{id:'c-1'}` en la lista; `Router` mock
- **Act**: click en fila del candidato
- **Assert**: `Router.navigate` llamado con `['/recruitment/candidate/c-1']`

---

### CandidateProfilePageComponent — Smart

#### Test 4.1 — Estado loading
- **Nombre**: `mientras_se_carga_el_candidato_entonces_muestra_spinner`
- **Tipo**: unitario con mock
- **Arrange**: `getCandidate` pendiente; `ActivatedRoute.params` → `{id:'c-1'}`
- **Act**: inicializar componente
- **Assert**: spinner visible

#### Test 4.2 — Estado success con stepper
- **Nombre**: `dado_candidato_en_INTERVIEW_cuando_carga_entonces_muestra_nombre_y_stepper_con_estado_correcto`
- **Tipo**: unitario con mock
- **Arrange**: `getCandidate` → `{id:'c-1', fullName:'Ana García', status:'INTERVIEW', ...}`
- **Act**: await ngOnInit
- **Assert**: "Ana García" visible; `CandidatePipelineStepperComponent` recibe `status='INTERVIEW'`

#### Test 4.3 — Botón contratar solo visible desde OFFER
- **Nombre**: `dado_candidato_en_OFFER_entonces_boton_contratar_es_visible`
- **Tipo**: unitario con mock
- **Arrange**: `getCandidate` → `{status:'OFFER', ...}`
- **Act**: await ngOnInit
- **Assert**: botón "Contratar" visible

#### Test 4.4 — Botón contratar no visible en status distinto a OFFER
- **Nombre**: `dado_candidato_en_INTERVIEW_entonces_boton_contratar_no_es_visible`
- **Tipo**: unitario con mock
- **Arrange**: `getCandidate` → `{status:'INTERVIEW', ...}`
- **Act**: await ngOnInit
- **Assert**: botón "Contratar" NO visible

#### Test 4.5 — Candidato terminal no permite acciones
- **Nombre**: `dado_candidato_HIRED_entonces_botones_avanzar_y_rechazar_no_son_visibles`
- **Tipo**: unitario con mock
- **Arrange**: `getCandidate` → `{status:'HIRED', ...}`
- **Act**: await ngOnInit
- **Assert**: botones "Avanzar" y "Rechazar" NO visibles

#### Test 4.6 — Interacción: avanzar status
- **Nombre**: `cuando_el_usuario_hace_click_en_avanzar_entonces_llama_al_servicio_con_siguiente_status`
- **Tipo**: unitario con mock
- **Arrange**: candidato `{status:'APPLIED'}`; `advanceCandidateStatus` resuelve `{status:'SCREENING'}`
- **Act**: click en botón "Avanzar"
- **Assert**: `RecruitmentService.advanceCandidateStatus` llamado con `('c-1', 'SCREENING')`

#### Test 4.7 — Estado error al avanzar
- **Nombre**: `dado_que_avanzar_status_falla_entonces_muestra_mensaje_de_error_sin_navegar`
- **Tipo**: unitario con mock
- **Arrange**: `advanceCandidateStatus` rechaza
- **Act**: click en "Avanzar"
- **Assert**: mensaje de error visible; URL no cambia

#### Test 4.8 — Interacción: ir a formulario de contratación
- **Nombre**: `dado_candidato_en_OFFER_cuando_usuario_hace_click_en_contratar_entonces_navega_a_hire_form`
- **Tipo**: unitario con mock
- **Arrange**: candidato `{id:'c-1', status:'OFFER'}`; `Router` mock
- **Act**: click en "Contratar"
- **Assert**: `Router.navigate` llamado con `['/recruitment/candidate/c-1/hire']`

---

### HireFormPageComponent — Smart

#### Test 5.1 — Estado idle (form vacío)
- **Nombre**: `cuando_el_formulario_carga_entonces_todos_los_campos_estan_vacios`
- **Tipo**: unitario con mock
- **Arrange**: `ActivatedRoute.params` → `{id:'c-1'}`
- **Act**: renderizar componente
- **Assert**: campos hireDate, salary, corporateEmail, documentId vacíos

#### Test 5.2 — Validación: submit con formulario vacío
- **Nombre**: `dado_formulario_vacio_cuando_usuario_hace_submit_entonces_no_llama_al_servicio`
- **Tipo**: unitario con mock
- **Arrange**: todos los campos vacíos
- **Act**: click en "Confirmar contratación"
- **Assert**: `RecruitmentService.hireCandidate` NO llamado; errores de validación visibles

#### Test 5.3 — Estado loading al enviar
- **Nombre**: `dado_formulario_valido_cuando_usuario_hace_submit_entonces_muestra_spinner_y_deshabilita_boton`
- **Tipo**: unitario con mock
- **Arrange**: formulario válido; `hireCandidate` retorna Promise pendiente
- **Act**: click en "Confirmar"
- **Assert**: spinner visible; botón submit `disabled`

#### Test 5.4 — Navegación exitosa al empleado
- **Nombre**: `dado_hire_exitoso_cuando_servicio_retorna_employeeId_entonces_navega_a_detalle_del_empleado`
- **Tipo**: unitario con mock
- **Arrange**: `hireCandidate` resuelve `{employeeId:'emp-1', candidate:{...}}`; `Router` mock
- **Act**: submit del formulario
- **Assert**: `Router.navigate` llamado con `['/employees/emp-1']`

#### Test 5.5 — Estado error al contratar
- **Nombre**: `dado_que_el_servicio_falla_al_contratar_entonces_muestra_mensaje_de_error_y_habilita_el_boton`
- **Tipo**: unitario con mock
- **Arrange**: `hireCandidate` rechaza con Error
- **Act**: submit del formulario válido
- **Assert**: mensaje de error visible; botón "Confirmar" habilitado nuevamente

---

## Tests de integración entre componentes

#### Test I.1 — RecruitmentPage + JobPostingDetail
- **Nombre**: `cuando_usuario_navega_de_lista_de_vacantes_a_candidatos_entonces_se_pasa_el_posting_id_correcto`
- **Tipo**: integración
- **Componentes**: `RecruitmentPageComponent` → `JobPostingDetailPageComponent` (vía Router)
- **Arrange**: vacante `{id:'p-1', title:'Dev'}`; `listCandidates` mock
- **Act**: click en vacante p-1 → navegación → init de JobPostingDetail
- **Assert**: `listCandidates` llamado con `'p-1'`

#### Test I.2 — CandidateProfile + CandidatePipelineStepper
- **Nombre**: `cuando_status_del_candidato_es_OFFER_entonces_stepper_resalta_el_step_OFFER`
- **Tipo**: integración
- **Componentes**: `CandidateProfilePageComponent` + `CandidatePipelineStepperComponent`
- **Arrange**: candidato `{status:'OFFER'}`
- **Act**: renderizar `CandidateProfilePage` (que incluye stepper)
- **Assert**: en el DOM del stepper, el step OFFER tiene clase `active`

---

## Tests de segunda prioridad

- `dado_formulario_de_nueva_vacante_vacio_cuando_submit_entonces_muestra_errores_de_validacion` — modal/form de creación de vacante; la validación del formulario es importante pero el flujo base (lista → crear) tiene mayor prioridad
- `cuando_usuario_hace_click_en_rechazar_entonces_muestra_confirmacion_antes_de_rechazar` — diálogo de confirmación antes de REJECTED; la UX es mejor con confirm pero no bloquea el MVP
- `dado_error_de_red_cuando_carga_lista_entonces_muestra_boton_reintentar` — retry en estados de error; todos los componentes lo pueden necesitar pero es segunda iteración

---

## Tests excluidos y motivo

| Test candidato | Motivo de exclusión |
|---|---|
| Verificar colores del stepper (azul activo, gris pendiente) | Detalle visual, no comportamiento |
| Test de paginación en lista de vacantes | No está en el spec v1 |
| Test de búsqueda/filtro de candidatos por nombre | No está en el spec v1 |
| Test visual del formulario (layout, espaciado) | Scope de diseño, no de comportamiento |
| Test E2E completo (login → crear vacante → candidato → contratar) | Alto costo de setup; cubierto por tests unitarios de cada componente |

---

## Próximo paso

Continuar con `/why` para documentar el motivo de cada cambio antes de implementar.
