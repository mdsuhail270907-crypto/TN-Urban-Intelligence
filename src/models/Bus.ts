import { Document, Schema, model } from 'mongoose';

export const BUS_STATUSES = ['ACTIVE', 'IDLE', 'OFFLINE', 'MAINTENANCE', 'EMERGENCY'] as const;
export type BusStatus = (typeof BUS_STATUSES)[number];

export interface IBusLocation {
  latitude: number;
  longitude: number;
  timestamp?: Date;
}

export interface IBus extends Document {
  busNumber: string;
  registrationNumber: string;
  vehicleType?: string;
  operatorName?: string;
  routeId?: Schema.Types.ObjectId | null;
  status: BusStatus;
  capacity: number;
  currentLocation?: IBusLocation;
  currentSpeed?: number;
  lastSeenAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const busLocationSchema = new Schema<IBusLocation>(
  {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const busSchema = new Schema<IBus>(
  {
    busNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    vehicleType: {
      type: String,
      trim: true
    },
    operatorName: {
      type: String,
      trim: true
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: 'Route',
      default: null
    },
    status: {
      type: String,
      enum: BUS_STATUSES,
      default: 'ACTIVE'
    },
    capacity: {
      type: Number,
      required: true,
      min: 1
    },
    currentLocation: busLocationSchema,
    currentSpeed: {
      type: Number,
      min: 0
    },
    lastSeenAt: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

busSchema.index({ status: 1 });
busSchema.index({ routeId: 1 });
busSchema.index({ isActive: 1 });

const Bus = model<IBus>('Bus', busSchema);

export default Bus;
