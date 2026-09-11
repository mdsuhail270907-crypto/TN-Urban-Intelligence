import Alert from '../../models/Alert';
import AIAnalysis from '../../models/AIAnalysis';
import Bus from '../../models/Bus';
import Route from '../../models/Route';

export interface UrbanSummary {
  totalBuses: number;
  activeBuses: number;
  offlineBuses: number;
  congestedBuses: number;
  highRiskBuses: number;
  criticalAlerts: number;
  averageCongestionScore: number;
  averageSpeed: number;
  averageETAMinutes: number;
  overallTrend: 'IMPROVING' | 'STABLE' | 'WORSENING';
}

const average = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const determineTrend = (scores: number[]): 'IMPROVING' | 'STABLE' | 'WORSENING' => {
  if (scores.length < 2) {
    return 'STABLE';
  }

  const recentAverage = average(scores.slice(-2));
  const previousAverage = average(scores.slice(0, Math.max(1, scores.length - 2)));
  const delta = recentAverage - previousAverage;

  if (delta > 5) {
    return 'WORSENING';
  }

  if (delta < -5) {
    return 'IMPROVING';
  }

  return 'STABLE';
};

export const buildUrbanIntelligenceSummary = async (): Promise<UrbanSummary> => {
  const [buses, alerts, analyses] = await Promise.all([
    Bus.find({ isActive: true }).lean(),
    Alert.find({ status: 'ACTIVE', severity: 'CRITICAL' }).lean(),
    AIAnalysis.find({}).sort({ timestamp: -1 }).limit(100).lean()
  ]);

  const activeBuses = buses.filter((bus) => bus.status === 'ACTIVE').length;
  const offlineBuses = buses.filter((bus) => bus.status === 'OFFLINE').length;

  const latestByBus = new Map<string, typeof analyses[number]>();
  for (const analysis of analyses) {
    const busId = analysis.busId.toString();
    if (!latestByBus.has(busId)) {
      latestByBus.set(busId, analysis);
    }
  }

  const latestAnalyses = Array.from(latestByBus.values());
  const congestedBuses = latestAnalyses.filter((analysis) => analysis.congestionScore >= 50).length;
  const highRiskBuses = latestAnalyses.filter((analysis) => ['HIGH', 'CRITICAL'].includes(analysis.riskLevel)).length;

  const averageCongestionScore = average(latestAnalyses.map((analysis) => Number(analysis.congestionScore ?? 0)));
  const averageSpeed = average(buses.map((bus) => Number(bus.currentSpeed ?? 0)).filter((speed) => Number.isFinite(speed)));
  const averageETAMinutes = average(latestAnalyses.map((analysis) => Number(analysis.estimatedETAMinutes ?? 0)));

  return {
    totalBuses: buses.length,
    activeBuses,
    offlineBuses,
    congestedBuses,
    highRiskBuses,
    criticalAlerts: alerts.length,
    averageCongestionScore,
    averageSpeed,
    averageETAMinutes,
    overallTrend: determineTrend(latestAnalyses.map((analysis) => Number(analysis.congestionScore ?? 0)))
  };
};
