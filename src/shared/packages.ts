/**
 * Centralized Package Imports
 * Single source of truth for all commonly used packages across the application
 * Import from this file instead of importing packages directly in every file
 *
 * Usage:
 * import { Fastify, FastifyInstance, FastifyRequest, FastifyReply, uuid } from '@ecommerce/shared/packages';
 */

// ============================================================================
// FASTIFY FRAMEWORK & PLUGINS
// ============================================================================

export { default as Fastify } from 'fastify';
export type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginCallback,
  FastifyPluginAsync,
  FastifyError,
} from 'fastify';

export { default as fastifyPlugin } from 'fastify-plugin';
export { default as fastifyCors } from '@fastify/cors';
export { default as fastifyHelmet } from '@fastify/helmet';
export { default as fastifyRateLimit } from '@fastify/rate-limit';
export { default as fastifyCompress } from '@fastify/compress';
export { default as fastifySwagger } from '@fastify/swagger';
export { default as fastifySwaggerUi } from '@fastify/swagger-ui';

// ============================================================================
// DATABASE & ORM
// ============================================================================

export { PrismaClient } from '@prisma/client';
export type { Prisma } from '@prisma/client';

// ============================================================================
// MESSAGE QUEUE & CACHING
// ============================================================================

export { Queue, Worker, Job } from 'bullmq';
export type { QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';

export { default as Redis } from 'ioredis';
export type { Redis as RedisType } from 'ioredis';

export * as amqp from 'amqplib';
export type { Channel, Connection, ConsumeMessage } from 'amqplib';

// ============================================================================
// AUTHENTICATION & SECURITY
// ============================================================================

export * as jwt from 'jsonwebtoken';
export type { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';

export * as argon2 from 'argon2';

export { default as passport } from 'passport';
export { Strategy as GoogleStrategy } from 'passport-google-oauth20';

// ============================================================================
// HTTP & COMMUNICATION
// ============================================================================

export { default as axios } from 'axios';
export type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export { default as Stripe } from 'stripe';

export { Server as SocketIOServer } from 'socket.io';
export type { Socket, Server } from 'socket.io';

export { default as nodemailer } from 'nodemailer';
export type { Transporter, SendMailOptions } from 'nodemailer';

// ============================================================================
// VALIDATION & CONFIGURATION
// ============================================================================

export * as zod from 'zod';
export { z } from 'zod';

export { config as dotenvConfig } from 'dotenv';

// ============================================================================
// LOGGING & MONITORING
// ============================================================================

export { default as pino } from 'pino';
export type { Logger, LoggerOptions } from 'pino';

export { default as pinoPretty } from 'pino-pretty';

export * as Sentry from '@sentry/node';

// ============================================================================
// UTILITIES
// ============================================================================

export { v4 as uuid, v4 as uuidv4 } from 'uuid';
export type { v4 as uuidType } from 'uuid';

export * as crypto from 'crypto';
export * as os from 'os';
export * as cluster from 'cluster';
export { Server as HTTPServer } from 'http';

// ============================================================================
// NODE.JS BUILT-INS
// ============================================================================

export * as path from 'path';
export * as fs from 'fs';
export * as stream from 'stream';
export * as events from 'events';
export * as util from 'util';
export * as querystring from 'querystring';
