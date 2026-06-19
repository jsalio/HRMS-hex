/**
 * Base class for all domain-level errors raised when a business rule or
 * invariant is violated.
 */
export class DomainError extends Error {
  /**
   * @param message - human-readable description of the violated business rule
   */
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

/**
 * Raised when an actor lacks the authorization required to perform an
 * operation, or when an account is not allowed to authenticate.
 */
export class UnauthorizedError extends DomainError {
  /**
   * @param message - human-readable reason the action is unauthorized
   */
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Raised when an operation conflicts with the current state, such as creating
 * a resource that already exists.
 */
export class ConflictError extends DomainError {
  /**
   * @param message - human-readable description of the conflicting state
   */
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

/**
 * Raised when a requested resource does not exist.
 */
export class NotFoundError extends DomainError {
  /**
   * @param message - human-readable description of the missing resource
   */
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

/**
 * Raised when input or domain state fails a validation rule.
 */
export class ValidationError extends DomainError {
  /**
   * @param message - human-readable description of the failed validation
   */
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Raised when an authenticated actor attempts an operation on a resource they
 * are not allowed to access, such as viewing another employee's private data.
 */
export class ForbiddenError extends DomainError {
  /**
   * @param message - human-readable reason access was denied
   */
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}
