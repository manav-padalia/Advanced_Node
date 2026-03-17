import { Sentry } from '@ecommerce/shared/packages';
import { logger } from './logger';

/**
 * Initialize Sentry for error tracking
 * Only initializes if SENTRY_DSN is provided
 */
export const initializeSentry = (): void => {
  if (!process.env.SENTRY_DSN) {
    logger.info(
      'Sentry DSN not configured, external error monitoring disabled'
    );
    return;
  }

  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(
        process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'
      ),
    });

    logger.info('Sentry initialized successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Sentry');
  }
};

/**
 * Capture exception to Sentry with context
 */
export const captureException = (
  error: any,
  context: { apiName: string; errorId: string }
): void => {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  try {
    Sentry.captureException(error, {
      tags: {
        apiName: context.apiName,
        errorId: context.errorId,
      },
      level: 'error',
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to send error to Sentry');
  }
};

/**
 * Capture message to Sentry
 */
export const captureMessage = (
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'error'
): void => {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  try {
    Sentry.captureMessage(message, level);
  } catch (err) {
    logger.warn({ err }, 'Failed to send message to Sentry');
  }
};
