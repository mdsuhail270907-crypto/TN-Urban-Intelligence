import { NextFunction, Request, Response } from 'express';
import { formatErrorResponse } from '../utils/response';
import logger from '../utils/logger';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json(
    formatErrorResponse('NOT_FOUND', `Route ${req.originalUrl} was not found`)
  );
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.message}`);

  const statusCode = res.statusCode && res.statusCode >= 400 ? res.statusCode : 500;

  res.status(statusCode).json(
    formatErrorResponse(
      statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
      statusCode >= 500 ? 'Something went wrong on the server.' : err.message
    )
  );
};
