import { Request, Response } from 'express';
import { forecastBus } from '../services/ai/forecast.service';
import AIPrediction from '../models/AIPrediction';
import { formatErrorResponse } from '../utils/response';

const sendError = (res: Response, status: number, code: string, message: string): void => {
  res.status(status).json(formatErrorResponse(code, message));
};

export const predictBusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = typeof req.params.busId === 'string' ? req.params.busId : req.params.busId[0];
    const horizonMinutes = req.body?.horizonMinutes;
    const result = await forecastBus(busId, horizonMinutes);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to forecast bus';

    if (message === 'Invalid busId') {
      sendError(res, 400, 'VALIDATION_ERROR', message);
      return;
    }

    if (message.startsWith('Unsupported horizonMinutes')) {
      sendError(res, 400, 'VALIDATION_ERROR', message);
      return;
    }

    if (message === 'Insufficient telemetry data for forecasting.' || message === 'Insufficient telemetry history for forecasting.') {
      sendError(res, 422, 'INSUFFICIENT_TELEMETRY', message);
      return;
    }

    if (message === 'Bus not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const getPredictionHistoryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = typeof req.params.busId === 'string' ? req.params.busId : req.params.busId[0];
    const query = req.query as Record<string, string | undefined>;

    if (!/^[0-9a-fA-F]{24}$/.test(busId)) {
      sendError(res, 400, 'VALIDATION_ERROR', 'Invalid busId');
      return;
    }

    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const [predictions, total] = await Promise.all([
      AIPrediction.find({ busId: busId }).sort({ generatedAt: -1 }).skip(skip).limit(limit).lean(),
      AIPrediction.countDocuments({ busId: busId })
    ]);

    res.status(200).json({
      success: true,
      data: {
        predictions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch prediction history';
    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};
