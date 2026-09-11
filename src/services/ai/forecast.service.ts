import mongoose from 'mongoose';
import AIAnalysis, { AIAnalysisTrafficCondition } from '../../models/AIAnalysis';
import AIPrediction, { AI_PREDICTION_TRENDS, AIPredictionTrend } from '../../models/AIPrediction';
import Bus from '../../models/Bus';
import Route from '../../models/Route';
import Telemetry from '../../models/Telemetry';
import { emitAIUpdate, emitPredictionUpdate } from '../../websocket/telemetry';
import { classifyTrafficCondition } from './congestion.service';
import { calculateTrends } from './trend.service';

export interface ForecastInput {
  busId: string;
  horizonMinutes?: number;
}

export interface ForecastResult {
  busId: string;
  routeId: string | null;
  generatedAt: Date;
  predictionHorizonMinutes: number;
  predictedCongestionScore: number;
  predictedTrafficCondition: AIAnalysisTrafficCondition;
  predictedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  predictedETAMinutes: number | null;
  confidenceScore: number;
  trend: AIPredictionTrend;
  reasons: string[];
  source: 'HEURISTIC_FORECAST' | 'ML_MODEL';
  modelVersion: string;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const average = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const DEFAULT_HORIZON = 10;
const ALLOWED_HORIZONS = [5, 10, 15, 30];

const normalizePredictionInput = (horizonMinutes?: number): number => {
  const candidate = horizonMinutes ?? DEFAULT_HORIZON;

  if (!ALLOWED_HORIZONS.includes(candidate)) {
    throw new Error('Unsupported horizonMinutes. Allowed values are 5, 10, 15, or 30.');
  }

  return candidate;
};

const classifyRiskFromPrediction = (predictedCongestionScore: number, anomalyScore: number, busStatus?: string | null): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
  if (busStatus === 'EMERGENCY') {
    return 'CRITICAL';
  }

  if (predictedCongestionScore >= 75 || anomalyScore >= 65) {
    return predictedCongestionScore >= 90 || anomalyScore >= 80 ? 'CRITICAL' : 'HIGH';
  }

  if (predictedCongestionScore >= 50 || anomalyScore >= 40) {
    return 'MEDIUM';
  }

  return 'LOW';
};

const computePredictionConfidence = (
  recentTelemetryCount: number,
  latestTelemetryAgeSeconds: number,
  trendConsistency: number,
  routeAvailable: boolean,
  aiAnalysisAvailable: boolean,
  staleThresholdSeconds: number
): number => {
  let confidence = 50;

  confidence += Math.min(recentTelemetryCount * 4, 20);
  confidence += routeAvailable ? 10 : 0;
  confidence += aiAnalysisAvailable ? 10 : 0;

  const freshnessPenalty = Math.min(Math.max((latestTelemetryAgeSeconds - staleThresholdSeconds) / staleThresholdSeconds, 0), 1) * 25;
  confidence -= freshnessPenalty;

  confidence += trendConsistency * 20;

  return clamp(Math.round(confidence), 0, 100);
};

const collectHistory = async (busId: string) => {
  const bus = await Bus.findById(busId).lean();

  const [latestTelemetry, recentTelemetry, recentAIAnalyses, route] = await Promise.all([
    Telemetry.findOne({ busId: new mongoose.Types.ObjectId(busId) }).sort({ timestamp: -1 }).lean(),
    Telemetry.find({ busId: new mongoose.Types.ObjectId(busId) }).sort({ timestamp: -1 }).limit(10).lean(),
    AIAnalysis.find({ busId: new mongoose.Types.ObjectId(busId) }).sort({ timestamp: -1 }).limit(10).lean(),
    bus?.routeId ? Route.findById(bus.routeId).lean() : null
  ]);

  return { latestTelemetry, recentTelemetry, recentAIAnalyses, bus, route };
};

