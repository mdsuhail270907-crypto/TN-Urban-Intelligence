import mongoose from 'mongoose';
import AIAnalysis from '../models/AIAnalysis';
import Bus from '../models/Bus';
import Route from '../models/Route';
import Telemetry from '../models/Telemetry';
import { env } from '../config/env';
import { formatSuccessResponse } from '../utils/response';
import { emitAIUpdate } from '../websocket/telemetry';
import { evaluateCongestion } from './ai/congestion.service';
import { detectAnomalies } from './ai/anomaly.service';
import { assessRisk } from './ai/risk.service';
import { estimateETA } from './ai/eta.service';
import { calculateConfidence } from './ai/confidence.service';

export interface AIAnalysisInput {
  bus: {
    id: string;
    busNumber: string;
    capacity: number | null;
    status: string;
  };
  route?: {
    id: string;
    routeNumber: string;
    distanceKm?: number | null;
    estimatedDurationMinutes?: number | null;
    stops?: Array<{ name: string; latitude: number; longitude: number; sequence: number }>;
    path?: Array<{ latitude: number; longitude: number }>;
  } | null;
  latestTelemetry: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    status: string;
    timestamp: string | Date;
  };
  recentTelemetry: Array<{
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    status: string;
    timestamp: string | Date;
  }>;
}

export interface AIAnalysisResult {
  busId: string;
  routeId: string | null;
  timestamp: Date;
  congestionScore: number;
  trafficCondition: string;
  occupancyEstimate: number | null;
  anomalyScore: number;
  riskLevel: string;
  estimatedETAMinutes: number | null;
  confidenceScore: number;
  reasons: string[];
  source: 'HEURISTIC_BASELINE' | 'ML_MODEL';
  modelVersion: string;
  inputTelemetryTimestamp: Date;
}

export interface UrbanIntelligenceProvider {
  generate(input: AIAnalysisInput): Promise<AIAnalysisResult>;
}

const isValidObjectId = (value?: string | null): boolean => {
  return !!value && mongoose.Types.ObjectId.isValid(value);
};

const ensureDatabaseReady = (): void => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB connection unavailable');
  }
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const normalizeRecentTelemetry = (telemetry: any[]) =>
  telemetry.map((entry) => ({
    latitude: Number(entry.location.latitude),
    longitude: Number(entry.location.longitude),
    speed: Number(entry.speed),
    heading: Number(entry.heading),
    status: entry.status,
    timestamp: entry.timestamp
  }));

const normalizeLatestTelemetry = (telemetry: any) => ({
  latitude: Number(telemetry.location.latitude),
  longitude: Number(telemetry.location.longitude),
  speed: Number(telemetry.speed),
  heading: Number(telemetry.heading),
  status: telemetry.status,
  timestamp: telemetry.timestamp
});

const deriveSpeedConsistencyScore = (recentTelemetry: Array<{ speed: number }>): number => {
  if (!recentTelemetry.length) {
    return 0;
  }

  const speeds = recentTelemetry.map((entry) => entry.speed);
  const averageSpeed = speeds.reduce((sum, value) => sum + value, 0) / speeds.length;

  if (averageSpeed === 0) {
    return 0;
  }

  const variance = speeds.reduce((sum, speed) => sum + (speed - averageSpeed) ** 2, 0) / speeds.length;
  const coefficient = Math.sqrt(variance) / averageSpeed;

  return clamp(1 - coefficient, 0, 1);
};

const deriveDataCompletenessScore = (input: AIAnalysisInput): number => {
  const checks = [
    input.bus.busNumber,
    input.latestTelemetry.latitude !== undefined,
    input.latestTelemetry.longitude !== undefined,
    input.latestTelemetry.speed !== undefined,
    input.latestTelemetry.timestamp,
    input.route !== null && input.route !== undefined
  ];

  const trueChecks = checks.filter(Boolean).length;
  return clamp(trueChecks / checks.length, 0, 1);
};

