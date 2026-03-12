import { pino, pinoPretty } from '@ecommerce/shared';

/**
 * Structured logger using Pino
 * Outputs JSON logs for production, pretty logs for development
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create child logger with service context
 */
export const createServiceLogger = (serviceName: string) => {
  return logger.child({ service: serviceName });
};
