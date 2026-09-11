import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getCurrentUser as getCurrentUserProfile, loginUser, registerUser } from '../services/auth.service';
import { formatErrorResponse } from '../utils/response';

const sendAuthError = (res: Response, statusCode: number, code: string, message: string) => {
  res.status(statusCode).json(formatErrorResponse(code, message));
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    const payload = { name, email, password, role };

    if (role === 'ADMIN') {
      sendAuthError(
        res,
        403,
        'FORBIDDEN_ROLE',
        'ADMIN role cannot be created through the public registration endpoint'
      );
      return;
    }

    const result = await registerUser(payload);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';

    if (message === 'User already exists') {
      sendAuthError(res, 409, 'USER_EXISTS', 'User already exists');
      return;
    }

    if (message.toLowerCase().includes('mongodb') || message.toLowerCase().includes('connection')) {
      sendAuthError(res, 503, 'SERVICE_UNAVAILABLE', 'Authentication service is currently unavailable. Please try again later.');
      return;
    }

    sendAuthError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });

    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';

    if (message.toLowerCase().includes('mongodb') || message.toLowerCase().includes('connection')) {
      sendAuthError(res, 503, 'SERVICE_UNAVAILABLE', 'Authentication service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Invalid email or password') {
      sendAuthError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      return;
    }

    sendAuthError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user?.userId) {
      sendAuthError(res, 401, 'UNAUTHORIZED', 'Authentication token is required or invalid');
      return;
    }

    const result = await getCurrentUserProfile(authReq.user.userId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch current user';

    if (message.toLowerCase().includes('mongodb') || message.toLowerCase().includes('connection')) {
      sendAuthError(res, 503, 'SERVICE_UNAVAILABLE', 'Authentication service is currently unavailable. Please try again later.');
      return;
    }

    sendAuthError(res, 400, 'VALIDATION_ERROR', message);
  }
};
