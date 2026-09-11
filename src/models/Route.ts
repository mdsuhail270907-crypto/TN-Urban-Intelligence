import { Document, Schema, model } from 'mongoose';

export interface IRouteStop {
  name: string;
  latitude: number;
  longitude: number;
  sequence: number;
}

export interface IRoutePoint {
  latitude: number;
  longitude: number;
}

export interface IRoute extends Document {
  routeNumber: string;
  routeName: string;
  description?: string;
  stops: IRouteStop[];
  path?: IRoutePoint[];
  estimatedDurationMinutes?: number;
  distanceKm?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const routeStopSchema = new Schema<IRouteStop>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
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
    sequence: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { _id: false }
);

const routePointSchema = new Schema<IRoutePoint>(
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

const routeSchema = new Schema<IRoute>(
  {
    routeNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    routeName: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    stops: {
      type: [routeStopSchema],
      required: true,
      validate: {
        validator: (value: IRouteStop[]) => value.length >= 2,
        message: 'Route must contain at least 2 stops'
      }
    },
    path: {
      type: [routePointSchema]
    },
    estimatedDurationMinutes: {
      type: Number,
      min: 1
    },
    distanceKm: {
      type: Number,
      min: 0
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

routeSchema.index({ routeName: 1 });
routeSchema.index({ isActive: 1 });

const Route = model<IRoute>('Route', routeSchema);

export default Route;
