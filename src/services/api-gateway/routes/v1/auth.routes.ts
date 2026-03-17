import {
  FastifyInstance,
  z,
  PrismaClient,
  axios,
  crypto,
  uuidv4,
} from '@ecommerce/shared/packages';
import {
  ResponseCodes,
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  addErrorHelper,
} from '@ecommerce/shared';
import { hashPassword, verifyPassword } from '../../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt';

const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const oauthStateStore = new Map<string, number>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export async function authRoutes(fastify: FastifyInstance) {
  // Google OAuth start
  fastify.get('/google', async (_request, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

    if (!clientId || !callbackUrl) {
      throw new BadRequestError('Google OAuth is not configured');
    }

    const state = crypto.randomBytes(16).toString('hex');
    oauthStateStore.set(state, Date.now() + OAUTH_STATE_TTL_MS);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    console.log(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );

    return reply.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
  });

  // Google OAuth callback
  fastify.get('/google/callback', async (request, reply) => {
    const code = (request.query as any)?.code as string | undefined;
    const state = (request.query as any)?.state as string | undefined;

    if (!code || !state) {
      throw new BadRequestError('Missing OAuth code/state');
    }

    const expiresAt = oauthStateStore.get(state);
    oauthStateStore.delete(state);
    if (!expiresAt || expiresAt < Date.now()) {
      throw new BadRequestError('Invalid or expired OAuth state');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
    if (!clientId || !clientSecret || !callbackUrl) {
      throw new BadRequestError('Google OAuth is not configured');
    }

    const tokenRes = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000,
      }
    );

    const accessTokenFromGoogle = tokenRes.data.access_token as
      | string
      | undefined;
    if (!accessTokenFromGoogle) {
      throw new UnauthorizedError('Failed to obtain Google access token');
    }

    const userInfoRes = await axios.get(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: { Authorization: `Bearer ${accessTokenFromGoogle}` },
        timeout: 8000,
      }
    );

    const googleSub = userInfoRes.data.sub as string | undefined;
    const email = userInfoRes.data.email as string | undefined;
    const givenName = userInfoRes.data.given_name as string | undefined;
    const familyName = userInfoRes.data.family_name as string | undefined;

    if (!googleSub || !email) {
      throw new UnauthorizedError('Google profile missing sub/email');
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        provider: 'GOOGLE',
        providerId: googleSub,
        emailVerified: true,
        firstName: givenName,
        lastName: familyName,
        isActive: true,
      },
      create: {
        id: uuidv4(),
        email,
        passwordHash: null,
        firstName: givenName,
        lastName: familyName,
        role: 'USER',
        provider: 'GOOGLE',
        providerId: googleSub,
        emailVerified: true,
        isActive: true,
      },
    });

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await prisma.refreshToken.create({
      data: {
        id: uuidv4(),
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return reply.ok({
      status: ResponseCodes.OK,
      message: 'OAuth login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          provider: user.provider,
        },
        accessToken,
        refreshToken,
      },
      error: '',
    });
  });

  // Register
  fastify.post(
    '/register',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Register a new user',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              status: { type: 'number' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string', format: 'email' },
                      firstName: { type: 'string', nullable: true },
                      lastName: { type: 'string', nullable: true },
                      role: { type: 'string' },
                    },
                    required: ['id', 'email', 'role'],
                  },
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                },
                required: ['user', 'accessToken', 'refreshToken'],
              },
              error: { type: 'string' },
            },
            required: ['status', 'message', 'data', 'error'],
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = registerSchema.parse(request.body);

        const existingUser = await prisma.user.findUnique({
          where: { email: body.email },
        });

        if (existingUser) {
          throw new ConflictError('Email already registered');
        }

        const passwordHash = await hashPassword(body.password);

        const user = await prisma.user.create({
          data: {
            id: uuidv4(),
            email: body.email,
            passwordHash,
            firstName: body.firstName,
            lastName: body.lastName,
            role: 'USER',
            provider: 'LOCAL',
          },
        });

        const accessToken = generateAccessToken({
          userId: user.id,
          email: user.email,
          role: user.role,
        });

        const refreshToken = generateRefreshToken({
          userId: user.id,
          email: user.email,
          role: user.role,
        });

        await prisma.refreshToken.create({
          data: {
            id: uuidv4(),
            token: refreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        return reply.created({
          status: ResponseCodes.CREATED,
          message: 'User registered successfully',
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
            },
            accessToken,
            refreshToken,
          },
          error: '',
        });
      } catch (err: any) {
        await addErrorHelper({
          apiName: 'AuthRoutes.register',
          details: err,
        });
        if (err instanceof ConflictError || err instanceof BadRequestError) {
          throw err;
        }
        return reply.serverError({
          status: ResponseCodes.SERVER_ERROR,
          message: err.message || 'Registration failed',
          data: {},
          error: err.message || 'Registration failed',
        });
      }
    }
  );

  // Login
  fastify.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'number' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string', format: 'email' },
                      firstName: { type: 'string', nullable: true },
                      lastName: { type: 'string', nullable: true },
                      role: { type: 'string' },
                    },
                    required: ['id', 'email', 'role'],
                  },
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                },
                required: ['user', 'accessToken', 'refreshToken'],
              },
              error: { type: 'string' },
            },
            required: ['status', 'message', 'data', 'error'],
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = loginSchema.parse(request.body);

        const user = await prisma.user.findUnique({
          where: { email: body.email },
        });

        if (!user || !user.passwordHash) {
          throw new UnauthorizedError('Invalid credentials');
        }

        const isValidPassword = await verifyPassword(
          user.passwordHash,
          body.password
        );

        if (!isValidPassword) {
          throw new UnauthorizedError('Invalid credentials');
        }

        if (!user.isActive) {
          throw new UnauthorizedError('Account is disabled');
        }

        const accessToken = generateAccessToken({
          userId: user.id,
          email: user.email,
          role: user.role,
        });

        const refreshToken = generateRefreshToken({
          userId: user.id,
          email: user.email,
          role: user.role,
        });

        // Clean up expired tokens then store the new one
        await prisma.refreshToken.deleteMany({
          where: { userId: user.id, expiresAt: { lt: new Date() } },
        });
        await prisma.refreshToken.create({
          data: {
            id: uuidv4(),
            token: refreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        return reply.ok({
          status: ResponseCodes.OK,
          message: 'Login successful',
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
            },
            accessToken,
            refreshToken,
          },
          error: '',
        });
      } catch (err: any) {
        await addErrorHelper({
          apiName: 'AuthRoutes.login',
          details: err,
        });
        if (err instanceof UnauthorizedError) {
          throw err;
        }
        return reply.serverError({
          status: ResponseCodes.SERVER_ERROR,
          message: err.message || 'Login failed',
          data: {},
          error: err.message || 'Login failed',
        });
      }
    }
  );

  // Refresh Token
  fastify.post(
    '/refresh',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'number' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                },
                required: ['accessToken'],
              },
              error: { type: 'string' },
            },
            required: ['status', 'message', 'data', 'error'],
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = refreshSchema.parse(request.body);

        let payload: ReturnType<typeof verifyRefreshToken>;
        try {
          payload = verifyRefreshToken(body.refreshToken);
        } catch {
          throw new UnauthorizedError('Invalid or expired refresh token');
        }

        const storedToken = await prisma.refreshToken.findUnique({
          where: { token: body.refreshToken },
        });

        if (!storedToken || storedToken.expiresAt < new Date()) {
          throw new UnauthorizedError('Invalid or expired refresh token');
        }

        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });

        if (!user || !user.isActive) {
          throw new UnauthorizedError('User not found or inactive');
        }

        const newAccessToken = generateAccessToken({
          userId: user.id,
          email: user.email,
          role: user.role,
        });

        return reply.ok({
          status: ResponseCodes.OK,
          message: 'Token refreshed successfully',
          data: {
            accessToken: newAccessToken,
          },
          error: '',
        });
      } catch (err: any) {
        await addErrorHelper({
          apiName: 'AuthRoutes.refresh',
          details: err,
        });
        if (
          err instanceof UnauthorizedError ||
          err instanceof BadRequestError
        ) {
          throw err;
        }
        return reply.serverError({
          status: ResponseCodes.SERVER_ERROR,
          message: err.message || 'Token refresh failed',
          data: {},
          error: err.message || 'Token refresh failed',
        });
      }
    }
  );
}
