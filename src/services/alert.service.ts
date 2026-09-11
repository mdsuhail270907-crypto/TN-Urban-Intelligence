import mongoose from 'mongoose';
import Alert, { ALERT_SEVERITIES, ALERT_STATUSES, ALERT_TYPES, AlertSeverity, AlertStatus, AlertType } from '../models/Alert';
import AIAnalysis from '../models/AIAnalysis';
import AIPrediction from '../models/AIPrediction';
import Bus from '../models/Bus';
import Telemetry from '../models/Telemetry';
import { emitAlertEvent, emitAlertUpdated, emitUrbanInsight } from '../websocket/telemetry';
import { buildUrbanIntelligenceSummary } from './ai/urbanIntelligence.service';

export interface AlertEvaluationInput {
  busId: string;
}

const normalizeSeverity = (type: AlertType, congestionScore: number, riskLevel: string): AlertSeverity => {
  if (type === 'EMERGENCY') {
    return 'CRITICAL';
  }

  if (type === 'RISK' && riskLevel === 'CRITICAL') {
    return 'CRITICAL';
  }

  if (type === 'CONGESTION' && congestionScore >= 75) {
    return 'HIGH';
  }

  if (type === 'ANOMALY') {
    return congestionScore >= 50 ? 'HIGH' : 'WARNING';
  }

  return 'INFO';
};

const buildAlertTitle = (type: AlertType, busNumber: string) => {
  switch (type) {
    case 'CONGESTION':
      return `${busNumber} severe congestion detected`;
    case 'ANOMALY':
      return `${busNumber} telemetry anomaly detected`;
    case 'RISK':
      return `${busNumber} risk level elevated`;
    case 'OFFLINE':
      return `${busNumber} went offline`;
    case 'ETA':
      return `${busNumber} ETA may be affected`;
    case 'PREDICTION':
      return `${busNumber} forecast indicates deterioration`;
    case 'EMERGENCY':
      return `${busNumber} emergency status reported`;
    default:
      return `${busNumber} incident detected`;
  }
};

const buildAlertMessage = (type: AlertType, busNumber: string, data: Record<string, any>): string => {
  if (type === 'CONGESTION') {
    return `${busNumber} congestion score reached ${data.congestionScore}/100.`;
  }

  if (type === 'RISK') {
    return `${busNumber} is now at ${data.riskLevel} risk due to current conditions.`;
  }

  if (type === 'ANOMALY') {
    return `${busNumber} anomaly score reached ${data.anomalyScore}/100 and should be reviewed.`;
  }

  if (type === 'OFFLINE') {
    return `${busNumber} has been marked offline due to stale telemetry.`;
  }

  if (type === 'PREDICTION') {
    return `${busNumber} forecast predicts congestion rising to ${data.predictedCongestionScore}/100 within ${data.predictionHorizonMinutes} minutes.`;
  }

  if (type === 'EMERGENCY') {
    return `${busNumber} status is EMERGENCY and requires immediate attention.`;
  }

  return `${busNumber} operational conditions may require monitoring.`;
};

const getAlertMetadata = (type: AlertType, bus: any, analysis: any, prediction: any) => ({
  busId: bus?._id?.toString(),
  routeId: bus?.routeId?.toString?.() ?? null,
  congestionScore: analysis?.congestionScore,
  anomalyScore: analysis?.anomalyScore,
  riskLevel: analysis?.riskLevel,
  predictedCongestionScore: prediction?.predictedCongestionScore,
  predictionHorizonMinutes: prediction?.predictionHorizonMinutes,
  source: analysis?.source || prediction?.source || 'SYSTEM'
});

