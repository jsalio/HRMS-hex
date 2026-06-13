import type { EmployeeDocumentData } from '../contracts/documents'
import { ValidationError } from './errors'

export class EmployeeDocument {
  constructor(private readonly props: EmployeeDocumentData) {}

  get id()            { return this.props.id }
  get employeeId()    { return this.props.employeeId }
  get status()        { return this.props.status }
  get fileUrl()       { return this.props.fileUrl }
  get fileHash()      { return this.props.fileHash }
  get expiresAt()     { return this.props.expiresAt }
  get renewedFromId() { return this.props.renewedFromId }

  assertCanBeSigned(): void {
    if (this.props.status !== 'PENDING') {
      throw new ValidationError(`Document cannot be signed: current status is ${this.props.status}`)
    }
  }

  assertCanBeArchived(): void {
    if (this.props.status !== 'SIGNED') {
      throw new ValidationError(`Document cannot be archived: must be SIGNED first, current status is ${this.props.status}`)
    }
  }
}
