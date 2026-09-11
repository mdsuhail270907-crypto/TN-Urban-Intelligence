import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import logger from '../utils/logger';
import { registerTelemetrySocketHandlers } from '../websocket/telemetry';

export const initializeSocket = (server: http.Server): SocketIOServer => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  registerTelemetrySocketHandlers(io);

  logger.info('Socket.IO server initialized');
  return io;
};
