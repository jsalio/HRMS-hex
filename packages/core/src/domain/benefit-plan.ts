import { ValidationError } from './errors'

/** The set of valid benefit plan categories. */
export type BenefitPlanType = 'health' | 'life_insurance' | 'dental' | 'vision' | 'pension' | 'other'

const VALID_PLAN_TYPES: BenefitPlanType[] = ['health', 'life_insurance', 'dental', 'vision', 'pension', 'other']

/** Data transfer object for a benefit plan record. */
export interface BenefitPlanData {
  id: string
  name: string
  type: BenefitPlanType
  description: string | null
  provider: string | null
  cost: number | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/** Data transfer object for an employee–plan enrollment record. */
export interface EmployeeBenefitData {
  id: string
  employeeId: string
  planId: string
  /** ISO date string (YYYY-MM-DD) representing the enrollment start date. */
  enrolledAt: string
  /** ISO date string (YYYY-MM-DD) when the employee left the plan, or null if still active. */
  unenrolledAt: string | null
  plan?: BenefitPlanData
}

/**
 * Validates that a raw string is a recognised BenefitPlanType.
 *
 * @param type - the raw string value to check
 * @throws {ValidationError} when the value is not one of the valid plan types
 */
export function assertValidPlanType(type: string): asserts type is BenefitPlanType {
  if (!VALID_PLAN_TYPES.includes(type as BenefitPlanType)) {
    throw new ValidationError(
      `Invalid benefit plan type "${type}". Must be one of: ${VALID_PLAN_TYPES.join(', ')}`
    )
  }
}

/**
 * Domain entity representing a benefit plan offered by the organisation.
 * Enforces that only active plans can accept new enrollments.
 */
export class BenefitPlan {
  /**
   * @param data - the persistent state backing this plan instance
   */
  constructor(private readonly data: BenefitPlanData) {}

  /** @returns the plan identifier */
  get id()       { return this.data.id }
  /** @returns the plan display name */
  get name()     { return this.data.name }
  /** @returns the plan category */
  get type()     { return this.data.type }
  /** @returns whether the plan is currently accepting enrollments */
  get isActive() { return this.data.isActive }

  /**
   * Guards enrollment: the plan must be active for a new enrollment to proceed.
   *
   * @throws {ValidationError} when the plan's isActive flag is false
   */
  assertIsActive(): void {
    if (!this.data.isActive) {
      throw new ValidationError(`Benefit plan "${this.data.name}" is inactive and cannot accept new enrollments`)
    }
  }
}
