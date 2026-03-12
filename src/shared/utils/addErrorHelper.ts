import { uuid } from '@ecommerce/shared';
import { logger } from './logger';
import prisma from './prisma';
import { captureException } from './sentry';

/**
 * Centralized error logging helper
 * Logs errors to database and external monitoring services
 */
export const addErrorHelper = async (inputs: {
  apiName: string;
  details: any;
}): Promise<{ success: boolean }> => {
  try {
    const errorId = uuid();
    const errorData = {
      id: errorId,
      apiName: inputs.apiName,
      errMessage: inputs.details?.message || 'Unknown error',
      details: inputs.details,
      createdAt: new Date(),
    };

    // Log to console/file with structured logging
    logger.error(
      {
        errorId,
        apiName: inputs.apiName,
        message: errorData.errMessage,
        stack: inputs.details?.stack,
        details: inputs.details,
      },
      'Application error occurred',
    );

    // Store in database
    try {
      await prisma.errors.create({ data: errorData });
      logger.debug({ errorId }, 'Error stored in database');
    } catch (dbErr) {
      logger.warn({ errorId, dbErr }, 'Failed to store error in database');
      // Don't throw - we still want to return success for the API
    }

    // Send to external monitoring (Sentry, DataDog, etc.)
    captureException(inputs.details, {
      apiName: inputs.apiName,
      errorId,
    });

    return { success: true };
  } catch (logErr) {
    // Fallback logging if error helper itself fails
    console.error('[ERROR-LOG-FAIL]', {
      originalError: inputs,
      loggingError: logErr,
    });
    return { success: false };
  }
};
