/**
 * Standard HTTP response codes used across all microservices
 */
export enum ResponseCodes {
  // Success 2xx
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,

  // Client Errors 4xx
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,

  // Server Errors 5xx
  SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

export const ResponseMessages = {
  [ResponseCodes.OK]: 'Success',
  [ResponseCodes.CREATED]: 'Resource created successfully',
  [ResponseCodes.ACCEPTED]: 'Request accepted',
  [ResponseCodes.NO_CONTENT]: 'No content',
  [ResponseCodes.BAD_REQUEST]: 'Bad request',
  [ResponseCodes.UNAUTHORIZED]: 'Unauthorized',
  [ResponseCodes.FORBIDDEN]: 'Forbidden',
  [ResponseCodes.NOT_FOUND]: 'Resource not found',
  [ResponseCodes.METHOD_NOT_ALLOWED]: 'Method not allowed',
  [ResponseCodes.CONFLICT]: 'Resource conflict',
  [ResponseCodes.UNPROCESSABLE_ENTITY]: 'Unprocessable entity',
  [ResponseCodes.TOO_MANY_REQUESTS]: 'Too many requests',
  [ResponseCodes.SERVER_ERROR]: 'Internal server error',
  [ResponseCodes.NOT_IMPLEMENTED]: 'Not implemented',
  [ResponseCodes.BAD_GATEWAY]: 'Bad gateway',
  [ResponseCodes.SERVICE_UNAVAILABLE]: 'Service unavailable',
  [ResponseCodes.GATEWAY_TIMEOUT]: 'Gateway timeout',
} as const;