const buildReasons = (
  congestionTrend: 'IMPROVING' | 'STABLE' | 'WORSENING',
  speedTrend: 'IMPROVING' | 'STABLE' | 'WORSENING',
  anomalyTrend: 'IMPROVING' | 'STABLE' | 'WORSENING',
  etaTrend: 'IMPROVING' | 'STABLE' | 'WORSENING',
  initialCongestion: number,
  predictedCongestion: number,
  predictedETA: number | null
): string[] => {
  const reasons: string[] = [];

  if (congestionTrend === 'WORSENING') {
    reasons.push('Congestion trend is worsening based on recent AI analysis and telemetry deltas.');
  } else if (congestionTrend === 'IMPROVING') {
    reasons.push('Congestion trend is improving based on recent route performance signals.');
  } else {
    reasons.push('Congestion is remaining broadly stable over the recent observation window.');
  }

  if (speedTrend === 'WORSENING') {
    reasons.push('Speed has been declining, which supports the forecasted congestion increase.');
  } else if (speedTrend === 'IMPROVING') {
    reasons.push('Speed has been improving, which supports a more favorable forecast.');
  }

  if (anomalyTrend === 'WORSENING') {
    reasons.push('Anomaly activity is rising and may reduce prediction stability.');
  }

  if (predictedETA !== null) {
    if (etaTrend === 'WORSENING') {
      reasons.push(`ETA is expected to increase by approximately ${predictedETA} minutes over the forecast horizon.`);
    } else {
      reasons.push('ETA is expected to remain relatively consistent across the forecast horizon.');
    }
  }

  if (predictedCongestion >= 75) {
    reasons.push('The forecast indicates severe congestion is likely within the next horizon.');
  } else if (predictedCongestion >= 50) {
    reasons.push('The forecast indicates congested conditions are likely in the next horizon.');
  }

  if (initialCongestion >= 70 && predictedCongestion < initialCongestion) {
    reasons.push('The forecast suggests some relief is likely compared with the current congestion level.');
  }

  return Array.from(new Set(reasons));
};

