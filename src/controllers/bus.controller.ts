import { Request, Response } from 'express';
import { createBus, listBuses, getBusById, updateBus, softDeleteBus, assignRouteToBus, removeBusRoute } from '../services/bus.service';
import { formatErrorResponse } from '../utils/response';

const sendError = (res: Response, status: number, code: string, message: string) => {
  res.status(status).json(formatErrorResponse(code, message));
};

export const createBusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await createBus(req.body);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create bus';

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

export const listBusesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await listBuses(req.query as any);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch buses';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Fleet service is currently unavailable. Please try again later.');
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const getBusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const result = await getBusById(busId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch bus';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Fleet service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Bus not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const updateBusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const result = await updateBus(busId, req.body);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update bus';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Fleet service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Bus not found') {
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

export const deleteBusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const result = await softDeleteBus(busId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate bus';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Fleet service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Bus not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const assignRouteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = typeof req.params.busId === 'string' ? req.params.busId : req.params.busId[0];
    const result = await assignRouteToBus(busId, req.body.routeId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign route';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Fleet service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Bus not found or inactive') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    if (message === 'Route not found or inactive') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const removeRouteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = typeof req.params.busId === 'string' ? req.params.busId : req.params.busId[0];
    const result = await removeBusRoute(busId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove bus route';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Fleet service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Bus not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};
