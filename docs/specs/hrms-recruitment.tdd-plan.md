# TDD Plan: hrms-recruitment

**Feature**: Pipeline de reclutamiento — vacantes, candidatos y contratación que dispara alta de empleado
**Spec de origen**: docs/specs/hrms-recruitment.spec.md
**Arch de origen**: docs/specs/hrms-recruitment.arch.md
**Fecha**: 2026-06-19
**Total de tests planificados**: 37

---

## Resumen

- Tests unitarios de dominio: 9
- Tests unitarios de aplicación (con mocks): 16
- Tests de integración HTTP / presentación: 12

---

## Cobertura de invariantes

| Invariante del spec | Test(s) que lo cubren |
|---|---|
| 1 — Solo transiciones válidas del pipeline → 422 | `1.3` (dominio), `2.6` (use case), `4.6` (HTTP) |
| 2 — Candidato HIRED no puede cambiar de status | `1.8` (dominio), `2.7` (use case) |
| 3 — hire: employee + onboarding en una sola transacción | `2.9` (use case — `repo.hire()` llamado exactamente una vez, atómico) |
| 4 — hired_as_employee_id único — no se puede contratar dos veces | `2.10` (ConflictError si ya tiene hired_as_employee_id) |

---

## Secuencia de implementación

### Iteración 1 — Dominio: `Candidate` (Red/Green/Refactor)

Archivo: `packages/core-tests/src/domain/candidate.test.ts`
Implementación en: `packages/core/src/domain/candidate.ts`

#### Test 1.1
- **Nombre**: `given_candidate_data_when_accessing_status_then_returns_APPLIED`
- **Tipo**: unitario
- **Arrange**: `new Candidate({ id:'c-1', status:'APPLIED', hiredAsEmployeeId:null, ...rest })`
- **Act**: `candidate.status`
- **Assert**: `=== 'APPLIED'`
- **GREEN**: Clase `Candidate` con getter `status` que retorna `this.data.status`

#### Test 1.2
- **Nombre**: `given_APPLIED_candidate_when_assertCanTransitionTo_SCREENING_then_does_not_throw`
- **Tipo**: unitario
- **Arrange**: `Candidate` con status `APPLIED`
- **Act**: `candidate.assertCanTransitionTo('SCREENING')`
- **Assert**: No lanza excepción
- **GREEN**: `CANDIDATE_TRANSITIONS` map + `assertCanTransitionTo()` valida que `next` está en la lista

#### Test 1.3 — cubre Invariante 1
- **Nombre**: `given_APPLIED_candidate_when_assertCanTransitionTo_INTERVIEW_then_throws_ValidationError`
- **Tipo**: unitario
- **Arrange**: `Candidate` con status `APPLIED`
- **Act**: `candidate.assertCanTransitionTo('INTERVIEW')`
- **Assert**: `throws ValidationError`
- **GREEN**: Lanza `ValidationError` si `next` no está en `CANDIDATE_TRANSITIONS[currentStatus]`

#### Test 1.4
- **Nombre**: `given_OFFER_candidate_when_assertReadyToHire_then_does_not_throw`
- **Tipo**: unitario
- **Arrange**: `Candidate` con status `OFFER`
- **Act**: `candidate.assertReadyToHire()`
- **Assert**: No lanza excepción
- **GREEN**: `assertReadyToHire()` solo lanza si `status !== 'OFFER'`

#### Test 1.5
- **Nombre**: `given_SCREENING_candidate_when_assertReadyToHire_then_throws_ValidationError`
- **Tipo**: unitario
- **Arrange**: `Candidate` con status `SCREENING`
- **Act**: `candidate.assertReadyToHire()`
- **Assert**: `throws ValidationError`

#### Test 1.6
- **Nombre**: `given_HIRED_candidate_when_isTerminal_then_returns_true`
- **Tipo**: unitario
- **Arrange**: `Candidate` con status `HIRED`
- **Act**: `candidate.isTerminal()`
- **Assert**: `=== true`
- **GREEN**: `isTerminal()` retorna `status === 'HIRED' || status === 'REJECTED'`

#### Test 1.7
- **Nombre**: `given_APPLIED_candidate_when_isTerminal_then_returns_false`
- **Tipo**: unitario
- **Arrange**: `Candidate` con status `APPLIED`
- **Act**: `candidate.isTerminal()`
- **Assert**: `=== false`

