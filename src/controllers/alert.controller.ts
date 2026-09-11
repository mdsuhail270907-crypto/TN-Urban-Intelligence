import { Request, Response } from 'express';
import { acknowledgeAlert, evaluateAlertConditions, resolveAlert } from '../services/alert.service';
import Alert from '../models/Alert';
import { AuthenticatedRequest } from '../middleware/auth';
import { formatErrorResponse } from '../utils/response';

const sendError = (res: Response, status: number, code: string, message: string): void => {
  res.status(status).json(formatErrorResponse(code, message));
};

export const evaluateAlertsHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const busId = typeof req.params.busId === 'string' ? req.params.busId : req.params.busId[0];
    const result = await evaluateAlertConditions(busId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to evaluate alerts';

    if (message === 'Invalid busId') {
      sendError(res, 400, 'VALIDATION_ERROR', message);
      return;
    }

    if (message === 'Bus not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const listAlertsHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.severity) {
      filter.severity = req.query.severity;
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.busId) {
      filter.busId = req.query.busId;
    }

    if (req.query.routeId) {
      filter.routeId = req.query.routeId;
    }

    if (req.query.from) {
      filter.triggeredAt = { ...filter.triggeredAt, $gte: new Date(req.query.from as string) };
    }

    if (req.query.to) {
      filter.triggeredAt = { ...filter.triggeredAt, $lte: new Date(req.query.to as string) };
    }

    const [alerts, total] = await Promise.all([
      Alert.find(filter).sort({ triggeredAt: -1 }).skip(skip).limit(limit).lean(),
      Alert.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        alerts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    sendError(res, 400, 'VALIDATION_ERROR', error instanceof Error ? error.message : 'Failed to list alerts');
  }
};

export const getAlertHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const alertId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const alert = await Alert.findById(alertId).lean();

    if (!alert) {
      sendError(res, 404, 'NOT_FOUND', 'Alert not found');
      return;
    }

    res.status(200).json({ success: true, data: alert });
  } catch (error) {
    sendError(res, 400, 'VALIDATION_ERROR', error instanceof Error ? error.message : 'Failed to fetch alert');
  }
};

export const acknowledgeAlertHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const alertId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const userId = req.user?.userId;

    if (!userId) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication token is required');
      return;
    }

    const result = await acknowledgeAlert(alertId, userId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to acknowledge alert';
    if (message === 'Alert not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    if (message === 'Alert already resolved') {
      sendError(res, 409, 'ALERT_ALREADY_RESOLVED', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};

export const resolveAlertHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const alertId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const userId = req.user?.userId;

    if (!userId) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication token is required');
      return;
    }

    const result = await resolveAlert(alertId, userId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve alert';
    if (message === 'Alert not found') {
      sendError(res, 404, 'NOT_FOUND', message);
      return;
    }

    if (message === 'Alert already resolved') {
      sendError(res, 409, 'ALERT_ALREADY_RESOLVED', message);
      return;
    }

    sendError(res, 400, 'VALIDATION_ERROR', message);
  }
};
