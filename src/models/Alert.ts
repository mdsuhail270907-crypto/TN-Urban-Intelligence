import { Document, Schema, model } from 'mongoose';

export const ALERT_TYPES = ['CONGESTION', 'ANOMALY', 'RISK', 'OFFLINE', 'ETA', 'PREDICTION', 'EMERGENCY'] as const;
export const ALERT_SEVERITIES = ['INFO', 'WARNING', 'HIGH', 'CRITICAL'] as const;
export const ALERT_SOURCES = ['AI', 'TELEMETRY', 'SYSTEM'] as const;
export const ALERT_STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const;

export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];
export type AlertSource = (typeof ALERT_SOURCES)[number];
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export interface IAlert extends Document {
  busId?: Schema.Types.ObjectId | null;
  routeId?: Schema.Types.ObjectId | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: AlertSource;
  triggeredAt: Date;
  acknowledgedAt?: Date | null;
  acknowledgedBy?: Schema.Types.ObjectId | null;
  resolvedAt?: Date | null;
  resolvedBy?: Schema.Types.ObjectId | null;
  status: AlertStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    busId: {
      type: Schema.Types.ObjectId,
      ref: 'Bus',
      default: null,
      index: true
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true
    },
    type: {
      type: String,
      enum: ALERT_TYPES,
      required: true
    },
    severity: {
      type: String,
      enum: ALERT_SEVERITIES,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      type: String,
      enum: ALERT_SOURCES,
      required: true
    },
    triggeredAt: {
      type: Date,
      required: true,
      index: true
    },
    acknowledgedAt: {
      type: Date,
      default: null
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    status: {
      type: String,
      enum: ALERT_STATUSES,
      required: true,
      default: 'ACTIVE'
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

alertSchema.index({ status: 1, severity: 1 });
alertSchema.index({ busId: 1, triggeredAt: -1 });
alertSchema.index({ routeId: 1, triggeredAt: -1 });
alertSchema.index({ createdAt: -1 });

const Alert = model<IAlert>('Alert', alertSchema);

export default Alert;
