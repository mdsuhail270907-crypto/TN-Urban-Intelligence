import { Request, Response } from 'express';
import { createRoute, listRoutes, getRouteById, updateRoute, softDeleteRoute } from '../services/route.service';
import { formatErrorResponse } from '../utils/response';

const sendError = (res: Response, status: number, code: string, message: string) => {
  res.status(status).json(formatErrorResponse(code, message));
};

export const createRouteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await createRoute(req.body);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create route';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Fleet service is currently unavailable. Please try again later.');
      return;
    }

    if (message.startsWith('Duplicate ')) {
      sendError(res, 409, 'DUPLICATE_IDENTIFIER', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const listRoutesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await listRoutes(req.query as any);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch routes';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Fleet service is currently unavailable. Please try again later.');
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const getRouteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const routeId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const result = await getRouteById(routeId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch route';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Fleet service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Route not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const updateRouteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const routeId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const result = await updateRoute(routeId, req.body);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update route';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Fleet service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Route not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    if (message.startsWith('Duplicate ')) {
      sendError(res, 409, 'DUPLICATE_IDENTIFIER', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const deleteRouteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const routeId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const result = await softDeleteRoute(routeId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate route';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Fleet service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Route not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};
