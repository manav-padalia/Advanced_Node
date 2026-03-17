import { ResponseCodes } from '../constants/ResponseCodes';

/**
 * Base application error
 */
export class AppError extends Error {
  public readonly statusCode: ResponseCodes;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: ResponseCodes = ResponseCodes.SERVER_ERROR,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad request error (400)
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, ResponseCodes.BAD_REQUEST);
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, ResponseCodes.UNAUTHORIZED);
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, ResponseCodes.FORBIDDEN);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, ResponseCodes.NOT_FOUND);
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, ResponseCodes.CONFLICT);
  }
}

/**
 * Validation error (422)
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, ResponseCodes.UNPROCESSABLE_ENTITY);
  }
}

/**
 * Too many requests error (429)
 */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, ResponseCodes.TOO_MANY_REQUESTS);
  }
}

/**
 * Internal server error (500)
 */
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, ResponseCodes.SERVER_ERROR);
  }
}
