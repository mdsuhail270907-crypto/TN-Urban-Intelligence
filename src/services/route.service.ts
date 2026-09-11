import mongoose from 'mongoose';
import Route from '../models/Route';
import { formatSuccessResponse } from '../utils/response';

export interface RouteQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
}

const ensureDatabaseReady = (): void => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB connection unavailable');
  }
};

const isValidObjectId = (value?: string | null): boolean => {
  return !!value && mongoose.Types.ObjectId.isValid(value);
};

const normalizeRoutePayload = (payload: any) => ({
  routeNumber: payload.routeNumber?.trim(),
  routeName: payload.routeName?.trim(),
  description: payload.description?.trim(),
  stops: payload.stops,
  path: payload.path,
  estimatedDurationMinutes: payload.estimatedDurationMinutes !== undefined ? Number(payload.estimatedDurationMinutes) : undefined,
  distanceKm: payload.distanceKm !== undefined ? Number(payload.distanceKm) : undefined,
  isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true
});

const validateStops = (stops: any[]) => {
  if (!Array.isArray(stops) || stops.length < 2) {
    throw new Error('Route must contain at least 2 stops');
  }

  for (const stop of stops) {
    if (!stop.name || !stop.name.trim()) {
      throw new Error('Each stop must have a name');
    }

    if (typeof stop.latitude !== 'number' || stop.latitude < -90 || stop.latitude > 90) {
      throw new Error('Stop latitude must be a number between -90 and 90');
    }

    if (typeof stop.longitude !== 'number' || stop.longitude < -180 || stop.longitude > 180) {
      throw new Error('Stop longitude must be a number between -180 and 180');
    }

    if (!Number.isInteger(stop.sequence) || stop.sequence < 1) {
      throw new Error('Each stop must have a valid sequence number');
    }
  }

  const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].sequence !== i + 1) {
      throw new Error('Stops sequence must be ordered from 1 upwards');
    }
  }
};

export const createRoute = async (payload: any) => {
  ensureDatabaseReady();

  if (!payload.routeNumber || !payload.routeNumber.trim()) {
    throw new Error('Route number is required');
  }

  if (!payload.routeName || !payload.routeName.trim()) {
    throw new Error('Route name is required');
  }

  validateStops(payload.stops || []);

  if (payload.estimatedDurationMinutes !== undefined && Number(payload.estimatedDurationMinutes) <= 0) {
    throw new Error('Estimated duration must be greater than 0');
  }

  if (payload.distanceKm !== undefined && Number(payload.distanceKm) < 0) {
    throw new Error('Distance cannot be negative');
  }

  const normalizedPayload = normalizeRoutePayload(payload);

  const existingRoute = await Route.findOne({
    $or: [
      { routeNumber: normalizedPayload.routeNumber },
      { routeName: normalizedPayload.routeName }
    ]
  }).lean();

  if (existingRoute) {
    const duplicateField = existingRoute.routeNumber === normalizedPayload.routeNumber ? 'routeNumber' : 'routeName';
    throw new Error(`Duplicate ${duplicateField}`);
  }

  const route = await Route.create(normalizedPayload);
  return formatSuccessResponse(route, 'Route created successfully');
};

export const listRoutes = async (query: RouteQueryOptions) => {
  ensureDatabaseReady();

  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
  const skip = (page - 1) * limit;

  const filter: any = {};

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true';
  }

  if (query.search) {
    const search = query.search.trim();
    filter.$or = [
      { routeNumber: { $regex: search, $options: 'i' } },
      { routeName: { $regex: search, $options: 'i' } }
    ];
  }

  const [routes, total] = await Promise.all([
    Route.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Route.countDocuments(filter)
  ]);

  return formatSuccessResponse(
    {
      routes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    },
    'Routes fetched successfully'
  );
};

export const getRouteById = async (routeId: string) => {
  ensureDatabaseReady();

  if (!isValidObjectId(routeId)) {
    throw new Error('Invalid routeId');
  }

  const route = await Route.findById(routeId).lean();

  if (!route) {
    throw new Error('Route not found');
  }

  return formatSuccessResponse(route, 'Route fetched successfully');
};

export const updateRoute = async (routeId: string, payload: any) => {
  ensureDatabaseReady();

  if (!isValidObjectId(routeId)) {
    throw new Error('Invalid routeId');
  }

  const route = await Route.findById(routeId);

  if (!route) {
    throw new Error('Route not found');
  }

  const allowedFields = ['routeNumber', 'routeName', 'description', 'stops', 'path', 'estimatedDurationMinutes', 'distanceKm', 'isActive'];
  const invalidFields = Object.keys(payload).filter((field) => !allowedFields.includes(field));

  if (invalidFields.length) {
    throw new Error(`Invalid field(s): ${invalidFields.join(', ')}`);
  }

  if (payload.stops !== undefined) {
    validateStops(payload.stops);
  }

  if (payload.estimatedDurationMinutes !== undefined && Number(payload.estimatedDurationMinutes) <= 0) {
    throw new Error('Estimated duration must be greater than 0');
  }

  if (payload.distanceKm !== undefined && Number(payload.distanceKm) < 0) {
    throw new Error('Distance cannot be negative');
  }

  Object.assign(route, normalizeRoutePayload(payload));

  await route.save();

  return formatSuccessResponse(route, 'Route updated successfully');
};

export const softDeleteRoute = async (routeId: string) => {
  ensureDatabaseReady();

  if (!isValidObjectId(routeId)) {
    throw new Error('Invalid routeId');
  }

  const route = await Route.findById(routeId);

  if (!route) {
    throw new Error('Route not found');
  }

  route.isActive = false;
  await route.save();

  return formatSuccessResponse({ id: routeId, isActive: false }, 'Route deactivated successfully');
};