#### Test 1.8 — cubre Invariante 2
- **Nombre**: `given_HIRED_candidate_when_assertCanTransitionTo_any_status_then_throws_ValidationError`
- **Tipo**: unitario
- **Arrange**: `Candidate` con status `HIRED`
- **Act**: `candidate.assertCanTransitionTo('REJECTED')`
- **Assert**: `throws ValidationError` (lista de transiciones de HIRED está vacía)

#### Test 1.9
- **Nombre**: `given_REJECTED_candidate_when_assertCanTransitionTo_any_status_then_throws_ValidationError`
- **Tipo**: unitario
- **Arrange**: `Candidate` con status `REJECTED`
- **Act**: `candidate.assertCanTransitionTo('SCREENING')`
- **Assert**: `throws ValidationError`

---

### Iteración 2 — Casos de uso (Red/Green/Refactor)

Archivo: `packages/core-tests/src/usecases/`
Framework: `bun:test` con `mock()` factory

#### Test 2.1 — CreateJobPostingUseCase
- **Nombre**: `given_valid_input_when_creating_job_posting_then_returns_posting_with_OPEN_status`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `createJobPosting` retornando posting con `status:'OPEN'`
- **Act**: `useCase.execute({ title, departmentId, description })`
- **Assert**: `result.status === 'OPEN'`
- **Mocks**: `IRecruitmentRepository.createJobPosting`, `IFindDepartmentById.findById`

#### Test 2.2 — CreateJobPostingUseCase
- **Nombre**: `given_nonexistent_department_when_creating_job_posting_then_throws_NotFoundError`
- **Tipo**: unitario con mock
- **Arrange**: `deptRepo.findById` retorna `null`
- **Act**: `useCase.execute({ departmentId: 'bad-id', ... })`
- **Assert**: `throws NotFoundError`

#### Test 2.3 — ListJobPostingsUseCase
- **Nombre**: `given_status_filter_when_listing_postings_then_passes_filter_to_repository`
- **Tipo**: unitario con mock
- **Arrange**: `repo.listJobPostings` retorna array vacío
- **Act**: `useCase.execute({ status: 'OPEN' })`
- **Assert**: `repo.listJobPostings` fue llamado con `'OPEN'`

#### Test 2.4 — CreateCandidateUseCase
- **Nombre**: `given_valid_input_when_creating_candidate_then_returns_candidate_with_APPLIED_status`
- **Tipo**: unitario con mock
- **Arrange**: `repo.existsCandidateByEmailAndPosting` → `false`; `repo.createCandidate` → `CandidateData`
- **Act**: `useCase.execute({ postingId, fullName, email })`
- **Assert**: resultado tiene `status === 'APPLIED'`
- **Mocks**: `IRecruitmentRepository`

#### Test 2.5 — CreateCandidateUseCase
- **Nombre**: `given_duplicate_email_for_same_posting_when_creating_candidate_then_throws_ConflictError`
- **Tipo**: unitario con mock
- **Arrange**: `repo.existsCandidateByEmailAndPosting` → `true`
- **Act**: `useCase.execute({ email: 'dup@test.com', postingId: 'p-1', ... })`
- **Assert**: `throws ConflictError`

#### Test 2.6 — AdvanceCandidateStatusUseCase — cubre Invariante 1
- **Nombre**: `given_APPLIED_candidate_when_advancing_to_invalid_status_then_throws_ValidationError`
- **Tipo**: unitario con mock
- **Arrange**: `repo.findCandidateById` → `CandidateData{status:'APPLIED'}`
- **Act**: `useCase.execute({ candidateId: 'c-1', status: 'INTERVIEW' })`
- **Assert**: `throws ValidationError` (transición APPLIED→INTERVIEW inválida)

#### Test 2.7 — AdvanceCandidateStatusUseCase — cubre Invariante 2
- **Nombre**: `given_HIRED_candidate_when_advancing_status_then_throws_ValidationError`
- **Tipo**: unitario con mock
- **Arrange**: `repo.findCandidateById` → `CandidateData{status:'HIRED'}`
- **Act**: `useCase.execute({ candidateId: 'c-1', status: 'REJECTED' })`
- **Assert**: `throws ValidationError`

#### Test 2.8 — AdvanceCandidateStatusUseCase
- **Nombre**: `given_APPLIED_candidate_when_advancing_to_SCREENING_then_calls_repo_updateStatus`
- **Tipo**: unitario con mock
- **Arrange**: `repo.findCandidateById` → `CandidateData{status:'APPLIED'}`; `updateCandidateStatus` → `CandidateData{status:'SCREENING'}`
- **Act**: `useCase.execute({ candidateId: 'c-1', status: 'SCREENING' })`
- **Assert**: `repo.updateCandidateStatus` llamado con `('c-1', 'SCREENING')`; resultado tiene `status:'SCREENING'`

