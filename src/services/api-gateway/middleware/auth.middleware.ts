import { FastifyRequest, FastifyReply } from '@ecommerce/shared/packages';
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
  reply: FastifyReply
) => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      status: 401,
      message: 'Missing or invalid authorization header',
      data: {},
      error: 'Missing or invalid authorization header',
    });
  }

  try {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    request.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  } catch (error) {
    return reply.status(401).send({
      status: 401,
      message: 'Invalid or expired token',
      data: {},
      error: 'Invalid or expired token',
    });
  }
};
