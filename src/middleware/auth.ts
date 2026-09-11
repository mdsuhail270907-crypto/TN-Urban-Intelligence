import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { formatErrorResponse } from '../utils/response';
import logger from '../utils/logger';
import User, { USER_ROLES, UserRole } from '../models/User';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const extractBearerToken = (authHeader?: string): string | null => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      res.status(401).json(
        formatErrorResponse('MISSING_TOKEN', 'Authentication token is required')
      );
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (!decoded || typeof decoded !== 'object') {
      res.status(401).json(
        formatErrorResponse('INVALID_TOKEN', 'Invalid authentication token')
      );
      return;
    }

    const userId = decoded.userId as string | undefined;

    if (!userId) {
      res.status(401).json(
        formatErrorResponse('INVALID_TOKEN', 'Invalid authentication token payload')
      );
      return;
    }

    const user = await User.findById(userId).lean();

    if (!user || !user.isActive) {
      res.status(401).json(
        formatErrorResponse('UNAUTHORIZED', 'User account is not active or not found')
      );
      return;
    }

    const verifiedRole = decoded.role;

    if (!verifiedRole || !USER_ROLES.includes(verifiedRole as UserRole)) {
      res.status(401).json(
        formatErrorResponse('INVALID_TOKEN', 'Invalid role in authentication token')
      );
      return;
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    };

    logger.info(`Authenticated user ${user.email} with role ${user.role}`);
    next();
  } catch (error) {
    logger.error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json(
        formatErrorResponse('TOKEN_EXPIRED', 'Authentication token has expired')
      );
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json(
        formatErrorResponse('INVALID_TOKEN', 'Invalid authentication token')
      );
      return;
    }

    res.status(500).json(
      formatErrorResponse('INTERNAL_SERVER_ERROR', 'Authentication failed due to an unexpected error')
    );
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(
        formatErrorResponse('UNAUTHORIZED', 'Authentication token is required')
      );
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json(
        formatErrorResponse('FORBIDDEN', `This endpoint requires one of the following roles: ${roles.join(', ')}`)
      );
      return;
    }

    next();
  };
};
