import { Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'

/** Represents a benefit plan as returned by the API. */
export interface BenefitPlan {
  id: string
  name: string
  type: string
  description: string | null
  provider: string | null
  cost: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Represents an employee–plan enrollment record. */
export interface EmployeeBenefit {
  id: string
  employeeId: string
  planId: string
  enrolledAt: string
  unenrolledAt: string | null
  plan?: BenefitPlan
}

/** Input for creating a new benefit plan. */
export interface CreateBenefitPlanDto {
  name: string
  type: string
  description?: string
  provider?: string
  cost?: number
}

/** Input for updating an existing benefit plan. */
export interface UpdateBenefitPlanDto {
  name?: string
  type?: string
  description?: string
  provider?: string
  cost?: number
  isActive?: boolean
}

/**
 * HTTP client service for all benefit-related API endpoints.
 */
@Injectable({ providedIn: 'root' })
export class BenefitsService {
  private readonly http = inject(HttpClient)
  private readonly base = '/api'

  /**
   * Fetches all benefit plans from the catalogue.
   *
   * @returns the full list of benefit plans
   */
  getBenefitPlans(): Promise<BenefitPlan[]> {
    return firstValueFrom(this.http.get<BenefitPlan[]>(`${this.base}/benefit-plans`))
  }

  /**
   * Creates a new benefit plan.
   *
   * @param data - plan name, type, and optional metadata
   * @returns the created benefit plan
   */
  createBenefitPlan(data: CreateBenefitPlanDto): Promise<BenefitPlan> {
    return firstValueFrom(this.http.post<BenefitPlan>(`${this.base}/benefit-plans`, data))
  }

  /**
   * Updates an existing benefit plan.
   *
   * @param id - identifier of the plan to update
   * @param data - fields to update
   * @returns the updated benefit plan
   */
  updateBenefitPlan(id: string, data: UpdateBenefitPlanDto): Promise<BenefitPlan> {
    return firstValueFrom(this.http.patch<BenefitPlan>(`${this.base}/benefit-plans/${id}`, data))
  }

  /**
   * Fetches all benefit enrollments for an employee.
   *
   * @param employeeId - the employee whose enrollments are retrieved
   * @returns the employee's enrollment records including plan details
   */
  getEmployeeBenefits(employeeId: string): Promise<EmployeeBenefit[]> {
    return firstValueFrom(this.http.get<EmployeeBenefit[]>(`${this.base}/employees/${employeeId}/benefits`))
  }

  /**
   * Enrolls an employee in a benefit plan.
   *
   * @param employeeId - the employee to enroll
   * @param planId - the plan to enroll the employee in
   * @param enrolledAt - ISO date string for the enrollment start date
   * @returns the created enrollment record
   */
  enrollBenefit(employeeId: string, planId: string, enrolledAt: string): Promise<EmployeeBenefit> {
    return firstValueFrom(
      this.http.post<EmployeeBenefit>(`${this.base}/employees/${employeeId}/benefits`, {
        plan_id: planId, enrolled_at: enrolledAt,
      }),
    )
  }

  /**
   * Unenrolls an employee from a benefit plan.
   *
   * @param employeeId - the employee to unenroll
   * @param planId - the plan to unenroll from
   * @returns the updated enrollment record with unenrolledAt set
   */
  unenrollBenefit(employeeId: string, planId: string): Promise<EmployeeBenefit> {
    return firstValueFrom(
      this.http.delete<EmployeeBenefit>(`${this.base}/employees/${employeeId}/benefits/${planId}`),
    )
  }
}