export class HeuristicAIProvider implements UrbanIntelligenceProvider {
  async generate(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    const timestamp = new Date();

    const congestion = evaluateCongestion({
      currentSpeed: input.latestTelemetry.speed,
      recentSpeeds: input.recentTelemetry.map((entry) => entry.speed),
      route: input.route
        ? {
            distanceKm: input.route.distanceKm ?? undefined,
            estimatedDurationMinutes: input.route.estimatedDurationMinutes ?? undefined
          }
        : null
    });

    const anomaly = detectAnomalies({
      currentTelemetry: {
        ...input.latestTelemetry,
        location: {
          latitude: input.latestTelemetry.latitude,
          longitude: input.latestTelemetry.longitude
        },
        timestamp: input.latestTelemetry.timestamp
      },
      recentTelemetry: input.recentTelemetry.map((entry) => ({
        ...entry,
        location: {
          latitude: entry.latitude,
          longitude: entry.longitude
        },
        timestamp: entry.timestamp
      })),
      staleThresholdSeconds: env.TELEMETRY_STALE_THRESHOLD_SECONDS
    });

    const latestTelemetryAgeSeconds =
      (Date.now() - new Date(input.latestTelemetry.timestamp).getTime()) / 1000;

    const risk = assessRisk({
      congestionScore: congestion.congestionScore,
      anomalyScore: anomaly.anomalyScore,
      busStatus: input.bus.status,
      latestTelemetryAgeSeconds,
      staleThresholdSeconds: env.TELEMETRY_STALE_THRESHOLD_SECONDS
    });

    const eta = estimateETA({
      currentSpeed: input.latestTelemetry.speed,
      route: input.route
        ? {
            distanceKm: input.route.distanceKm ?? undefined,
            path: input.route.path,
            estimatedDurationMinutes: input.route.estimatedDurationMinutes ?? undefined
          }
        : null
    });

    const confidence = calculateConfidence({
      latestTelemetryAgeSeconds,
      recentTelemetryCount: input.recentTelemetry.length,
      routeAvailable: !!input.route,
      speedConsistencyScore: deriveSpeedConsistencyScore(input.recentTelemetry),
      dataCompletenessScore: deriveDataCompletenessScore(input),
      staleThresholdSeconds: env.TELEMETRY_STALE_THRESHOLD_SECONDS
    });

    const reasons = Array.from(
      new Set([
        ...congestion.reasons,
        ...anomaly.reasons,
        ...risk.reasons,
        ...eta.reasons,
        ...confidence.reasons,
        'Occupancy data unavailable.'
      ])
    );

    return {
      busId: input.bus.id,
      routeId: input.route?.id ?? null,
      timestamp,
      congestionScore: congestion.congestionScore,
      trafficCondition: congestion.trafficCondition,
      occupancyEstimate: null,
      anomalyScore: anomaly.anomalyScore,
      riskLevel: risk.riskLevel,
      estimatedETAMinutes: eta.estimatedETAMinutes,
      confidenceScore: confidence.confidenceScore,
      reasons,
      source: 'HEURISTIC_BASELINE',
      modelVersion: 'baseline-v1',
      inputTelemetryTimestamp: new Date(input.latestTelemetry.timestamp)
    };
  }
}

const provider = new HeuristicAIProvider();

const buildAIInput = async (bus: any): Promise<AIAnalysisInput> => {
  const route = bus.routeId ? await Route.findById(bus.routeId).lean() : null;

  const latestTelemetry = await Telemetry.findOne({ busId: bus._id }).sort({ timestamp: -1 }).lean();

  if (!latestTelemetry) {
    throw new Error('Insufficient telemetry data for AI analysis.');
  }

  const recentTelemetry = await Telemetry.find({ busId: bus._id }).sort({ timestamp: -1 }).limit(20).lean();

  return {
    bus: {
      id: bus._id.toString(),
      busNumber: bus.busNumber,
      capacity: bus.capacity ?? null,
      status: bus.status
    },
    route: route
      ? {
          id: route._id.toString(),
          routeNumber: route.routeNumber,
          distanceKm: route.distanceKm ?? null,
          estimatedDurationMinutes: route.estimatedDurationMinutes ?? null,
          stops: route.stops,
          path: route.path ?? []
        }
      : null,
    latestTelemetry: normalizeLatestTelemetry(latestTelemetry),
    recentTelemetry: normalizeRecentTelemetry(recentTelemetry)
  };
};

const parseDateFilter = (value: string | undefined, fieldName: string): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return parsed;
};

const parseLimit = (value: string | undefined, defaultLimit: number): number => {
  const parsed = Number(value ?? defaultLimit);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error('Invalid limit');
  }

  return Math.min(parsed, 100);
};

