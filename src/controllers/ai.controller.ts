import { Request, Response } from 'express';
import { analyzeBus, batchAnalyzeBuses, getAIAnalysisHistory, getLatestAIAnalysis } from '../services/urbanAI.service';
import { formatErrorResponse } from '../utils/response';

const sendError = (res: Response, status: number, code: string, message: string): void => {
  res.status(status).json(formatErrorResponse(code, message));
};

export const analyzeBusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = typeof req.params.busId === 'string' ? req.params.busId : req.params.busId[0];
    const result = await analyzeBus(busId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze bus';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'AI analysis service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Bus not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    if (message === 'Invalid busId') {
      sendError(res, 400, 'VALIDATION_ERROR', message);
      return;
    }

    if (message === 'Insufficient telemetry data for AI analysis.') {
      sendError(res, 422, 'INSUFFICIENT_TELEMETRY', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const getLatestAIAnalysisHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = typeof req.params.busId === 'string' ? req.params.busId : req.params.busId[0];
    const result = await getLatestAIAnalysis(busId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch latest AI analysis';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'AI analysis service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'No AI analysis available') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    if (message === 'Invalid busId') {
      sendError(res, 400, 'VALIDATION_ERROR', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const getAIAnalysisHistoryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const busId = typeof req.params.busId === 'string' ? req.params.busId : req.params.busId[0];
    const result = await getAIAnalysisHistory(busId, req.query as Record<string, string | undefined>);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch AI analysis history';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'AI analysis service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'Invalid busId') {
      sendError(res, 400, 'VALIDATION_ERROR', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const batchAnalyzeBusesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await batchAnalyzeBuses(req.body?.busIds);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze buses';

    if (message === 'MongoDB connection unavailable') {
      sendError(res, 503, 'SERVICE_UNAVAILABLE', 'AI analysis service is currently unavailable. Please try again later.');
      return;
    }

    if (message === 'busIds must be a non-empty array' || message === 'Invalid busIds array' || message === 'Batch size cannot exceed 20 buses') {
      sendError(res, 400, 'VALIDATION_ERROR', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};
