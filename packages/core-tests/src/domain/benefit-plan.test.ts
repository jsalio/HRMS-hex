import { describe, it, expect } from 'bun:test'
import { BenefitPlan, assertValidPlanType } from '@hrms/core/domain/benefit-plan'
import { ValidationError } from '@hrms/core/domain/errors'
import type { BenefitPlanData } from '@hrms/core/domain/benefit-plan'

const activePlanData: BenefitPlanData = {
  id: 'p-1',
  name: 'Health Plan',
  type: 'health',
  description: null,
  provider: null,
  cost: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

describe('BenefitPlan', () => {
  // Test 1.1
  it('given_active_plan_when_assertIsActive_then_does_not_throw', () => {
    const plan = new BenefitPlan(activePlanData)
    expect(() => plan.assertIsActive()).not.toThrow()
  })

  // Test 1.2
  it('given_inactive_plan_when_assertIsActive_then_throws_ValidationError', () => {
    const plan = new BenefitPlan({ ...activePlanData, isActive: false })
    expect(() => plan.assertIsActive()).toThrow(ValidationError)
  })

  // Test 1.3
  it('given_invalid_type_string_when_assertValidPlanType_then_throws_ValidationError', () => {
    expect(() => assertValidPlanType('invalid_type')).toThrow(ValidationError)
  })
})
