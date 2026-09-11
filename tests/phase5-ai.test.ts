import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCongestion, classifyTrafficCondition } from '../src/services/ai/congestion.service';
import { detectAnomalies } from '../src/services/ai/anomaly.service';
import { assessRisk } from '../src/services/ai/risk.service';
import { estimateETA } from '../src/services/ai/eta.service';
import { calculateConfidence } from '../src/services/ai/confidence.service';

test('congestion classification returns FREE_FLOW for low congestion', () => {
  const result = evaluateCongestion({
    currentSpeed: 45,
    recentSpeeds: [50, 48, 46, 45],
    route: {
      distanceKm: 20,
      estimatedDurationMinutes: 30
    }
  });

  assert.equal(result.trafficCondition, 'FREE_FLOW');
  assert.ok(result.congestionScore >= 0 && result.congestionScore <= 100);
});

test('congestion classification returns CONGESTED for moderate slowdown', () => {
  const result = evaluateCongestion({
    currentSpeed: 22,
    recentSpeeds: [30, 28, 24, 22],
    route: {
      distanceKm: 20,
      estimatedDurationMinutes: 30
    }
  });

  assert.equal(result.trafficCondition, 'CONGESTED');
});

test('congestion classification returns SEVERE for significant slowdown', () => {
  const result = evaluateCongestion({
    currentSpeed: 12,
    recentSpeeds: [24, 20, 18, 12],
    route: {
      distanceKm: 20,
      estimatedDurationMinutes: 30
    }
  });

  assert.equal(result.trafficCondition, 'SEVERE');
});

test('anomaly detection flags stale telemetry', () => {
  const result = detectAnomalies({
    currentTelemetry: {
      speed: 10,
      heading: 20,
      timestamp: new Date(Date.now() - 120000).toISOString(),
      location: { latitude: 12.2, longitude: 77.2 },
      status: 'ACTIVE'
    },
    recentTelemetry: [
      {
        speed: 10,
        heading: 20,
        timestamp: new Date(Date.now() - 121000).toISOString(),
        location: { latitude: 12.2, longitude: 77.2 },
        status: 'ACTIVE'
      }
    ],
    staleThresholdSeconds: 60
  });

  assert.ok(result.anomalyScore >= 0);
  assert.ok(result.reasons.some((reason) => reason.includes('stale')));
});

test('risk assessment returns CRITICAL for severe congestion plus notable anomaly pressure', () => {
  const result = assessRisk({
    congestionScore: 80,
    anomalyScore: 60,
    busStatus: 'ACTIVE',
    latestTelemetryAgeSeconds: 30,
    staleThresholdSeconds: 60
  });

  assert.equal(result.riskLevel, 'CRITICAL');
});

test('eta estimation returns null when route data is missing', () => {
  const result = estimateETA({
    currentSpeed: 20,
    route: null
  });

  assert.equal(result.estimatedETAMinutes, null);
});

test('confidence calculation returns deterministic values', () => {
  const result = calculateConfidence({
    latestTelemetryAgeSeconds: 20,
    recentTelemetryCount: 5,
    routeAvailable: true,
    speedConsistencyScore: 0.8,
    dataCompletenessScore: 0.9,
    staleThresholdSeconds: 60
  });

  assert.ok(result.confidenceScore >= 0 && result.confidenceScore <= 100);
  assert.ok(result.reasons.length > 0);
});

test('classifyTrafficCondition returns severe at the top of the range', () => {
  assert.equal(classifyTrafficCondition(100), 'SEVERE');
});
