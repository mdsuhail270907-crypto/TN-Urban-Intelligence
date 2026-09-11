import { AIAnalysisTrafficCondition } from '../../models/AIAnalysis';

export interface CongestionInput {
  currentSpeed: number;
  recentSpeeds: number[];
  route?: {
    distanceKm?: number;
    estimatedDurationMinutes?: number;
  } | null;
}

export interface CongestionResult {
  congestionScore: number;
  trafficCondition: AIAnalysisTrafficCondition;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const average = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const classifyTrafficCondition = (congestionScore: number): AIAnalysisTrafficCondition => {
  if (congestionScore < 25) {
    return 'FREE_FLOW';
  }

  if (congestionScore < 50) {
    return 'MODERATE';
  }

  if (congestionScore < 75) {
    return 'CONGESTED';
  }

  return 'SEVERE';
};

export const evaluateCongestion = (input: CongestionInput): CongestionResult => {
  const validRecentSpeeds = input.recentSpeeds
    .filter((value) => Number.isFinite(value) && value >= 0)
    .map((value) => Number(value));

  const currentSpeed = Number(input.currentSpeed);
  const routeExpectedSpeed = input.route?.distanceKm && input.route?.estimatedDurationMinutes
    ? (input.route.distanceKm / (input.route.estimatedDurationMinutes / 60))
    : null;

  const historicalAverage = validRecentSpeeds.length ? average(validRecentSpeeds) : 0;
  const baselineSpeed = routeExpectedSpeed ?? (historicalAverage || 20);

  const reasons: string[] = [];

  if (routeExpectedSpeed) {
    reasons.push('Current speed was compared against the expected route speed derived from route distance and duration.');
  } else if (historicalAverage > 0) {
    reasons.push('Current speed was compared against the historical average speed because route timing data was unavailable.');
  } else {
    reasons.push('Route speed information was unavailable, so a conservative baseline assumption was used for congestion scoring.');
  }

  let score = 0;

  if (currentSpeed > 0) {
    const speedDelta = baselineSpeed - currentSpeed;
    const relativeDelay = clamp((speedDelta / Math.max(baselineSpeed, 1)) * 100, 0, 100);
    score += Math.round(relativeDelay);

    if (currentSpeed >= baselineSpeed) {
      reasons.push('Current speed is at or above the expected baseline, indicating uncongested flow.');
    } else if (currentSpeed < baselineSpeed * 0.75) {
      reasons.push('Current speed is significantly below the expected route speed, indicating congestion pressure.');
    }
  } else {
    reasons.push('Current speed is zero, which is consistent with severe congestion or a stopped bus.');
    score = 90;
  }

  if (historicalAverage > 0 && currentSpeed > 0) {
    const recentAverageGap = clamp(((historicalAverage - currentSpeed) / Math.max(historicalAverage, 1)) * 40, 0, 40);
    score += Math.round(recentAverageGap);

    if (currentSpeed < historicalAverage * 0.8) {
      reasons.push('Current speed is also below the recent average, suggesting an accelerating congestion trend.');
    }
  }

  if (currentSpeed >= 0 && currentSpeed <= 5) {
    reasons.push('The bus is moving very slowly, which strongly indicates severe congestion or a stoppage.');
  }

  const congestionScore = clamp(Math.round(score), 0, 100);

  return {
    congestionScore,
    trafficCondition: classifyTrafficCondition(congestionScore),
    reasons: Array.from(new Set(reasons))
  };
};
