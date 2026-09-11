import mongoose from 'mongoose';
import Bus, { BUS_STATUSES, BusStatus } from '../models/Bus';
import Route from '../models/Route';
import { formatSuccessResponse } from '../utils/response';

export interface BusQueryOptions {
  status?: BusStatus;
  routeId?: string;
  isActive?: string;
  page?: number;
  limit?: number;
  search?: string;
}

const ensureDatabaseReady = (): void => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB connection unavailable');
  }
};

const isValidObjectId = (value?: string | null): boolean => {
  return !!value && mongoose.Types.ObjectId.isValid(value);
};

const normalizeBusPayload = (payload: any) => ({
  busNumber: payload.busNumber?.trim(),
  registrationNumber: payload.registrationNumber?.trim(),
  vehicleType: payload.vehicleType?.trim(),
  operatorName: payload.operatorName?.trim(),
  routeId: payload.routeId ?? null,
  status: payload.status,
  capacity: Number(payload.capacity),
  currentLocation: payload.currentLocation,
  currentSpeed: payload.currentSpeed !== undefined ? Number(payload.currentSpeed) : undefined,
  lastSeenAt: payload.lastSeenAt ? new Date(payload.lastSeenAt) : undefined,
  isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true
});

export const createBus = async (payload: any) => {
  ensureDatabaseReady();

  if (!payload.busNumber || !payload.busNumber.trim()) {
    throw new Error('Bus number is required');
  }

  if (!payload.registrationNumber || !payload.registrationNumber.trim()) {
    throw new Error('Registration number is required');
  }

  if (!payload.capacity || Number(payload.capacity) <= 0) {
    throw new Error('Capacity must be greater than 0');
  }

  if (payload.status && !BUS_STATUSES.includes(payload.status)) {
    throw new Error('Invalid bus status');
  }

  if (payload.routeId && !isValidObjectId(payload.routeId)) {
    throw new Error('Invalid routeId');
  }

  if (payload.currentLocation) {
    if (
      typeof payload.currentLocation.latitude !== 'number' ||
      typeof payload.currentLocation.longitude !== 'number'
    ) {
      throw new Error('Current location coordinates are invalid');
    }

    if (payload.currentLocation.latitude < -90 || payload.currentLocation.latitude > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }

    if (payload.currentLocation.longitude < -180 || payload.currentLocation.longitude > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
  }

  if (payload.currentSpeed !== undefined && Number(payload.currentSpeed) < 0) {
    throw new Error('Current speed cannot be negative');
  }

  const normalizedPayload = normalizeBusPayload(payload);

  if (payload.routeId) {
    const routeExists = await Route.exists({ _id: payload.routeId, isActive: true });
    if (!routeExists) {
      throw new Error('Assigned route was not found or is inactive');
    }
  }

  const existingBus = await Bus.findOne({
    $or: [
      { busNumber: normalizedPayload.busNumber },
      { registrationNumber: normalizedPayload.registrationNumber }
    ]
  }).lean();

  if (existingBus) {
    const duplicateField = existingBus.busNumber === normalizedPayload.busNumber ? 'busNumber' : 'registrationNumber';
    throw new Error(`Duplicate ${duplicateField}`);
  }

  const bus = await Bus.create(normalizedPayload);
  return formatSuccessResponse(bus, 'Bus created successfully');
};

export const listBuses = async (query: BusQueryOptions) => {
  ensureDatabaseReady();

  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
  const skip = (page - 1) * limit;

  const filter: any = {};

  if (query.status) {
    if (!BUS_STATUSES.includes(query.status as BusStatus)) {
      throw new Error('Invalid bus status');
    }
    filter.status = query.status;
  }

  if (query.routeId) {
    if (!isValidObjectId(query.routeId)) {
      throw new Error('Invalid routeId');
    }
    filter.routeId = query.routeId;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true';
  }

  if (query.search) {
    const search = query.search.trim();
    filter.$or = [
      { busNumber: { $regex: search, $options: 'i' } },
      { registrationNumber: { $regex: search, $options: 'i' } }
    ];
  }

  const [buses, total] = await Promise.all([
    Bus.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Bus.countDocuments(filter)
  ]);

  return formatSuccessResponse(
    {
      buses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    },
    'Buses fetched successfully'
  );
};

export const getBusById = async (busId: string) => {
  ensureDatabaseReady();

  if (!isValidObjectId(busId)) {
    throw new Error('Invalid busId');
  }

  const bus = await Bus.findById(busId).lean();

  if (!bus) {
    throw new Error('Bus not found');
  }

  return formatSuccessResponse(bus, 'Bus fetched successfully');
};

export const updateBus = async (busId: string, payload: any) => {
  ensureDatabaseReady();

  if (!isValidObjectId(busId)) {
    throw new Error('Invalid busId');
  }

  const allowedFields = ['vehicleType', 'operatorName', 'status', 'capacity', 'routeId', 'isActive'];
  const invalidFields = Object.keys(payload).filter((field) => !allowedFields.includes(field));

  if (invalidFields.length) {
    throw new Error(`Invalid field(s): ${invalidFields.join(', ')}`);
  }

  if (payload.capacity !== undefined && Number(payload.capacity) <= 0) {
    throw new Error('Capacity must be greater than 0');
  }

  if (payload.status && !BUS_STATUSES.includes(payload.status)) {
    throw new Error('Invalid bus status');
  }

  if (payload.routeId !== undefined && payload.routeId !== null && !isValidObjectId(payload.routeId)) {
    throw new Error('Invalid routeId');
  }

  if (payload.routeId) {
    const routeExists = await Route.exists({ _id: payload.routeId, isActive: true });
    if (!routeExists) {
      throw new Error('Assigned route was not found or is inactive');
    }
  }

  const bus = await Bus.findById(busId);

  if (!bus) {
    throw new Error('Bus not found');
  }

  Object.assign(bus, payload);

  if (payload.capacity !== undefined) {
    bus.capacity = Number(payload.capacity);
  }

  if (payload.routeId === null) {
    bus.routeId = null;
  }

  if (payload.isActive !== undefined) {
    bus.isActive = Boolean(payload.isActive);
  }

  await bus.save();

  return formatSuccessResponse(bus, 'Bus updated successfully');
};

export const softDeleteBus = async (busId: string) => {
  ensureDatabaseReady();

  if (!isValidObjectId(busId)) {
    throw new Error('Invalid busId');
  }

  const bus = await Bus.findById(busId);

  if (!bus) {
    throw new Error('Bus not found');
  }

  bus.isActive = false;
  await bus.save();

  return formatSuccessResponse({ id: busId, isActive: false }, 'Bus deactivated successfully');
};

export const assignRouteToBus = async (busId: string, routeId: string) => {
  ensureDatabaseReady();

  if (!isValidObjectId(busId) || !isValidObjectId(routeId)) {
    throw new Error('Invalid busId or routeId');
  }

  const bus = await Bus.findById(busId);
  if (!bus || !bus.isActive) {
    throw new Error('Bus not found or inactive');
  }

  const route = await Route.findById(routeId);
  if (!route || !route.isActive) {
    throw new Error('Route not found or inactive');
  }

  bus.routeId = route._id as any;
  await bus.save();

  return formatSuccessResponse(bus, 'Bus assigned to route successfully');
};

export const removeBusRoute = async (busId: string) => {
  ensureDatabaseReady();

  if (!isValidObjectId(busId)) {
    throw new Error('Invalid busId');
  }

  const bus = await Bus.findById(busId);

  if (!bus) {
    throw new Error('Bus not found');
  }

  bus.routeId = null;
  await bus.save();

  return formatSuccessResponse(bus, 'Bus route removed successfully');
};
