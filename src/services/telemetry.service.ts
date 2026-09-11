import mongoose from 'mongoose';
import Bus, { BUS_STATUSES } from '../models/Bus';
import Route from '../models/Route';
import Telemetry, { TELEMETRY_STATUSES, TelemetryStatus } from '../models/Telemetry';
import { env } from '../config/env';
import logger from '../utils/logger';
import { formatSuccessResponse } from '../utils/response';
import { emitBusLocation, emitBusOffline, emitBusStatus, emitTelemetryUpdate } from '../websocket/telemetry';

export interface TelemetryInput {
  busId: string;
  deviceId: string;
  routeId?: string | null;
  location: {
    latitude: number;
    longitude: number;
  };
  speed: number;
  heading: number;
  status: TelemetryStatus;
  timestamp: string | Date;
  accuracy?: number;
  altitude?: number;
}

export interface TelemetryQueryOptions {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

const ensureDatabaseReady = (): void => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB connection unavailable');
  }
};

const isValidObjectId = (value?: string | null): boolean => {
  return !!value && mongoose.Types.ObjectId.isValid(value);
};

const parseValidDate = (input: string | Date | undefined, fieldName: string): Date => {
  if (input === undefined || input === null || input === '') {
    throw new Error(`${fieldName} is required`);
  }

  const parsed = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date`);
  }

  if (parsed.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new Error(`${fieldName} cannot be in the future`);
  }

  return parsed;
};

const normalizeTelemetryInput = (payload: any): TelemetryInput => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Telemetry payload is required');
  }

  const busId = typeof payload.busId === 'string' ? payload.busId.trim() : '';

  if (!isValidObjectId(busId)) {
    throw new Error('Invalid busId');
  }

  const deviceId = typeof payload.deviceId === 'string' ? payload.deviceId.trim() : '';
  if (!deviceId) {
    throw new Error('Device ID is required');
  }

  if (payload.routeId !== undefined && payload.routeId !== null && !isValidObjectId(payload.routeId)) {
    throw new Error('Invalid routeId');
  }

  const location = payload.location;
  if (!location || typeof location !== 'object') {
    throw new Error('Location is required');
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }

  if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }

  const speed = Number(payload.speed);
  if (Number.isNaN(speed) || speed < 0) {
    throw new Error('Speed must be a number greater than or equal to 0');
  }

  const heading = Number(payload.heading);
  if (Number.isNaN(heading) || heading < 0 || heading >= 360) {
    throw new Error('Heading must be a number between 0 and 359');
  }

  const status = payload.status || 'ACTIVE';
  if (!TELEMETRY_STATUSES.includes(status as TelemetryStatus)) {
    throw new Error('Invalid telemetry status');
  }

  const timestamp = parseValidDate(payload.timestamp, 'Timestamp');

  if (payload.accuracy !== undefined && (Number.isNaN(Number(payload.accuracy)) || Number(payload.accuracy) < 0)) {
    throw new Error('Accuracy must be greater than or equal to 0');
  }

  if (payload.altitude !== undefined && (Number.isNaN(Number(payload.altitude)) || Number(payload.altitude) < 0)) {
    throw new Error('Altitude must be greater than or equal to 0');
  }

  return {
    busId,
    deviceId,
    routeId: payload.routeId || undefined,
    location: {
      latitude,
      longitude
    },
    speed,
    heading,
    status: status as TelemetryStatus,
    timestamp,
    accuracy: payload.accuracy !== undefined ? Number(payload.accuracy) : undefined,
    altitude: payload.altitude !== undefined ? Number(payload.altitude) : undefined
  };
};

const ensureBusExists = async (busId: string) => {
  const bus = await Bus.findById(busId);

  if (!bus) {
    throw new Error('Bus not found');
  }

  if (!bus.isActive) {
    throw new Error('Bus is inactive');
  }

  return bus;
};

const ensureRouteExists = async (routeId?: string | null): Promise<void> => {
  if (!routeId) {
    return;
  }

  const route = await Route.findById(routeId);

  if (!route || !route.isActive) {
    throw new Error('Route not found or inactive');
  }
};

const detectOfflineBuses = async (): Promise<void> => {
  const staleThresholdSeconds = Number(env.TELEMETRY_STALE_THRESHOLD_SECONDS ?? 60);
  const thresholdMs = staleThresholdSeconds * 1000;
  const staleSince = new Date(Date.now() - thresholdMs);

  const buses = await Bus.find({
    isActive: true,
    status: { $nin: ['OFFLINE', 'MAINTENANCE', 'EMERGENCY'] },
    lastSeenAt: { $lt: staleSince }
  });

  for (const bus of buses) {
    bus.status = 'OFFLINE';
    await bus.save();

    emitBusOffline({
      busId: bus._id.toString(),
      lastSeenAt: bus.lastSeenAt ? bus.lastSeenAt.toISOString() : null,
      detectedAt: new Date().toISOString()
    });

    logger.warn(`Bus ${bus.busNumber} marked offline due to stale telemetry`);
  }
};

export const submitTelemetry = async (payload: any) => {
  ensureDatabaseReady();

  const normalizedPayload = normalizeTelemetryInput(payload);
  const bus = await ensureBusExists(normalizedPayload.busId);

  if (normalizedPayload.routeId) {
    await ensureRouteExists(normalizedPayload.routeId);
  }

  const routeId = normalizedPayload.routeId ?? (bus.routeId ? bus.routeId.toString() : null);

  const telemetryRecord = await Telemetry.create({
    busId: new mongoose.Types.ObjectId(normalizedPayload.busId),
    deviceId: normalizedPayload.deviceId,
    routeId: routeId ? new mongoose.Types.ObjectId(routeId) : null,
    location: normalizedPayload.location,
    speed: normalizedPayload.speed,
    heading: normalizedPayload.heading,
    status: normalizedPayload.status,
    timestamp: normalizedPayload.timestamp,
    accuracy: normalizedPayload.accuracy,
    altitude: normalizedPayload.altitude
  });

  bus.currentLocation = {
    latitude: normalizedPayload.location.latitude,
    longitude: normalizedPayload.location.longitude,
    timestamp: normalizedPayload.timestamp instanceof Date ? normalizedPayload.timestamp : new Date(normalizedPayload.timestamp)
  };

  bus.currentSpeed = normalizedPayload.speed;
  bus.lastSeenAt = normalizedPayload.timestamp instanceof Date ? normalizedPayload.timestamp : new Date(normalizedPayload.timestamp);
  bus.status = normalizedPayload.status;

  if (routeId) {
    bus.routeId = new mongoose.Types.ObjectId(routeId) as any;
  }

  await bus.save();

  await detectOfflineBuses();

  const telemetryPayload = {
    busId: telemetryRecord.busId.toString(),
    routeId: telemetryRecord.routeId ? telemetryRecord.routeId.toString() : null,
    location: telemetryRecord.location,
    speed: telemetryRecord.speed,
    heading: telemetryRecord.heading,
    status: telemetryRecord.status,
    timestamp: telemetryRecord.timestamp.toISOString(),
    deviceId: telemetryRecord.deviceId,
    accuracy: telemetryRecord.accuracy,
    altitude: telemetryRecord.altitude
  };

  emitTelemetryUpdate(telemetryPayload);
  emitBusLocation({
    busId: telemetryPayload.busId,
    location: telemetryPayload.location,
    timestamp: telemetryPayload.timestamp
  });
  emitBusStatus({
    busId: telemetryPayload.busId,
    status: telemetryPayload.status,
    timestamp: telemetryPayload.timestamp
  });

  logger.info(`Telemetry received for bus ${bus.busNumber} from device ${normalizedPayload.deviceId}`);

  return formatSuccessResponse(
    {
      telemetry: telemetryPayload,
      bus: {
        _id: bus._id,
        busNumber: bus.busNumber,
        routeId: bus.routeId ? bus.routeId.toString() : null,
        status: bus.status,
        currentLocation: bus.currentLocation,
        currentSpeed: bus.currentSpeed,
        lastSeenAt: bus.lastSeenAt
      }
    },
    'Telemetry submitted successfully'
  );
};

export const getBusTelemetry = async (busId: string, query: TelemetryQueryOptions) => {
  ensureDatabaseReady();

  if (!isValidObjectId(busId)) {
    throw new Error('Invalid busId');
  }

  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50)));
  const skip = (page - 1) * limit;

  const filter: any = { busId: new mongoose.Types.ObjectId(busId) };

  if (query.from) {
    const fromDate = parseValidDate(query.from, 'From');
    filter.timestamp = { ...filter.timestamp, $gte: fromDate };
  }

  if (query.to) {
    const toDate = parseValidDate(query.to, 'To');
    filter.timestamp = { ...filter.timestamp, $lte: toDate };
  }

  const [telemetry, total] = await Promise.all([
    Telemetry.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    Telemetry.countDocuments(filter)
  ]);

  return formatSuccessResponse(
    {
      telemetry,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    },
    'Telemetry history fetched successfully'
  );
};

export const getLatestTelemetryByBusId = async (busId: string) => {
  ensureDatabaseReady();

  if (!isValidObjectId(busId)) {
    throw new Error('Invalid busId');
  }

  const telemetry = await Telemetry.findOne({ busId: new mongoose.Types.ObjectId(busId) }).sort({ timestamp: -1 }).lean();

  if (!telemetry) {
    throw new Error('Telemetry not found');
  }

  return formatSuccessResponse(telemetry, 'Latest telemetry fetched successfully');
};

export const getTelemetryStatusSummary = async () => {
  ensureDatabaseReady();

  const [busCount, telemetryCount] = await Promise.all([
    Bus.countDocuments({ isActive: true }),
    Telemetry.countDocuments()
  ]);

  return {
    buses: busCount,
    telemetryRecords: telemetryCount,
    telemetryWindowSeconds: Number(env.TELEMETRY_STALE_THRESHOLD_SECONDS ?? 60)
  };
};
