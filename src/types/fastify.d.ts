import { FastifyReply } from 'fastify';
import { ApiResponse } from '../shared/types/ApiResponse';

declare module 'fastify' {
  interface FastifyReply {
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
}