#### Test 2.9 — HireCandidateUseCase — cubre Invariante 3
- **Nombre**: `given_OFFER_candidate_when_hiring_with_valid_data_then_calls_repo_hire_once`
- **Tipo**: unitario con mock
- **Arrange**: `repo.findCandidateById` → `CandidateData{status:'OFFER', hiredAsEmployeeId:null}`; `repo.hire` → `HireResult`
- **Act**: `useCase.execute({ candidateId:'c-1', hireDate:'2026-06-19', salary:50000, ... })`
- **Assert**: `repo.hire` llamado exactamente una vez con `candidateId` y los datos de contratación
- **Mocks**: `IRecruitmentRepository` completo

#### Test 2.10 — HireCandidateUseCase — cubre Invariante 4
- **Nombre**: `given_already_hired_candidate_when_hiring_then_throws_ConflictError`
- **Tipo**: unitario con mock
- **Arrange**: `repo.findCandidateById` → `CandidateData{status:'HIRED', hiredAsEmployeeId:'emp-1'}`
- **Act**: `useCase.execute({ candidateId:'c-1', ... })`
- **Assert**: `throws ConflictError`

#### Test 2.11 — HireCandidateUseCase
- **Nombre**: `given_candidate_not_in_OFFER_status_when_hiring_then_throws_ValidationError`
- **Tipo**: unitario con mock
- **Arrange**: `repo.findCandidateById` → `CandidateData{status:'SCREENING'}`
- **Act**: `useCase.execute({ candidateId:'c-1', ... })`
- **Assert**: `throws ValidationError`

#### Test 2.12 — HireCandidateUseCase
- **Nombre**: `given_zero_salary_when_hiring_then_throws_ValidationError`
- **Tipo**: unitario con mock
- **Arrange**: `repo.findCandidateById` → `CandidateData{status:'OFFER'}`
- **Act**: `useCase.execute({ candidateId:'c-1', salary:0, ... })`
- **Assert**: `throws ValidationError`

#### Test 2.13 — HireCandidateUseCase
- **Nombre**: `given_negative_salary_when_hiring_then_throws_ValidationError`
- **Tipo**: unitario con mock
- **Arrange**: `repo.findCandidateById` → `CandidateData{status:'OFFER'}`
- **Act**: `useCase.execute({ candidateId:'c-1', salary:-1000, ... })`
- **Assert**: `throws ValidationError`

#### Test 2.14 — HireCandidateUseCase
- **Nombre**: `given_nonexistent_candidate_when_hiring_then_throws_NotFoundError`
- **Tipo**: unitario con mock
- **Arrange**: `repo.findCandidateById` → `null`
- **Act**: `useCase.execute({ candidateId:'bad-id', ... })`
- **Assert**: `throws NotFoundError`

#### Test 2.15 — AdvanceCandidateStatusUseCase
- **Nombre**: `given_nonexistent_candidate_when_advancing_status_then_throws_NotFoundError`
- **Tipo**: unitario con mock
- **Arrange**: `repo.findCandidateById` → `null`
- **Act**: `useCase.execute({ candidateId:'bad-id', status:'SCREENING' })`
- **Assert**: `throws NotFoundError`

#### Test 2.16 — ListCandidatesUseCase
- **Nombre**: `given_posting_id_when_listing_candidates_then_passes_posting_id_to_repository`
- **Tipo**: unitario con mock
- **Arrange**: `repo.listCandidates` → `[]`
- **Act**: `useCase.execute({ postingId: 'p-1' })`
- **Assert**: `repo.listCandidates` llamado con `'p-1'`

---

### Iteración 3 — Presentación HTTP (integración con mocks de use cases)

Archivo: `packages/api/src/__tests__/recruitment.controller.test.ts`
Framework: Hono + SignJWT + `bun:test`

#### Test 3.1
- **Nombre**: `given_no_auth_token_when_GET_job_postings_then_returns_401`
- **Act**: `GET /job-postings` sin Authorization header
- **Assert**: status `401`

#### Test 3.2
- **Nombre**: `given_no_recruitment_canView_when_GET_job_postings_then_returns_403`
- **Arrange**: token con `recruitment.canView: false`
- **Act**: `GET /job-postings`
- **Assert**: status `403`

