class DomainError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

class ValidationError extends DomainError {
  constructor(message, details) {
    super(message, 400, "VALIDATION_ERROR");
    this.details = details;
  }
}

class NotFoundError extends DomainError {
  constructor(message) {
    super(message, 404, "NOT_FOUND");
  }
}

class ForbiddenError extends DomainError {
  constructor(message) {
    super(message, 403, "FORBIDDEN");
  }
}

class ConflictError extends DomainError {
  constructor(message) {
    super(message, 409, "CONFLICT");
  }
}

class UnprocessableError extends DomainError {
  constructor(message) {
    super(message, 422, "UNPROCESSABLE");
  }
}

module.exports = {
  DomainError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnprocessableError,
};
