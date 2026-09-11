import { Document, Schema, model } from 'mongoose';

export const AI_PREDICTION_TRENDS = ['IMPROVING', 'STABLE', 'WORSENING'] as const;
export const AI_PREDICTION_SOURCES = ['HEURISTIC_FORECAST', 'ML_MODEL'] as const;

export type AIPredictionTrend = (typeof AI_PREDICTION_TRENDS)[number];
export type AIPredictionSource = (typeof AI_PREDICTION_SOURCES)[number];

export interface IAIPrediction extends Document {
  busId: Schema.Types.ObjectId;
  routeId?: Schema.Types.ObjectId | null;
  generatedAt: Date;
  predictionHorizonMinutes: number;
  predictedCongestionScore: number;
  predictedTrafficCondition: 'FREE_FLOW' | 'MODERATE' | 'CONGESTED' | 'SEVERE';
  predictedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  predictedETAMinutes: number | null;
  confidenceScore: number;
  trend: AIPredictionTrend;
  reasons: string[];
  source: AIPredictionSource;
  modelVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

const aipredictionSchema = new Schema<IAIPrediction>(
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
    generatedAt: {
      type: Date,
      required: true,
      index: true
    },
    predictionHorizonMinutes: {
      type: Number,
      required: true,
      min: 5,
      max: 30
    },
    predictedCongestionScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    predictedTrafficCondition: {
      type: String,
      enum: ['FREE_FLOW', 'MODERATE', 'CONGESTED', 'SEVERE'],
      required: true
    },
    predictedRiskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true
    },
    predictedETAMinutes: {
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
    trend: {
      type: String,
      enum: AI_PREDICTION_TRENDS,
      required: true
    },
    reasons: {
      type: [String],
      default: []
    },
    source: {
      type: String,
      enum: AI_PREDICTION_SOURCES,
      required: true
    },
    modelVersion: {
      type: String,
      required: true,
      default: 'forecast-v1'
    }
  },
  {
    timestamps: true
  }
);

aipredictionSchema.index({ busId: 1, generatedAt: -1 });
aipredictionSchema.index({ routeId: 1, generatedAt: -1 });
aipredictionSchema.index({ generatedAt: -1 });

const AIPrediction = model<IAIPrediction>('AIPrediction', aipredictionSchema);

export default AIPrediction;
