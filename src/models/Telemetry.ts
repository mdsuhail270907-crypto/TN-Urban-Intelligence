import { Document, Schema, model } from 'mongoose';

export const TELEMETRY_STATUSES = ['ACTIVE', 'IDLE', 'OFFLINE', 'MAINTENANCE', 'EMERGENCY'] as const;
export type TelemetryStatus = (typeof TELEMETRY_STATUSES)[number];

export interface ITelemetryLocation {
  latitude: number;
  longitude: number;
}

export interface ITelemetry extends Document {
  busId: Schema.Types.ObjectId;
  deviceId?: string;
  routeId?: Schema.Types.ObjectId | null;
  location: ITelemetryLocation;
  speed: number;
  heading: number;
  status: TelemetryStatus;
  timestamp: Date;
  accuracy?: number;
  altitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

const telemetryLocationSchema = new Schema<ITelemetryLocation>(
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
    }
  },
  { _id: false }
);

const telemetrySchema = new Schema<ITelemetry>(
  {
    busId: {
      type: Schema.Types.ObjectId,
      ref: 'Bus',
      required: true,
      index: true
    },
    deviceId: {
      type: String,
      trim: true,
      required: true,
      index: true
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true
    },
    location: {
      type: telemetryLocationSchema,
      required: true
    },
    speed: {
      type: Number,
      required: true,
      min: 0
    },
    heading: {
      type: Number,
      required: true,
      min: 0,
      max: 359
    },
    status: {
      type: String,
      enum: TELEMETRY_STATUSES,
      required: true,
      default: 'ACTIVE'
    },
    timestamp: {
      type: Date,
      required: true,
      index: true
    },
    accuracy: {
      type: Number,
      min: 0
    },
    altitude: {
      type: Number,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

telemetrySchema.index({ busId: 1, timestamp: -1 });
telemetrySchema.index({ deviceId: 1, timestamp: -1 });
telemetrySchema.index({ routeId: 1, timestamp: -1 });
telemetrySchema.index({ timestamp: -1 });

const Telemetry = model<ITelemetry>('Telemetry', telemetrySchema);

export default Telemetry;
