export interface ConfidenceInput {
  latestTelemetryAgeSeconds: number;
  recentTelemetryCount: number;
  routeAvailable: boolean;
  speedConsistencyScore: number;
  dataCompletenessScore: number;
  staleThresholdSeconds: number;
}

export interface ConfidenceResult {
  confidenceScore: number;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const calculateConfidence = (input: ConfidenceInput): ConfidenceResult => {
  let confidenceScore = 20;
  const reasons: string[] = [];

  if (input.latestTelemetryAgeSeconds <= input.staleThresholdSeconds) {
    confidenceScore += 35;
    reasons.push('Telemetry freshness is high, which increases confidence in the AI output.');
  } else {
    confidenceScore -= 20;
    reasons.push('Telemetry is older than the freshness threshold, which reduces confidence materially.');
  }

  if (input.recentTelemetryCount >= 5) {
    confidenceScore += 20;
    reasons.push('The analysis is backed by multiple recent telemetry samples.');
  } else if (input.recentTelemetryCount >= 2) {
    confidenceScore += 10;
    reasons.push('Only a small recent telemetry window is available, so confidence is moderate.');
  } else {
    reasons.push('Very limited recent telemetry is available, which lowers the confidence score.');
  }

  if (input.routeAvailable) {
    confidenceScore += 15;
    reasons.push('Route metadata is available, improving situational completeness.');
  } else {
    reasons.push('Route metadata is unavailable, so confidence is reduced.');
  }

  confidenceScore += Math.round(input.dataCompletenessScore * 0.15);
  confidenceScore += Math.round(input.speedConsistencyScore * 0.15);

  if (input.dataCompletenessScore < 0.5) {
    reasons.push('Some core telemetry fields are incomplete, which limits confidence.');
  }

  if (input.speedConsistencyScore < 0.4) {
    reasons.push('Observed speeds were inconsistent, which reduces confidence in the trend estimate.');
  }

  confidenceScore = clamp(Math.round(confidenceScore), 0, 100);

  return {
    confidenceScore,
    reasons: Array.from(new Set(reasons))
  };
};
