import { AIAnalysisRiskLevel } from '../../models/AIAnalysis';

export interface RiskInput {
  congestionScore: number;
  anomalyScore: number;
  busStatus?: string | null;
  latestTelemetryAgeSeconds?: number;
  staleThresholdSeconds?: number;
}

export interface RiskResult {
  riskLevel: AIAnalysisRiskLevel;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const assessRisk = (input: RiskInput): RiskResult => {
  const reasons: string[] = [];

  if (input.busStatus === 'EMERGENCY') {
    return {
      riskLevel: 'CRITICAL',
      reasons: ['Bus is marked as EMERGENCY, which elevates the operational risk to critical.']
    };
  }

  let riskIndex = 0;

  if (input.congestionScore >= 75) {
    riskIndex += 2;
    reasons.push('Severe congestion raises the operational risk significantly.');
  } else if (input.congestionScore >= 50) {
    riskIndex += 1;
    reasons.push('Moderate to heavy congestion is contributing to risk.');
  } else {
    reasons.push('Traffic conditions are currently stable enough to keep the risk level low.');
  }

  if (input.anomalyScore >= 75) {
    riskIndex += 2;
    reasons.push('Critical telemetry anomalies indicate a high risk of inaccurate fleet state.');
  } else if (input.anomalyScore >= 50) {
    riskIndex += 1;
    reasons.push('The telemetry stream shows notable anomalies that require attention.');
  } else if (input.anomalyScore >= 25) {
    riskIndex += 1;
    reasons.push('Minor telemetry anomalies are present and should be monitored.');
  }

  if (input.latestTelemetryAgeSeconds !== undefined && input.staleThresholdSeconds) {
    const staleThreshold = input.staleThresholdSeconds;

    if (input.latestTelemetryAgeSeconds > staleThreshold * 1.5) {
      riskIndex = clamp(riskIndex + 1, 0, 3);
      reasons.push('Telemetry freshness is poor, further increasing operational risk.');
    } else if (input.latestTelemetryAgeSeconds > staleThreshold) {
      riskIndex = clamp(riskIndex + 1, 0, 3);
      reasons.push('Telemetry is approaching the stale threshold, so the risk rating has been adjusted upward.');
    }
  }

  const riskLevel: AIAnalysisRiskLevel =
    riskIndex >= 3 ? 'CRITICAL' : riskIndex === 2 ? 'HIGH' : riskIndex === 1 ? 'MEDIUM' : 'LOW';

  return {
    riskLevel,
    reasons: Array.from(new Set(reasons))
  };
};
