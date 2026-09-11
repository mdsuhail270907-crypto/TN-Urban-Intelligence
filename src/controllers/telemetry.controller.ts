import { Request, Response } from 'express';
import { getBusTelemetry, getLatestTelemetryByBusId, submitTelemetry } from '../services/telemetry.service';
import { formatErrorResponse } from '../utils/response';

const sendError = (res: Response, status: number, code: string, message: string) => {
  res.status(status).json(formatErrorResponse(code, message));
};

const getRouteParam = (req: Request, param: string): string => {
  const value = req.params[param];
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : '';
};

export const submitTelemetryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await submitTelemetry(req.body);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit telemetry';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Telemetry service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Bus not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    if (message === 'Bus is inactive') {
      sendError(res, 409, 'BUS_INACTIVE', message);
      return;
    }

    if (message === 'Route not found or inactive') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const getBusTelemetryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = getRouteParam(req, 'busId');
    const result = await getBusTelemetry(busId, req.query as any);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch telemetry';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Telemetry service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Invalid busId') {
      sendError(res, 400, 'VALIDATION_ERROR', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const getBusLatestTelemetryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = getRouteParam(req, 'busId');
    const result = await getLatestTelemetryByBusId(busId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch latest telemetry';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Telemetry service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Invalid busId') {
      sendError(res, 400, 'VALIDATION_ERROR', message);
      return;
    }

    if (message === 'Telemetry not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};
