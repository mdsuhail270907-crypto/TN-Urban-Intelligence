import Bus from '../../models/Bus';
import AIAnalysis from '../../models/AIAnalysis';
import Alert from '../../models/Alert';
import Telemetry from '../../models/Telemetry';
import Route from '../../models/Route';

export interface RouteIntelligenceSummary {
  routeId: string;
  activeBusCount: number;
  averageSpeed: number;
  averageCongestionScore: number;
  maxCongestionScore: number;
  highRiskBusCount: number;
  criticalAlertCount: number;
  averageETAMinutes: number;
  congestionTrend: 'IMPROVING' | 'STABLE' | 'WORSENING';
}

const average = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const determineTrend = (values: number[]): 'IMPROVING' | 'STABLE' | 'WORSENING' => {
  if (values.length < 2) {
    return 'STABLE';
  }

  const recentAverage = average(values.slice(-2));
  const previousAverage = average(values.slice(0, Math.max(1, values.length - 2)));
  const delta = recentAverage - previousAverage;

  if (delta > 5) {
    return 'WORSENING';
  }

  if (delta < -5) {
    return 'IMPROVING';
  }

  return 'STABLE';
};

export const buildRouteIntelligence = async (routeId: string): Promise<RouteIntelligenceSummary | null> => {
  const route = await Route.findById(routeId).lean();

  if (!route) {
    return null;
  }

  const buses = await Bus.find({ routeId, isActive: true }).lean();

  if (!buses.length) {
    return null;
  }

  const busIds = buses.map((bus) => bus._id.toString());
  const [latestAnalyses, alerts, telemetry] = await Promise.all([
    AIAnalysis.find({ busId: { $in: busIds } }).sort({ timestamp: -1 }).lean(),
    Alert.find({ routeId, status: 'ACTIVE' }).lean(),
    Telemetry.find({ routeId }).sort({ timestamp: -1 }).limit(50).lean()
  ]);

  const activeBusCount = buses.filter((bus) => bus.status === 'ACTIVE').length;

  const speeds = buses
    .map((bus) => Number(bus.currentSpeed ?? 0))
    .filter((speed) => Number.isFinite(speed));

  const analysesByBus = new Map<string, any[]>();
  for (const analysis of latestAnalyses) {
    const busId = analysis.busId.toString();
    if (!analysesByBus.has(busId)) {
      analysesByBus.set(busId, []);
    }

    analysesByBus.get(busId)?.push(analysis);
  }

  const latestByBus = Array.from(analysesByBus.values()).map((items) => items[0]).filter(Boolean);
  const congestionScores = latestByBus.map((analysis) => Number(analysis.congestionScore ?? 0));
  const etaScores = latestByBus.map((analysis) => Number(analysis.estimatedETAMinutes ?? 0));
  const congestionTrendValues = latestByBus.map((analysis) => Number(analysis.congestionScore ?? 0));

  return {
    routeId,
    activeBusCount,
    averageSpeed: average(speeds),
    averageCongestionScore: average(congestionScores),
    maxCongestionScore: Math.max(...congestionScores, 0),
    highRiskBusCount: latestByBus.filter((analysis) => ['HIGH', 'CRITICAL'].includes(analysis.riskLevel)).length,
    criticalAlertCount: alerts.filter((alert) => alert.severity === 'CRITICAL').length,
    averageETAMinutes: average(etaScores),
    congestionTrend: determineTrend(congestionTrendValues)
  };
};
