import { SocketIOServer, HTTPServer } from '@ecommerce/shared';
import { verifyAccessToken } from '../utils/jwt';
import { createServiceLogger } from '@ecommerce/shared';

const logger = createServiceLogger('socket-service');

export class SocketService {
  private static instance: SocketService;
  private io: SocketIOServer | null = null;

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || [
          'http://localhost:3000',
        ],
        credentials: true,
      },
    });

    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error'));
      }

      try {
        const payload = verifyAccessToken(token);
        (socket as any).user = payload;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      const user = (socket as any).user;
      logger.info(`User connected: ${user.userId}`);

      // Join user-specific room
      socket.join(`user:${user.userId}`);

      // Join admin room if user is admin
      if (user.role === 'ADMIN') {
        socket.join('admins');
      }

      socket.on('disconnect', () => {
        logger.info(`User disconnected: ${user.userId}`);
      });
    });

    logger.info('Socket.IO server initialized');
  }

  emitToUser(userId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  emitToAdmins(event: string, data: any) {
    if (this.io) {
      this.io.to('admins').emit(event, data);
    }
  }

  broadcast(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }
}