export const forecastBus = async (busId: string, horizonMinutes?: number): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(busId)) {
    throw new Error('Invalid busId');
  }

  const normalizedHorizon = normalizePredictionInput(horizonMinutes);

  const { latestTelemetry, recentTelemetry, recentAIAnalyses, bus, route } = await collectHistory(busId);

  if (!bus) {
    throw new Error('Bus not found');
  }

  if (!latestTelemetry) {
    throw new Error('Insufficient telemetry data for forecasting.');
  }

  if (recentTelemetry.length < 2) {
    throw new Error('Insufficient telemetry history for forecasting.');
  }

  const latestTiming = new Date(latestTelemetry.timestamp);
  const latestTelemetryAgeSeconds = (Date.now() - latestTiming.getTime()) / 1000;

  const congestionSeries = recentAIAnalyses.length
    ? recentAIAnalyses.map((analysis) => analysis.congestionScore)
    : recentTelemetry.slice(0, 5).map((entry) => {
        const currentSpeed = Number(entry.speed ?? 0);
        const threshold = route?.distanceKm && route?.estimatedDurationMinutes
          ? (route.distanceKm / (route.estimatedDurationMinutes / 60))
          : 25;

        const speedRelativeScore = clamp(((threshold - currentSpeed) / Math.max(threshold, 1)) * 100, 0, 100);
        return clamp(Math.round(speedRelativeScore), 0, 100);
      });

  const congestionTrend = calculateTrends({
    speedValues: recentTelemetry.map((entry) => Number(entry.speed ?? 0)),
    congestionValues: congestionSeries,
    anomalyValues: recentAIAnalyses.map((analysis) => analysis.anomalyScore),
    etaValues: recentAIAnalyses.map((analysis) => analysis.estimatedETAMinutes ?? 0)
  });

  const initialCongestion = congestionSeries[0] ?? 0;
  const currentCongestion = recentAIAnalyses.length
    ? recentAIAnalyses[0].congestionScore
    : congestionSeries[Math.min(0, congestionSeries.length - 1)] ?? 0;

  const trendBias = {
    IMPROVING: -10,
    STABLE: 0,
    WORSENING: 10
  }[congestionTrend.congestionTrend] ?? 0;

  const predictedCongestionScore = clamp(Math.round((currentCongestion + trendBias + normalizedHorizon * 0.3) * 0.9), 0, 100);

  const predictedTrafficCondition = classifyTrafficCondition(predictedCongestionScore);

  const anomalySeries = recentAIAnalyses.length
    ? recentAIAnalyses.map((analysis) => analysis.anomalyScore)
    : recentTelemetry.slice(0, 5).map(() => 0);

  const anomalyTrend = calculateTrends({
    speedValues: recentTelemetry.map((entry) => Number(entry.speed ?? 0)),
    congestionValues: congestionSeries,
    anomalyValues: anomalySeries,
    etaValues: recentAIAnalyses.length ? recentAIAnalyses.map((analysis) => analysis.estimatedETAMinutes ?? 0) : recentTelemetry.map(() => 0)
  }).anomalyTrend;

  const anomalyScore = clamp(Math.round(average(anomalySeries) + (anomalyTrend === 'WORSENING' ? 12 : anomalyTrend === 'IMPROVING' ? -8 : 0)), 0, 100);

  const predictedRiskLevel = classifyRiskFromPrediction(predictedCongestionScore, anomalyScore, bus.status);

  const predictedETA = route?.distanceKm && route?.estimatedDurationMinutes
    ? Math.max(0, Math.round((route.distanceKm / Math.max(Number(latestTelemetry.speed) || 1, 1) * 60) + normalizedHorizon * 0.5))
    : null;

  const trendConsistency = clamp(
    1 -
      Math.abs((Number(recentTelemetry[0]?.speed ?? 0) - Number(recentTelemetry[recentTelemetry.length - 1]?.speed ?? 0)) /
        Math.max(Number(recentTelemetry[0]?.speed ?? 1), 1)),
    0,
    1
  );

  const confidenceScore = computePredictionConfidence(
    recentTelemetry.length,
    latestTelemetryAgeSeconds,
    trendConsistency,
    !!route,
    recentAIAnalyses.length > 0,
    Number(process.env.TELEMETRY_STALE_THRESHOLD_SECONDS ?? 60)
  );

  const reasons = buildReasons(
    congestionTrend.congestionTrend,
    congestionTrend.speedTrend,
    anomalyTrend,
    congestionTrend.etaTrend,
    initialCongestion,
    predictedCongestionScore,
    predictedETA
  );

  const predictionPayload: ForecastResult = {
    busId: bus._id.toString(),
    routeId: bus.routeId ? bus.routeId.toString() : null,
    generatedAt: new Date(),
    predictionHorizonMinutes: normalizedHorizon,
    predictedCongestionScore,
    predictedTrafficCondition,
    predictedRiskLevel,
    predictedETAMinutes: predictedETA,
    confidenceScore,
    trend: congestionTrend.congestionTrend,
    reasons,
    source: 'HEURISTIC_FORECAST',
    modelVersion: 'forecast-v1'
  };

  const savedPrediction = await AIPrediction.create({
    busId: new mongoose.Types.ObjectId(busId),
    routeId: bus.routeId ? new mongoose.Types.ObjectId(bus.routeId.toString()) : null,
    generatedAt: predictionPayload.generatedAt,
    predictionHorizonMinutes: predictionPayload.predictionHorizonMinutes,
    predictedCongestionScore: predictionPayload.predictedCongestionScore,
    predictedTrafficCondition: predictionPayload.predictedTrafficCondition,
    predictedRiskLevel: predictionPayload.predictedRiskLevel,
    predictedETAMinutes: predictionPayload.predictedETAMinutes,
    confidenceScore: predictionPayload.confidenceScore,
    trend: predictionPayload.trend,
    reasons: predictionPayload.reasons,
    source: predictionPayload.source,
    modelVersion: predictionPayload.modelVersion
  });

  const predictionPayloadWithMeta = {
    ...predictionPayload,
    _id: savedPrediction._id,
    createdAt: savedPrediction.createdAt,
    updatedAt: savedPrediction.updatedAt
  };

  emitAIUpdate({
    busId,
    routeId: predictionPayload.routeId,
    prediction: predictionPayloadWithMeta,
    analysis: predictionPayloadWithMeta
  });

  emitPredictionUpdate({
    busId,
    routeId: predictionPayload.routeId,
    prediction: predictionPayloadWithMeta
  });

  return {
    success: true,
    data: {
      ...predictionPayload,
      _id: savedPrediction._id,
      createdAt: savedPrediction.createdAt,
      updatedAt: savedPrediction.updatedAt
    }
  };
};
