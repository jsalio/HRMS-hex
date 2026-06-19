import type { BenefitPlanData, BenefitPlanType, EmployeeBenefitData } from '../domain/benefit-plan'

export type { BenefitPlanData, BenefitPlanType, EmployeeBenefitData }

/** Input shape for creating a new benefit plan. */
export interface CreateBenefitPlanInput {
  name: string
  type: BenefitPlanType
  description?: string
  provider?: string
  cost?: number
}

// ── Atomic capabilities — each defined once, one responsibility ──────────────

/** Capability: read all benefit plans. */
export interface IFindBenefitPlans {
  /** @returns every benefit plan in the system */
  findAll(): Promise<BenefitPlanData[]>
}

/** Capability: read a single benefit plan by identifier. */
export interface IFindBenefitPlanById {
  /** @returns the plan with the given id, or null if none exists */
  findById(id: string): Promise<BenefitPlanData | null>
}

/** Capability: read a benefit plan by its unique name. */
export interface IFindBenefitPlanByName {
  /** @returns the plan with the given name, or null if none exists */
  findByName(name: string): Promise<BenefitPlanData | null>
}

/** Capability: persist a new benefit plan. */
export interface ICreateBenefitPlan {
  /** Persists a new plan and returns it with its generated id. */
  create(data: CreateBenefitPlanInput): Promise<BenefitPlanData>
}

/** Capability: update an existing benefit plan. */
export interface IUpdateBenefitPlan {
  /** Updates the given fields on the plan and returns the updated record. */
  update(id: string, data: Partial<CreateBenefitPlanInput> & { isActive?: boolean }): Promise<BenefitPlanData>
}

/** Capability: read all active enrollments of an employee. */
export interface IFindEmployeeBenefits {
  /** @returns all enrollment records for the employee, including plan details */
  findByEmployee(employeeId: string): Promise<EmployeeBenefitData[]>
}

/** Capability: read a specific enrollment record. */
export interface IFindEnrollment {
  /** @returns the enrollment record for the employee–plan pair, or null */
  findEnrollment(employeeId: string, planId: string): Promise<EmployeeBenefitData | null>
}

/** Capability: create an enrollment record. */
export interface IEnrollBenefit {
  /** Persists a new enrollment and returns it. */
  enroll(employeeId: string, planId: string, enrolledAt: string): Promise<EmployeeBenefitData>
}

/** Capability: set the unenrollment date on an existing enrollment. */
export interface IUnenrollBenefit {
  /** Sets unenrolled_at on the matching enrollment and returns the updated record. */
  unenroll(employeeId: string, planId: string, unenrolledAt: string): Promise<EmployeeBenefitData>
}

// ── Use-case contracts — composed from exactly the needed capabilities ───────

/** Dependencies of the list-benefit-plans use case. */
export type ListBenefitPlansRepository = IFindBenefitPlans

/** Dependencies of the create-benefit-plan use case. */
export type CreateBenefitPlanRepository = IFindBenefitPlanByName & ICreateBenefitPlan

/** Dependencies of the update-benefit-plan use case. */
export type UpdateBenefitPlanRepository = IFindBenefitPlanById & IUpdateBenefitPlan

/** Dependencies of the get-employee-benefits use case. */
export type GetEmployeeBenefitsRepository = IFindEmployeeBenefits

/** Dependencies of the enroll-benefit use case. */
export type EnrollBenefitRepository = IFindBenefitPlanById & IFindEnrollment & IEnrollBenefit

/** Dependencies of the unenroll-benefit use case. */
export type UnenrollBenefitRepository = IFindEnrollment & IUnenrollBenefit

// ── Full persistence port — the single adapter implements every capability ───

/**
 * Persistence port for benefits. Implemented by one adapter in the boundary
 * layer, which therefore satisfies every composed use-case contract above.
 */
export interface IBenefitRepository
  extends IFindBenefitPlans, IFindBenefitPlanById, IFindBenefitPlanByName,
          ICreateBenefitPlan, IUpdateBenefitPlan,
          IFindEmployeeBenefits, IFindEnrollment,
          IEnrollBenefit, IUnenrollBenefit {}
