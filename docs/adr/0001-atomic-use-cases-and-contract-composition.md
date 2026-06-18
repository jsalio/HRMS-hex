# ADR-0001 — Use cases atómicos y composición de contratos

- **Estado**: Aceptada
- **Fecha**: 2026-06-18
- **Contexto SDD**: resuelve INC-002 del `docs/sdd-incident-log.md` y formaliza el principio del skill `contract-composition`.

---

## Contexto

El pipeline SDD define dos principios que el código de los sub-specs 1–5 violó:

1. **SRP (un caso de uso por clase)** — los skills `/sdd` y `/arch` lo declaran, pero la implementación agrupó múltiples operaciones en clases `ManageXUseCase` (Facade). Registrado como **INC-002**.
2. **Composición de contratos** — el skill `contract-composition` establece: capacidades atómicas (definidas una vez) → contratos por caso de uso compuestos de *exactamente* lo necesario → una implementación. El código usaba interfaces "gordas" por entidad (`IRoleRepository` con 6 métodos), de modo que cada operación dependía de métodos que no usa (violación de ISP).

Ambos principios estaban **documentados pero no enforced**: existían como texto en los skills, no como decisión vinculante del proyecto ni como guardrail. Esa es la causa raíz común del incident log.

## Decisión

Se adopta como norma del proyecto, con precedencia sobre la convención previa de interfaces gordas:

### 1. Un caso de uso por clase
Cada operación de negocio es una clase con un único método público `execute(...)`, en su propio archivo `<verbo>-<entidad>.usecase.ts`. Prohibido el patrón `ManageX` con múltiples verbos.

### 2. Composición de contratos (ISP)
En la capa de contratos de cada entidad:
- **Capacidades atómicas**: una interfaz por operación de persistencia, definida una sola vez (`IFindRoleById`, `ICreateRole`, …).
- **Contrato por caso de uso**: tipo compuesto que declara solo lo que ese use case necesita (`CreateRoleRepository = IFindRoleByName & ICreateRole`).
- **Puerto completo**: `I<Entidad>Repository extends` todas las capacidades; el adapter de la capa boundary lo implementa una sola vez y satisface así todos los contratos compuestos.

El constructor de cada use case depende de su contrato compuesto, nunca del puerto completo. Para dependencias sobre **otras** entidades se reutiliza el contrato existente más estrecho disponible.

### 3. Documentación inline
Coherente con `CLAUDE.md` (modo estricto): TSDoc completo en cada clase, constructor, método público, función e interfaz/tipo exportado.

## Alcance de la migración

- **Piloto**: módulo `roles` (4 use cases). Referencia canónica del patrón.
- **Rollout**: `employees`, `departments`, `documents`, `absences`, `attendance`.
- La capa de persistencia (SQL puro, `postgres.js`) no cambia: los adapters siguen implementando el puerto completo de su entidad.

## Consecuencias

**Positivas**
- Constructores autodocumentados: el tipo de cada dependencia revela exactamente de qué infraestructura depende la operación.
- SRP real: cada clase tiene una sola razón para cambiar; tests más pequeños y enfocados.
- Sin pérdida de cohesión en la implementación: sigue habiendo un adapter por entidad.

**Negativas / costes**
- Más archivos (un use case y, normalmente, un test por operación).
- Más tipos en la capa de contratos (capacidades + contratos compuestos).
- El `container.ts` instancia más objetos (mismo número de dependencias, distinta granularidad).

**Enforcement**
- Este ADR es la fuente de verdad del principio. `/sdd-preflight` debe verificar, antes de cada `/implement`: (a) ningún use case con múltiples verbos de acción; (b) ningún use case dependiendo del puerto completo de su propia entidad.

## Alternativas descartadas

- **Mantener `ManageX` (Facade)**: viola SRP; mezcla operaciones con distintas razones de cambio en una clase. Descartada.
- **Interfaces gordas por entidad**: viola ISP; los use cases acceden a métodos que no usan. Descartada como norma (se conserva solo el puerto completo `I<Entidad>Repository` como unión de capacidades para el adapter).
