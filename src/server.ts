import http from 'http';
import { createApp } from './app';
import { connectDatabase } from './config/db';
import { initializeSocket } from './config/socket';
import logger from './utils/logger';
import { env } from './config/env';

const startServer = async (): Promise<void> => {
  try {
    logger.info('Starting Urban Intelligence Backend...');

    await connectDatabase();

    const app = createApp();
    const server = http.createServer(app);

    initializeSocket(server);

    server.listen(env.PORT, () => {
      logger.info(`Server started on port ${env.PORT}`);
      logger.info(`Health endpoint ready at http://localhost:${env.PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

startServer();
