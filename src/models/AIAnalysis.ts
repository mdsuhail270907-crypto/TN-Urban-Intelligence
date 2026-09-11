import { Document, Schema, model } from 'mongoose';

export const AI_TRAFFIC_CONDITIONS = ['FREE_FLOW', 'MODERATE', 'CONGESTED', 'SEVERE'] as const;
export const AI_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const AI_ANALYSIS_SOURCES = ['HEURISTIC_BASELINE', 'ML_MODEL'] as const;

export type AIAnalysisTrafficCondition = (typeof AI_TRAFFIC_CONDITIONS)[number];
export type AIAnalysisRiskLevel = (typeof AI_RISK_LEVELS)[number];
export type AIAnalysisSource = (typeof AI_ANALYSIS_SOURCES)[number];

export interface IAIAnalysis extends Document {
  busId: Schema.Types.ObjectId;
  routeId?: Schema.Types.ObjectId | null;
  timestamp: Date;
  congestionScore: number;
  trafficCondition: AIAnalysisTrafficCondition;
  occupancyEstimate: number | null;
  anomalyScore: number;
  riskLevel: AIAnalysisRiskLevel;
  estimatedETAMinutes: number | null;
  confidenceScore: number;
  reasons: string[];
  source: AIAnalysisSource;
  modelVersion: string;
  inputTelemetryTimestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const aiAnalysisSchema = new Schema<IAIAnalysis>(
  {
    busId: {
      type: Schema.Types.ObjectId,
      ref: 'Bus',
      required: true,
      index: true
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true
    },
    timestamp: {
      type: Date,
      required: true,
      index: true
    },
    congestionScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    trafficCondition: {
      type: String,
      enum: AI_TRAFFIC_CONDITIONS,
      required: true
    },
    occupancyEstimate: {
      type: Number,
      min: 0,
      default: null
    },
    anomalyScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    riskLevel: {
      type: String,
      enum: AI_RISK_LEVELS,
      required: true
    },
    estimatedETAMinutes: {
      type: Number,
      min: 0,
      default: null
    },
    confidenceScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    reasons: {
      type: [String],
      default: []
    },
    source: {
      type: String,
      enum: AI_ANALYSIS_SOURCES,
      required: true
    },
    modelVersion: {
      type: String,
      required: true,
      default: 'baseline-v1'
    },
    inputTelemetryTimestamp: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

aiAnalysisSchema.index({ busId: 1, timestamp: -1 });
aiAnalysisSchema.index({ routeId: 1, timestamp: -1 });
aiAnalysisSchema.index({ timestamp: -1 });

const AIAnalysis = model<IAIAnalysis>('AIAnalysis', aiAnalysisSchema);

export default AIAnalysis;
