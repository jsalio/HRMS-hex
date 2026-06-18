import { describe, it, expect } from 'bun:test'
import { Employee } from '@hrms/core/domain/employee'
import { ValidationError } from '@hrms/core/domain/errors'

describe('Employee domain', () => {
  describe('assertCanBeModified', () => {
    it('active employee can be modified', () => {
      const emp = new Employee({ id: 'e1', status: 'ACTIVE' })
      expect(() => emp.assertCanBeModified()).not.toThrow()
    })

    it('remote employee can be modified', () => {
      const emp = new Employee({ id: 'e1', status: 'REMOTE' })
      expect(() => emp.assertCanBeModified()).not.toThrow()
    })

    it('on_leave employee can be modified', () => {
      const emp = new Employee({ id: 'e1', status: 'ON_LEAVE' })
      expect(() => emp.assertCanBeModified()).not.toThrow()
    })

    it('inactive employee throws ValidationError', () => {
      const emp = new Employee({ id: 'e1', status: 'INACTIVE' })
      expect(() => emp.assertCanBeModified()).toThrow(ValidationError)
    })

    it('inactive employee error message describes the constraint', () => {
      const emp = new Employee({ id: 'e1', status: 'INACTIVE' })
      expect(() => emp.assertCanBeModified()).toThrow('Cannot modify an inactive employee')
    })
  })

  describe('assertCanBeTerminated', () => {
    it('active employee can be terminated', () => {
      const emp = new Employee({ id: 'e1', status: 'ACTIVE' })
      expect(() => emp.assertCanBeTerminated()).not.toThrow()
    })

    it('already inactive employee throws ValidationError', () => {
      const emp = new Employee({ id: 'e1', status: 'INACTIVE' })
      expect(() => emp.assertCanBeTerminated()).toThrow(ValidationError)
    })

    it('already inactive employee error message describes the constraint', () => {
      const emp = new Employee({ id: 'e1', status: 'INACTIVE' })
      expect(() => emp.assertCanBeTerminated()).toThrow('Employee is already inactive')
    })
  })
})
