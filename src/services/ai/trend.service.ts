import { AIAnalysisRiskLevel } from '../../models/AIAnalysis';

export type TrendDirection = 'IMPROVING' | 'STABLE' | 'WORSENING';

export interface TrendResult {
  speedTrend: TrendDirection;
  congestionTrend: TrendDirection;
  anomalyTrend: TrendDirection;
  etaTrend: TrendDirection;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const average = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const classifyTrend = (delta: number): TrendDirection => {
  if (delta > 6) {
    return 'WORSENING';
  }

  if (delta < -6) {
    return 'IMPROVING';
  }

  return 'STABLE';
};

const deriveDirectionFromSeries = (values: number[]): TrendDirection => {
  if (values.length < 2) {
    return 'STABLE';
  }

  const recentAverage = average(values.slice(-3));
  const olderAverage = average(values.slice(0, Math.max(1, values.length - 3)));

  const delta = recentAverage - olderAverage;

  return classifyTrend(delta);
};

export const calculateTrends = (input: {
  speedValues: number[];
  congestionValues: number[];
  anomalyValues: number[];
  etaValues: number[];
}): TrendResult => {
  const speedValues = input.speedValues.filter((value) => Number.isFinite(value) && value >= 0);
  const congestionValues = input.congestionValues.filter((value) => Number.isFinite(value) && value >= 0);
  const anomalyValues = input.anomalyValues.filter((value) => Number.isFinite(value) && value >= 0);
  const etaValues = input.etaValues.filter((value) => Number.isFinite(value) && value >= 0);

  return {
    speedTrend: deriveDirectionFromSeries(speedValues),
    congestionTrend: deriveDirectionFromSeries(congestionValues),
    anomalyTrend: deriveDirectionFromSeries(anomalyValues),
    etaTrend: deriveDirectionFromSeries(etaValues)
  };
};
