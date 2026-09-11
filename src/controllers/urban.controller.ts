import { Request, Response } from 'express';
import { buildUrbanIntelligenceSummary } from '../services/ai/urbanIntelligence.service';
import { formatErrorResponse } from '../utils/response';

const sendError = (res: Response, status: number, code: string, message: string): void => {
  res.status(status).json(formatErrorResponse(code, message));
};

export const getUrbanSummaryHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await buildUrbanIntelligenceSummary();
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    sendError(res, 400, 'VALIDATION_ERROR', error instanceof Error ? error.message : 'Failed to build urban summary');
  }
};
