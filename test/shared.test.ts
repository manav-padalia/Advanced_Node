/// <reference types="jest" />
import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import Fastify from 'fastify';

jest.mock('axios', () => ({
  put: jest.fn(async () => ({})),
  get: jest.fn(async () => ({
    data: [
      {
        Service: { ID: 'svc-1', Address: '127.0.0.1', Port: 3001 },
      },
    ],
  })),
}));

describe('ecommerce shared', () => {
  beforeAll(async () => {
    await import('../src/shared');
  });

  it('validateEnv throws when missing required vars', async () => {
    const { validateEnv } = await import('../src/shared/config/env');
    const prev = process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
    process.env.DATABASE_URL =
      'postgresql://ztlab87:13579acEG@localhost:5432/ecommerce?schema=public';
    expect(() => validateEnv()).toThrow(/Environment validation failed/);
    process.env.JWT_ACCESS_SECRET = prev;
  });

  it('response enhancer decorates reply helpers', async () => {
    const { responseEnhancerPlugin } =
      await import('../src/shared/middleware/responseEnhancer');
    const app = Fastify();
    await app.register(responseEnhancerPlugin as any);
    app.get('/ok', async (_req, reply) => (reply as any).ok({ data: {} }));
    app.get('/created', async (_req, reply) =>
      (reply as any).created({ data: {} }),
    );
    app.get('/accepted', async (_req, reply) =>
      (reply as any).accepted({ data: {} }),
    );
    app.get('/nocontent', async (_req, reply) => (reply as any).noContent());
    app.get('/bad', async (_req, reply) =>
      (reply as any).badRequest({ message: 'bad' }),
    );
    app.get('/unauth', async (_req, reply) =>
      (reply as any).unauthorized({ message: 'no' }),
    );
    app.get('/forbid', async (_req, reply) =>
      (reply as any).forbidden({ message: 'no' }),
    );
    app.get('/nf', async (_req, reply) =>
      (reply as any).notFound({ message: 'no' }),
    );
    app.get('/conflict', async (_req, reply) =>
      (reply as any).conflict({ message: 'no' }),
    );
    app.get('/unprocessable', async (_req, reply) =>
      (reply as any).unprocessableEntity({ message: 'no' }),
    );
    app.get('/tmr', async (_req, reply) =>
      (reply as any).tooManyRequests({ message: 'no' }),
    );
    app.get('/se', async (_req, reply) =>
      (reply as any).serverError({ message: 'no' }),
    );

    expect((await app.inject({ method: 'GET', url: '/ok' })).statusCode).toBe(
      200,
    );
    expect(
      (await app.inject({ method: 'GET', url: '/created' })).statusCode,
    ).toBe(201);
    expect(
      (await app.inject({ method: 'GET', url: '/accepted' })).statusCode,
    ).toBe(202);
    expect(
      (await app.inject({ method: 'GET', url: '/nocontent' })).statusCode,
    ).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/bad' })).statusCode).toBe(
      400,
    );
    expect(
      (await app.inject({ method: 'GET', url: '/unauth' })).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/forbid' })).statusCode,
    ).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/nf' })).statusCode).toBe(
      404,
    );
    expect(
      (await app.inject({ method: 'GET', url: '/conflict' })).statusCode,
    ).toBe(409);
    expect(
      (await app.inject({ method: 'GET', url: '/unprocessable' })).statusCode,
    ).toBe(422);
    expect((await app.inject({ method: 'GET', url: '/tmr' })).statusCode).toBe(
      429,
    );
    expect((await app.inject({ method: 'GET', url: '/se' })).statusCode).toBe(
      500,
    );
    await app.close();
  });

  it('consul discovery returns discovered services', async () => {
    const { consulDiscoverService } =
      await import('../src/shared/service-discovery/consul');
    const services = await consulDiscoverService('test');
    expect(services[0]).toMatchObject({ address: '127.0.0.1', port: 3001 });
  });

  it('CustomErrors set statusCode', async () => {
    const {
      BadRequestError,
      UnauthorizedError,
      ForbiddenError,
      NotFoundError,
      ConflictError,
      ValidationError,
      TooManyRequestsError,
      InternalServerError,
    } = await import('../src/shared/errors/CustomErrors');
    expect(new BadRequestError().statusCode).toBe(400);
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new ConflictError().statusCode).toBe(409);
    expect(new ValidationError().statusCode).toBe(422);
    expect(new TooManyRequestsError().statusCode).toBe(429);
    expect(new InternalServerError().statusCode).toBe(500);
  });

  it('consul register/deregister call mocked axios', async () => {
    const { consulRegisterService, consulDeregisterService } =
      await import('../src/shared/service-discovery/consul');
    await consulRegisterService({
      id: 'id',
      name: 'name',
      address: '127.0.0.1',
      port: 1,
      healthUrl: 'http://127.0.0.1/health',
    });
    await consulDeregisterService('id');
  });

  it('addErrorHelper returns success', async () => {
    const { addErrorHelper } =
      await import('../src/shared/utils/addErrorHelper');
    const { logger } = await import('../src/shared/utils/logger');
    const spy = jest.spyOn(logger as any, 'error').mockImplementation(() => {});
    const res = await addErrorHelper({
      apiName: 'test',
      details: new Error('x'),
    });
    expect(res.success).toBe(true);
    spy.mockRestore();
  });

  it('addErrorHelper returns false if logger throws', async () => {
    const { addErrorHelper } =
      await import('../src/shared/utils/addErrorHelper');
    const { logger } = await import('../src/shared/utils/logger');
    const spy = jest.spyOn(logger as any, 'error').mockImplementation(() => {
      throw new Error('logger fail');
    });
    const res = await addErrorHelper({
      apiName: 't',
      details: { message: 'x' },
    });
    expect(res.success).toBe(false);
    spy.mockRestore();
  });

  it('getAdvertiseAddress uses defaultPort', async () => {
    const { getAdvertiseAddress } =
      await import('../src/shared/service-discovery/consul');
    const { port } = getAdvertiseAddress(1234);
    expect(port).toBe(1234);
  });
});