export const analyzeBus = async (busId: string): Promise<any> => {
  ensureDatabaseReady();

  if (!isValidObjectId(busId)) {
    throw new Error('Invalid busId');
  }

  const bus = await Bus.findById(busId).lean();

  if (!bus) {
    throw new Error('Bus not found');
  }

  const input = await buildAIInput(bus);
  const analysis = await provider.generate(input);

  const savedAnalysis = await AIAnalysis.create({
    busId: new mongoose.Types.ObjectId(analysis.busId),
    routeId: analysis.routeId ? new mongoose.Types.ObjectId(analysis.routeId) : null,
    timestamp: analysis.timestamp,
    congestionScore: analysis.congestionScore,
    trafficCondition: analysis.trafficCondition,
    occupancyEstimate: analysis.occupancyEstimate,
    anomalyScore: analysis.anomalyScore,
    riskLevel: analysis.riskLevel,
    estimatedETAMinutes: analysis.estimatedETAMinutes,
    confidenceScore: analysis.confidenceScore,
    reasons: analysis.reasons,
    source: analysis.source,
    modelVersion: analysis.modelVersion,
    inputTelemetryTimestamp: analysis.inputTelemetryTimestamp
  });

  emitAIUpdate({
    busId: analysis.busId,
    routeId: analysis.routeId,
    analysis: {
      ...analysis,
      _id: savedAnalysis._id,
      createdAt: savedAnalysis.createdAt,
      updatedAt: savedAnalysis.updatedAt
    }
  });

  return formatSuccessResponse(
    {
      ...analysis,
      _id: savedAnalysis._id,
      createdAt: savedAnalysis.createdAt,
      updatedAt: savedAnalysis.updatedAt
    },
    'AI analysis completed successfully'
  );
};

export const getLatestAIAnalysis = async (busId: string): Promise<any> => {
  ensureDatabaseReady();

  if (!isValidObjectId(busId)) {
    throw new Error('Invalid busId');
  }

  const analysis = await AIAnalysis.findOne({ busId: new mongoose.Types.ObjectId(busId) })
    .sort({ timestamp: -1 })
    .lean();

  if (!analysis) {
    throw new Error('No AI analysis available');
  }

  return formatSuccessResponse(analysis, 'Latest AI analysis fetched successfully');
};

export const getAIAnalysisHistory = async (
  busId: string,
  query: Record<string, string | undefined>
): Promise<any> => {
  ensureDatabaseReady();

  if (!isValidObjectId(busId)) {
    throw new Error('Invalid busId');
  }

  const page = Math.max(1, Number(query.page ?? 1));
  const limit = parseLimit(query.limit, 20);
  const skip = (page - 1) * limit;

  const fromDate = parseDateFilter(query.from, 'from');
  const toDate = parseDateFilter(query.to, 'to');

  const filter: any = { busId: new mongoose.Types.ObjectId(busId) };

  if (fromDate) {
    filter.timestamp = { ...filter.timestamp, $gte: fromDate };
  }

  if (toDate) {
    filter.timestamp = { ...filter.timestamp, $lte: toDate };
  }

  const [analyses, total] = await Promise.all([
    AIAnalysis.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    AIAnalysis.countDocuments(filter)
  ]);

  return formatSuccessResponse(
    {
      analyses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    },
    'AI analysis history fetched successfully'
  );
};

export const batchAnalyzeBuses = async (busIds: string[]): Promise<any> => {
  ensureDatabaseReady();

  if (!Array.isArray(busIds) || busIds.length === 0) {
    throw new Error('busIds must be a non-empty array');
  }

  const validBusIds = busIds.map((busId) => busId?.trim()).filter(Boolean);

  if (validBusIds.length !== busIds.length) {
    throw new Error('Invalid busIds array');
  }

  if (validBusIds.length > 20) {
    throw new Error('Batch size cannot exceed 20 buses');
  }

  const results = await Promise.all(
    validBusIds.map(async (busId) => {
      try {
        if (!isValidObjectId(busId)) {
          throw new Error('Invalid busId');
        }

        const data = await analyzeBus(busId);
        return {
          busId,
          success: true,
          analysis: data.data
        };
      } catch (error) {
        return {
          busId,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to analyze bus'
        };
      }
    })
  );

  return formatSuccessResponse(
    { results },
    'Batch AI analysis completed'
  );
};
