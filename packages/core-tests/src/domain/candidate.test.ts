import { describe, it, expect } from 'bun:test'
import { Candidate } from '@hrms/core/domain/candidate'
import { ValidationError } from '@hrms/core/domain/errors'
import type { CandidateData } from '@hrms/core/domain/candidate'

const makeCandidate = (status: CandidateData['status'], hiredAsEmployeeId: string | null = null): Candidate =>
  new Candidate({
    id: 'c-1', postingId: 'p-1', fullName: 'Ana García',
    email: 'ana@test.com', phone: null, resumeUrl: null,
    status, notes: null, hiredAsEmployeeId,
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
  })

describe('Candidate', () => {
  // Test 1.1
  it('given_candidate_data_when_accessing_status_then_returns_APPLIED', () => {
    const candidate = makeCandidate('APPLIED')
    expect(candidate.status).toBe('APPLIED')
  })

  // Test 1.2
  it('given_APPLIED_candidate_when_assertCanTransitionTo_SCREENING_then_does_not_throw', () => {
    const candidate = makeCandidate('APPLIED')
    expect(() => candidate.assertCanTransitionTo('SCREENING')).not.toThrow()
  })

  // Test 1.3 — covers Invariant 1
  it('given_APPLIED_candidate_when_assertCanTransitionTo_INTERVIEW_then_throws_ValidationError', () => {
    const candidate = makeCandidate('APPLIED')
    expect(() => candidate.assertCanTransitionTo('INTERVIEW')).toThrow(ValidationError)
  })

  // Test 1.4
  it('given_OFFER_candidate_when_assertReadyToHire_then_does_not_throw', () => {
    const candidate = makeCandidate('OFFER')
    expect(() => candidate.assertReadyToHire()).not.toThrow()
  })

  // Test 1.5
  it('given_SCREENING_candidate_when_assertReadyToHire_then_throws_ValidationError', () => {
    const candidate = makeCandidate('SCREENING')
    expect(() => candidate.assertReadyToHire()).toThrow(ValidationError)
  })

  // Test 1.6
  it('given_HIRED_candidate_when_isTerminal_then_returns_true', () => {
    const candidate = makeCandidate('HIRED', 'emp-1')
    expect(candidate.isTerminal()).toBe(true)
  })

  // Test 1.7
  it('given_APPLIED_candidate_when_isTerminal_then_returns_false', () => {
    const candidate = makeCandidate('APPLIED')
    expect(candidate.isTerminal()).toBe(false)
  })

  // Test 1.8 — covers Invariant 2
  it('given_HIRED_candidate_when_assertCanTransitionTo_any_status_then_throws_ValidationError', () => {
    const candidate = makeCandidate('HIRED', 'emp-1')
    expect(() => candidate.assertCanTransitionTo('REJECTED')).toThrow(ValidationError)
  })

  // Test 1.9
  it('given_REJECTED_candidate_when_assertCanTransitionTo_any_status_then_throws_ValidationError', () => {
    const candidate = makeCandidate('REJECTED')
    expect(() => candidate.assertCanTransitionTo('SCREENING')).toThrow(ValidationError)
  })
})
