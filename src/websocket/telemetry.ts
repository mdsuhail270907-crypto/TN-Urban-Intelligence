import { Server as SocketIOServer } from 'socket.io';
import logger from '../utils/logger';

interface BusLocationPayload {
  busId: string;
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: string;
}

interface BusStatusPayload {
  busId: string;
  status: string;
  timestamp: string;
}

interface BusOfflinePayload {
  busId: string;
  lastSeenAt: string | null;
  detectedAt: string;
}

interface TelemetryUpdatePayload {
  busId: string;
  routeId?: string | null;
  location: {
    latitude: number;
    longitude: number;
  };
  speed: number;
  heading: number;
  status: string;
  timestamp: string;
  deviceId?: string;
  accuracy?: number;
  altitude?: number;
}

interface AIUpdatePayload {
  busId: string;
  routeId?: string | null;
  analysis?: Record<string, any>;
  prediction?: Record<string, any>;
}

interface AlertPayload {
  alert: Record<string, any>;
  busId?: string | null;
  routeId?: string | null;
}

interface UrbanInsightPayload {
  summary: Record<string, any>;
}

let io: SocketIOServer | null = null;

export const registerTelemetrySocketHandlers = (server: SocketIOServer): void => {
  io = server;

  server.on('connection', (socket) => {
    logger.info(`Socket client connected: ${socket.id}`);

    socket.on('bus:subscribe', (busId: string) => {
      if (!busId || typeof busId !== 'string') {
        socket.emit('error', { code: 'INVALID_BUS_ID', message: 'Invalid busId' });
        return;
      }

      socket.join(`bus:${busId}`);
      logger.info(`Socket client ${socket.id} subscribed to bus:${busId}`);
    });

    socket.on('route:subscribe', (routeId: string) => {
      if (!routeId || typeof routeId !== 'string') {
        socket.emit('error', { code: 'INVALID_ROUTE_ID', message: 'Invalid routeId' });
        return;
      }

      socket.join(`route:${routeId}`);
      logger.info(`Socket client ${socket.id} subscribed to route:${routeId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket client disconnected: ${socket.id}`);
    });
  });
};

export const emitTelemetryUpdate = (payload: TelemetryUpdatePayload): void => {
  if (!io) {
    return;
  }

  io.to(`bus:${payload.busId}`).emit('telemetry:update', payload);

  if (payload.routeId) {
    io.to(`route:${payload.routeId}`).emit('telemetry:update', payload);
  }

  logger.info(`Broadcasted telemetry:update for bus ${payload.busId}`);
};

export const emitBusLocation = (payload: BusLocationPayload): void => {
  if (!io) {
    return;
  }

  io.to(`bus:${payload.busId}`).emit('bus:location', payload);
};

export const emitBusStatus = (payload: BusStatusPayload): void => {
  if (!io) {
    return;
  }

  io.to(`bus:${payload.busId}`).emit('bus:status', payload);
};

export const emitBusOffline = (payload: BusOfflinePayload): void => {
  if (!io) {
    return;
  }

  io.to(`bus:${payload.busId}`).emit('bus:offline', payload);
};

export const emitAIUpdate = (payload: AIUpdatePayload): void => {
  if (!io) {
    return;
  }

  io.to(`bus:${payload.busId}`).emit('ai:update', payload);

  if (payload.routeId) {
    io.to(`route:${payload.routeId}`).emit('ai:update', payload);
  }

  logger.info(`Broadcasted ai:update for bus ${payload.busId}`);
};

export const emitPredictionUpdate = (payload: AIUpdatePayload): void => {
  if (!io) {
    return;
  }

  io.to(`bus:${payload.busId}`).emit('ai:prediction', payload.prediction || payload);

  if (payload.routeId) {
    io.to(`route:${payload.routeId}`).emit('ai:prediction', payload.prediction || payload);
  }

  logger.info(`Broadcasted ai:prediction for bus ${payload.busId}`);
};

export const emitAlertEvent = (payload: AlertPayload): void => {
  if (!io) {
    return;
  }

  if (payload.busId) {
    io.to(`bus:${payload.busId}`).emit('alert:new', payload.alert);
  }

  if (payload.routeId) {
    io.to(`route:${payload.routeId}`).emit('alert:new', payload.alert);
  }

  io.emit('alert:new', payload.alert);

  logger.info(`Broadcasted alert:new for bus ${payload.busId || 'system'}`);
};

export const emitAlertUpdated = (payload: AlertPayload): void => {
  if (!io) {
    return;
  }

  if (payload.busId) {
    io.to(`bus:${payload.busId}`).emit('alert:updated', payload.alert);
  }

  if (payload.routeId) {
    io.to(`route:${payload.routeId}`).emit('alert:updated', payload.alert);
  }

  io.emit('alert:updated', payload.alert);

  logger.info(`Broadcasted alert:updated for bus ${payload.busId || 'system'}`);
};

export const emitUrbanInsight = (payload: UrbanInsightPayload): void => {
  if (!io) {
    return;
  }

  io.emit('urban:insight', payload.summary);

  logger.info('Broadcasted urban:insight');
};