#### Test 3.3
- **Nombre**: `given_recruitment_canView_when_GET_job_postings_then_returns_200_with_array`
- **Arrange**: token con `canView: true`; `listJobPostings.execute` → `[postingData]`
- **Act**: `GET /job-postings`
- **Assert**: status `200`, body es array con 1 elemento

#### Test 3.4
- **Nombre**: `given_valid_body_and_canEdit_when_POST_job_postings_then_returns_201`
- **Arrange**: token con `canEdit: true`; `createJobPosting.execute` → `postingData`
- **Act**: `POST /job-postings` body `{title, departmentId, description}`
- **Assert**: status `201`

#### Test 3.5
- **Nombre**: `given_missing_title_when_POST_job_postings_then_returns_400`
- **Arrange**: token con `canEdit: true`
- **Act**: `POST /job-postings` body `{departmentId, description}` (sin title)
- **Assert**: status `400`

#### Test 3.6
- **Nombre**: `given_canView_when_GET_candidates_for_posting_then_returns_200`
- **Arrange**: token con `canView: true`; `listCandidates.execute` → `[candidateData]`
- **Act**: `GET /job-postings/:id/candidates`
- **Assert**: status `200`

#### Test 3.7
- **Nombre**: `given_valid_body_and_canEdit_when_POST_candidates_then_returns_201_with_APPLIED_status`
- **Arrange**: token con `canEdit: true`; `createCandidate.execute` → `candidateData{status:'APPLIED'}`
- **Act**: `POST /candidates`
- **Assert**: status `201`, `body.status === 'APPLIED'`

#### Test 3.8
- **Nombre**: `given_ConflictError_when_POST_candidates_then_returns_409`
- **Arrange**: `createCandidate.execute` lanza `ConflictError`
- **Act**: `POST /candidates`
- **Assert**: status `409`

#### Test 3.9
- **Nombre**: `given_valid_transition_and_canEdit_when_PATCH_candidate_status_then_returns_200`
- **Arrange**: token con `canEdit: true`; `advanceCandidateStatus.execute` → `candidateData`
- **Act**: `PATCH /candidates/:id/status` body `{status:'SCREENING'}`
- **Assert**: status `200`

#### Test 3.10
- **Nombre**: `given_ValidationError_on_invalid_transition_when_PATCH_status_then_returns_422`
- **Arrange**: `advanceCandidateStatus.execute` lanza `ValidationError`
- **Act**: `PATCH /candidates/:id/status` body `{status:'HIRED'}`
- **Assert**: status `422`

#### Test 3.11
- **Nombre**: `given_OFFER_candidate_and_canEdit_when_POST_hire_then_returns_201_with_candidate_and_employeeId`
- **Arrange**: token con `canEdit: true`; `hireCandidate.execute` → `{candidate, employeeId}`
- **Act**: `POST /candidates/:id/hire` body válido
- **Assert**: status `201`, body tiene `candidate` y `employeeId`

#### Test 3.12
- **Nombre**: `given_ValidationError_when_POST_hire_then_returns_422`
- **Arrange**: `hireCandidate.execute` lanza `ValidationError` (status != OFFER)
- **Act**: `POST /candidates/:id/hire`
- **Assert**: status `422`

---

## Tests de segunda prioridad

- `given_OPEN_posting_when_closing_it_then_status_becomes_CLOSED` — `UpdateJobPostingUseCase` happy path; la lógica es trivial una vez que la máquina de estados funciona
- `given_empty_title_when_creating_posting_then_throws_ValidationError` — validación de string vacío en `CreateJobPostingUseCase`
- `given_invalid_resume_url_scheme_when_creating_candidate_then_throws_ValidationError` — SEC-2; la validación de URL es un edge case de seguridad relevante pero no bloquea el MVP

---

## Tests excluidos y motivo

| Test candidato | Motivo de exclusión |
|---|---|
| Test de integración de `RecruitmentRepository.hire()` contra BD real | La atomicidad de la transacción se verifica manualmente (checklist del impact.md); el test de use case con mock cubre el contrato |
| Test E2E de flujo completo (login → crear posting → candidato → contratar → ver empleado) | Costo de setup alto; los tests de presentación por endpoint cubren el contrato HTTP |
| Paginación de candidatos | No está en el spec v1 |

---

## Próximo paso

Continuar con `/tdd-plan-ui` para los componentes Angular del módulo recruitment.
