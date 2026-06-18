import type { EmployeeDocumentData } from '../contracts/documents'
import { ValidationError } from './errors'

/**
 * Domain entity representing an employee document and its lifecycle status.
 * Enforces the invariants that govern the document's signing and archiving transitions.
 */
export class EmployeeDocument {
  /**
   * @param props - identity, status, storage and lineage data backing the document
   */
  constructor(private readonly props: EmployeeDocumentData) {}

  /**
   * @returns the document identifier
   */
  get id()            { return this.props.id }
  /**
   * @returns the identifier of the employee the document belongs to
   */
  get employeeId()    { return this.props.employeeId }
  /**
   * @returns the current lifecycle status of the document
   */
  get status()        { return this.props.status }
  /**
   * @returns the location of the stored document file
   */
  get fileUrl()       { return this.props.fileUrl }
  /**
   * @returns the content hash used to verify the document's integrity
   */
  get fileHash()      { return this.props.fileHash }
  /**
   * @returns the expiration date of the document, or null when it does not expire
   */
  get expiresAt()     { return this.props.expiresAt }
  /**
   * @returns the identifier of the document this one supersedes, or null when it is not a renewal
   */
  get renewedFromId() { return this.props.renewedFromId }

  /**
   * Guards signing of the document.
   *
   * @throws {ValidationError} when the document is not in the PENDING status and therefore cannot be signed
   */
  assertCanBeSigned(): void {
    if (this.props.status !== 'PENDING') {
      throw new ValidationError(`Document cannot be signed: current status is ${this.props.status}`)
    }
  }

  /**
   * Guards archiving of the document.
   *
   * @throws {ValidationError} when the document is not in the SIGNED status and therefore cannot be archived
   */
  assertCanBeArchived(): void {
    if (this.props.status !== 'SIGNED') {
      throw new ValidationError(`Document cannot be archived: must be SIGNED first, current status is ${this.props.status}`)
    }
  }
}