export const evaluateAlertConditions = async (busId: string): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(busId)) {
    throw new Error('Invalid busId');
  }

  const [bus, latestTelemetry, latestAnalysis, latestPrediction] = await Promise.all([
    Bus.findById(busId).lean(),
    Telemetry.findOne({ busId: new mongoose.Types.ObjectId(busId) }).sort({ timestamp: -1 }).lean(),
    AIAnalysis.findOne({ busId: new mongoose.Types.ObjectId(busId) }).sort({ timestamp: -1 }).lean(),
    AIPrediction.findOne({ busId: new mongoose.Types.ObjectId(busId) }).sort({ generatedAt: -1 }).lean()
  ]);

  if (!bus) {
    throw new Error('Bus not found');
  }

  const alerts: any[] = [];

  if (latestAnalysis && latestAnalysis.congestionScore >= 75) {
    alerts.push({
      type: 'CONGESTION',
      severity: 'HIGH',
      title: buildAlertTitle('CONGESTION', bus.busNumber),
      message: buildAlertMessage('CONGESTION', bus.busNumber, { congestionScore: latestAnalysis.congestionScore }),
      source: 'AI',
      status: 'ACTIVE',
      triggeredAt: new Date(),
      metadata: getAlertMetadata('CONGESTION', bus, latestAnalysis, latestPrediction)
    });
  }

  if (latestAnalysis && latestAnalysis.riskLevel === 'HIGH') {
    alerts.push({
      type: 'RISK',
      severity: 'HIGH',
      title: buildAlertTitle('RISK', bus.busNumber),
      message: buildAlertMessage('RISK', bus.busNumber, { riskLevel: latestAnalysis.riskLevel }),
      source: 'AI',
      status: 'ACTIVE',
      triggeredAt: new Date(),
      metadata: getAlertMetadata('RISK', bus, latestAnalysis, latestPrediction)
    });
  }

  if (latestAnalysis && latestAnalysis.riskLevel === 'CRITICAL') {
    alerts.push({
      type: 'RISK',
      severity: 'CRITICAL',
      title: buildAlertTitle('RISK', bus.busNumber),
      message: buildAlertMessage('RISK', bus.busNumber, { riskLevel: latestAnalysis.riskLevel }),
      source: 'AI',
      status: 'ACTIVE',
      triggeredAt: new Date(),
      metadata: getAlertMetadata('RISK', bus, latestAnalysis, latestPrediction)
    });
  }

  if (latestAnalysis && latestAnalysis.anomalyScore >= 50) {
    alerts.push({
      type: 'ANOMALY',
      severity: latestAnalysis.anomalyScore >= 75 ? 'HIGH' : 'WARNING',
      title: buildAlertTitle('ANOMALY', bus.busNumber),
      message: buildAlertMessage('ANOMALY', bus.busNumber, { anomalyScore: latestAnalysis.anomalyScore }),
      source: 'AI',
      status: 'ACTIVE',
      triggeredAt: new Date(),
      metadata: getAlertMetadata('ANOMALY', bus, latestAnalysis, latestPrediction)
    });
  }

  if (latestPrediction && latestPrediction.predictedCongestionScore >= 75) {
    alerts.push({
      type: 'PREDICTION',
      severity: 'HIGH',
      title: buildAlertTitle('PREDICTION', bus.busNumber),
      message: buildAlertMessage('PREDICTION', bus.busNumber, {
        predictedCongestionScore: latestPrediction.predictedCongestionScore,
        predictionHorizonMinutes: latestPrediction.predictionHorizonMinutes
      }),
      source: 'AI',
      status: 'ACTIVE',
      triggeredAt: new Date(),
      metadata: getAlertMetadata('PREDICTION', bus, latestAnalysis, latestPrediction)
    });
  }

  if (latestTelemetry && Date.now() - new Date(latestTelemetry.timestamp).getTime() > (Number(process.env.TELEMETRY_STALE_THRESHOLD_SECONDS ?? 60) * 1000)) {
    alerts.push({
      type: 'OFFLINE',
      severity: 'WARNING',
      title: buildAlertTitle('OFFLINE', bus.busNumber),
      message: buildAlertMessage('OFFLINE', bus.busNumber, {}),
      source: 'TELEMETRY',
      status: 'ACTIVE',
      triggeredAt: new Date(),
      metadata: getAlertMetadata('OFFLINE', bus, latestAnalysis, latestPrediction)
    });
  }

  if (bus.status === 'EMERGENCY') {
    alerts.push({
      type: 'EMERGENCY',
      severity: 'CRITICAL',
      title: buildAlertTitle('EMERGENCY', bus.busNumber),
      message: buildAlertMessage('EMERGENCY', bus.busNumber, {}),
      source: 'SYSTEM',
      status: 'ACTIVE',
      triggeredAt: new Date(),
      metadata: getAlertMetadata('EMERGENCY', bus, latestAnalysis, latestPrediction)
    });
  }

  const createdAlerts: any[] = [];

  for (const alertPayload of alerts) {
    const existingAlert = await Alert.findOne({
      busId: bus._id,
      type: alertPayload.type,
      status: 'ACTIVE'
    }).sort({ triggeredAt: -1 }).lean();

    if (existingAlert) {
      continue;
    }

    const createdAlert = await Alert.create({
      busId: bus._id,
      routeId: bus.routeId ?? null,
      type: alertPayload.type,
      severity: alertPayload.severity,
      title: alertPayload.title,
      message: alertPayload.message,
      source: alertPayload.source,
      triggeredAt: alertPayload.triggeredAt,
      status: 'ACTIVE',
      metadata: alertPayload.metadata
    });

    createdAlerts.push({
      ...createdAlert.toObject(),
      busId: createdAlert.busId ? createdAlert.busId.toString() : null,
      routeId: createdAlert.routeId ? createdAlert.routeId.toString() : null
    });

    emitAlertEvent({
      alert: {
        ...createdAlert.toObject(),
        busId: createdAlert.busId ? createdAlert.busId.toString() : null,
        routeId: createdAlert.routeId ? createdAlert.routeId.toString() : null
      },
      busId: bus._id.toString(),
      routeId: bus.routeId ? bus.routeId.toString() : null
    });
  }

  const summary = await buildUrbanIntelligenceSummary();
  emitUrbanInsight({ summary });

  return {
    success: true,
    data: {
      alerts: createdAlerts,
      summary
    }
  };
};

export const acknowledgeAlert = async (alertId: string, userId: string): Promise<any> => {
  const alert = await Alert.findById(alertId);

  if (!alert) {
    throw new Error('Alert not found');
  }

  if (alert.status === 'RESOLVED') {
    throw new Error('Alert already resolved');
  }

  alert.status = 'ACKNOWLEDGED';
  alert.acknowledgedAt = new Date();
  alert.acknowledgedBy = new mongoose.Types.ObjectId(userId) as any;

  await alert.save();

  emitAlertUpdated({
    alert: alert.toObject(),
    busId: alert.busId ? alert.busId.toString() : null,
    routeId: alert.routeId ? alert.routeId.toString() : null
  });

  return {
    success: true,
    data: alert.toObject()
  };
};

export const resolveAlert = async (alertId: string, userId: string): Promise<any> => {
  const alert = await Alert.findById(alertId);

  if (!alert) {
    throw new Error('Alert not found');
  }

  if (alert.status === 'RESOLVED') {
    throw new Error('Alert already resolved');
  }

  alert.status = 'RESOLVED';
  alert.resolvedAt = new Date();
  alert.resolvedBy = new mongoose.Types.ObjectId(userId) as any;

  await alert.save();

  emitAlertUpdated({
    alert: alert.toObject(),
    busId: alert.busId ? alert.busId.toString() : null,
    routeId: alert.routeId ? alert.routeId.toString() : null
  });

  return {
    success: true,
    data: alert.toObject()
  };
};
