import {
  FastifyInstance,
  FastifyReply,
  FastifyPluginCallback,
} from '@ecommerce/shared';
import { fastifyPlugin as fp } from '@ecommerce/shared';
import { ResponseCodes, ResponseMessages } from '../constants/ResponseCodes';
import { ApiResponse } from '../types/ApiResponse';

/**
 * Response enhancer methods added to FastifyReply
 */
export interface EnhancedReply extends FastifyReply {
  ok: <T = any>(payload: Partial<ApiResponse<T>>) => FastifyReply;
  created: <T = any>(payload: Partial<ApiResponse<T>>) => FastifyReply;
  accepted: <T = any>(payload: Partial<ApiResponse<T>>) => FastifyReply;
  noContent: () => FastifyReply;
  badRequest: (payload: Partial<ApiResponse>) => FastifyReply;
  unauthorized: (payload: Partial<ApiResponse>) => FastifyReply;
  forbidden: (payload: Partial<ApiResponse>) => FastifyReply;
  notFound: (payload: Partial<ApiResponse>) => FastifyReply;
  conflict: (payload: Partial<ApiResponse>) => FastifyReply;
  unprocessableEntity: (payload: Partial<ApiResponse>) => FastifyReply;
  tooManyRequests: (payload: Partial<ApiResponse>) => FastifyReply;
  serverError: (payload: Partial<ApiResponse>) => FastifyReply;
}

/**
 * Helper to build standard response
 */
const buildResponse = <T = any>(
  statusCode: ResponseCodes,
  payload: Partial<ApiResponse<T>>
): ApiResponse<T> => {
  return {
    status: statusCode,
    message: payload.message || ResponseMessages[statusCode],
    data: payload.data ?? ({} as T),
    error: payload.error || '',
  };
};

/**
 * Fastify plugin to enhance reply with standard response methods
 * Wrapped with fastify-plugin to break encapsulation and make decorations available globally
 */
const responseEnhancerPluginFn: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts: any,
  done: () => void
) => {
  fastify.decorateReply('ok', function <
    T = any,
  >(this: FastifyReply, payload: Partial<ApiResponse<T>>) {
    return this.code(ResponseCodes.OK).send(
      buildResponse(ResponseCodes.OK, payload)
    );
  });

  fastify.decorateReply('created', function <
    T = any,
  >(this: FastifyReply, payload: Partial<ApiResponse<T>>) {
    return this.code(ResponseCodes.CREATED).send(
      buildResponse(ResponseCodes.CREATED, payload)
    );
  });

  fastify.decorateReply('accepted', function <
    T = any,
  >(this: FastifyReply, payload: Partial<ApiResponse<T>>) {
    return this.code(ResponseCodes.ACCEPTED).send(
      buildResponse(ResponseCodes.ACCEPTED, payload)
    );
  });

  fastify.decorateReply('noContent', function (this: FastifyReply) {
    return this.code(ResponseCodes.NO_CONTENT).send();
  });

  fastify.decorateReply(
    'badRequest',
    function (this: FastifyReply, payload: Partial<ApiResponse>) {
      return this.code(ResponseCodes.BAD_REQUEST).send(
        buildResponse(ResponseCodes.BAD_REQUEST, payload)
      );
    }
  );

  fastify.decorateReply(
    'unauthorized',
    function (this: FastifyReply, payload: Partial<ApiResponse>) {
      return this.code(ResponseCodes.UNAUTHORIZED).send(
        buildResponse(ResponseCodes.UNAUTHORIZED, payload)
      );
    }
  );

  fastify.decorateReply(
    'forbidden',
    function (this: FastifyReply, payload: Partial<ApiResponse>) {
      return this.code(ResponseCodes.FORBIDDEN).send(
        buildResponse(ResponseCodes.FORBIDDEN, payload)
      );
    }
  );

  fastify.decorateReply(
    'notFound',
    function (this: FastifyReply, payload: Partial<ApiResponse>) {
      return this.code(ResponseCodes.NOT_FOUND).send(
        buildResponse(ResponseCodes.NOT_FOUND, payload)
      );
    }
  );

  fastify.decorateReply(
    'conflict',
    function (this: FastifyReply, payload: Partial<ApiResponse>) {
      return this.code(ResponseCodes.CONFLICT).send(
        buildResponse(ResponseCodes.CONFLICT, payload)
      );
    }
  );

  fastify.decorateReply(
    'unprocessableEntity',
    function (this: FastifyReply, payload: Partial<ApiResponse>) {
      return this.code(ResponseCodes.UNPROCESSABLE_ENTITY).send(
        buildResponse(ResponseCodes.UNPROCESSABLE_ENTITY, payload)
      );
    }
  );

  fastify.decorateReply(
    'tooManyRequests',
    function (this: FastifyReply, payload: Partial<ApiResponse>) {
      return this.code(ResponseCodes.TOO_MANY_REQUESTS).send(
        buildResponse(ResponseCodes.TOO_MANY_REQUESTS, payload)
      );
    }
  );

  fastify.decorateReply(
    'serverError',
    function (this: FastifyReply, payload: Partial<ApiResponse>) {
      return this.code(ResponseCodes.SERVER_ERROR).send(
        buildResponse(ResponseCodes.SERVER_ERROR, payload)
      );
    }
  );

  done();
};

export const responseEnhancerPlugin = fp(responseEnhancerPluginFn, {
  name: 'response-enhancer',
  fastify: '4.x',
});
