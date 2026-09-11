import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import logger from './utils/logger';
import { formatSuccessResponse } from './utils/response';
import { generalRateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getDatabaseStatus } from './config/db';
import authRoutes from './routes/auth.routes';
import busRoutes from './routes/bus.routes';
import routeRoutes from './routes/route.routes';
import telemetryRoutes from './routes/telemetry.routes';
import aiRoutes from './routes/ai.routes';
import predictionRoutes from './routes/prediction.routes';
import alertRoutes from './routes/alert.routes';
import urbanRoutes from './routes/urban.routes';

export const createApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(generalRateLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/buses', busRoutes);
  app.use('/api/routes', routeRoutes);
  app.use('/api/telemetry', telemetryRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/predictions', predictionRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/urban', urbanRoutes);

  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`Incoming request: ${req.method} ${req.originalUrl}`);
    res.locals.startTime = Date.now();
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      database: getDatabaseStatus(),
      services: {
        mongo: getDatabaseStatus(),
        socket: 'running'
      }
    };

    res.status(200).json(
      formatSuccessResponse(healthData, 'Server health check successful')
    );
  });

  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json(
      formatSuccessResponse(
        {
          name: 'Urban Intelligence Backend',
          version: '1.0.0',
          status: 'running'
        },
        'Backend foundation is active'
      )
    );
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
