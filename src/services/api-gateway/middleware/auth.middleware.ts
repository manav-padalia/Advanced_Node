import { FastifyRequest, FastifyReply } from '@ecommerce/shared/packages';
import { UnauthorizedError } from '@ecommerce/shared';
import { verifyAccessToken } from '../utils/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      email: string;
      role: string;
    };
  }
}

export const authMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    request.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
};
