import { AIAnalysisRiskLevel } from '../../models/AIAnalysis';

export interface DecisionSupportResult {
  action: 'MONITOR' | 'INVESTIGATE' | 'PRIORITIZE' | 'ESCALATE';
  recommendation: string;
  reasons: string[];
  confidenceScore: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const buildDecisionSupport = (input: {
  predictedRiskLevel?: AIAnalysisRiskLevel | null;
  predictedCongestionScore?: number;
  congestionTrend?: 'IMPROVING' | 'STABLE' | 'WORSENING';
  anomalyScore?: number;
  predictedETAMinutes?: number | null;
  confidenceScore?: number;
}): DecisionSupportResult => {
  const predictedRiskLevel = input.predictedRiskLevel ?? 'LOW';
  const predictedCongestionScore = input.predictedCongestionScore ?? 0;
  const anomalyScore = input.anomalyScore ?? 0;
  const predictedETAMinutes = input.predictedETAMinutes ?? null;

  const reasons: string[] = [];

  if (predictedRiskLevel === 'CRITICAL') {
    reasons.push('Predicted critical risk has been reached.');
  } else if (predictedRiskLevel === 'HIGH') {
    reasons.push('Predicted risk is elevated and may require intervention.');
  } else if (predictedRiskLevel === 'MEDIUM') {
    reasons.push('Predicted risk is moderate and should be actively monitored.');
  } else {
    reasons.push('Current conditions suggest a low-risk operational state.');
  }

  if (predictedCongestionScore >= 75) {
    reasons.push('Predicted congestion exceeds the severe threshold.');
  } else if (predictedCongestionScore >= 50) {
    reasons.push('Predicted congestion is likely to remain elevated.');
  }

  if (input.congestionTrend === 'WORSENING') {
    reasons.push('Congestion trend is worsening and likely to delay operations.');
  } else if (input.congestionTrend === 'IMPROVING') {
    reasons.push('Congestion trend is improving, suggesting recovery.');
  }

  if (anomalyScore >= 50) {
    reasons.push('Telemetry anomalies are elevated, which may reduce confidence in the current conditions.');
  }

  if (predictedETAMinutes !== null) {
    reasons.push(`Predicted ETA is approximately ${predictedETAMinutes} minutes.`);
  }

  let action: DecisionSupportResult['action'] = 'MONITOR';
  let recommendation = 'Continue monitoring the bus and watch for changes in congestion and telemetry quality.';

  if (predictedRiskLevel === 'CRITICAL') {
    action = 'ESCALATE';
    recommendation = 'Escalate this incident to the urban authority and prioritize intervention planning.';
  } else if (predictedRiskLevel === 'HIGH') {
    action = 'PRIORITIZE';
    recommendation = 'Prioritize this route for traffic intervention and increase monitoring frequency.';
  } else if (predictedRiskLevel === 'MEDIUM') {
    action = 'INVESTIGATE';
    recommendation = 'Monitor congestion trend closely and prepare for possible operational delays.';
  }

  const confidenceScore = clamp(Math.round(input.confidenceScore ?? 50), 0, 100);

  return {
    action,
    recommendation,
    reasons: Array.from(new Set(reasons)),
    confidenceScore
  };
};
