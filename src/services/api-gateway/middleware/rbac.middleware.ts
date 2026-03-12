import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '@ecommerce/shared';

export const requireRole = (allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new ForbiddenError('User not authenticated');
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      );
    }
  };
};

export const requireAdmin = requireRole(['ADMIN']);
