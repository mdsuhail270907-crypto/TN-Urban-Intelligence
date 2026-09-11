interface TelemetrySample {
  speed: number;
  heading: number;
  status?: string | null;
  timestamp: string | Date;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface AnomalyInput {
  currentTelemetry: TelemetrySample;
  recentTelemetry: TelemetrySample[];
  staleThresholdSeconds: number;
}

export interface AnomalyResult {
  anomalyScore: number;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const toDate = (value: string | Date): Date => (value instanceof Date ? value : new Date(value));

const haversineDistanceKm = (
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
): number => {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

  const earthRadiusKm = 6371;
  const dLat = toRadians(second.latitude - first.latitude);
  const dLng = toRadians(second.longitude - first.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(first.latitude)) *
      Math.cos(toRadians(second.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

const normalizeHeadingDelta = (currentHeading: number, previousHeading: number): number => {
  let diff = Math.abs(currentHeading - previousHeading);

  if (diff > 180) {
    diff = 360 - diff;
  }

  return diff;
};

export const detectAnomalies = (input: AnomalyInput): AnomalyResult => {
  const reasons: string[] = [];
  let score = 0;

  const currentTelemetry = input.currentTelemetry;
  const recentTelemetry = [...input.recentTelemetry].sort(
    (a, b) => toDate(a.timestamp).getTime() - toDate(b.timestamp).getTime()
  );

  if (!Number.isFinite(currentTelemetry.speed) || currentTelemetry.speed < 0) {
    score += 40;
    reasons.push('Telemetry contains an invalid speed value.');
  }

  if (currentTelemetry.speed > 120) {
    score += 40;
    reasons.push('Current speed is above a realistic threshold for road-bounded transit operations.');
  }

  if (currentTelemetry.status && ['OFFLINE', 'MAINTENANCE'].includes(currentTelemetry.status) && currentTelemetry.speed > 5) {
    score += 35;
    reasons.push('Bus is marked offline or under maintenance while still reporting movement.');
  }

  const latestTimestamp = toDate(currentTelemetry.timestamp);
  const staleSeconds = (Date.now() - latestTimestamp.getTime()) / 1000;

  if (staleSeconds > input.staleThresholdSeconds) {
    score += 30;
    reasons.push(`Telemetry is stale by ${Math.round(staleSeconds)} seconds, exceeding the configured freshness threshold.`);
  }

  const previousTelemetry = recentTelemetry[recentTelemetry.length - 1];

  if (previousTelemetry) {
    const previousSpeed = Number(previousTelemetry.speed);
    const speedDelta = currentTelemetry.speed - previousSpeed;

    if (speedDelta > 25) {
      score += 20;
      reasons.push('A sudden speed increase was detected between consecutive telemetry samples.');
    }

    if (speedDelta < -20) {
      score += 25;
      reasons.push('A sudden speed decrease was detected between consecutive telemetry samples.');
    }

    const currentLocation = currentTelemetry.location;
    const previousLocation = previousTelemetry.location;

    if (currentLocation && previousLocation) {
      const locationJumpKm = haversineDistanceKm(currentLocation, previousLocation);
      const previousAgeSeconds = Math.max(
        1,
        (latestTimestamp.getTime() - toDate(previousTelemetry.timestamp).getTime()) / 1000
      );

      if (locationJumpKm > 1.5 && previousAgeSeconds < 180) {
        score += 25;
        reasons.push('A large location jump was detected between consecutive telemetry samples in a short window.');
      }
    }

    const headingDelta = normalizeHeadingDelta(currentTelemetry.heading, previousTelemetry.heading ?? currentTelemetry.heading);

    if (headingDelta > 70 && currentTelemetry.speed > 10) {
      score += 20;
      reasons.push('A sharp heading change was detected while the bus was still moving.');
    }
  }

  const timestampSequence = recentTelemetry
    .map((entry) => toDate(entry.timestamp).getTime())
    .sort((a, b) => a - b);

  for (let index = 1; index < timestampSequence.length; index += 1) {
    const gapMs = timestampSequence[index] - timestampSequence[index - 1];

    if (gapMs > 10 * 60 * 1000) {
      score += 10;
      reasons.push('Telemetry timestamps show an irregular gap that may indicate missing or delayed samples.');
      break;
    }
  }

  const anomalyScore = clamp(Math.round(score), 0, 100);

  return {
    anomalyScore,
    reasons: reasons.length ? Array.from(new Set(reasons)) : ['No significant anomalies were detected in the current telemetry stream.']
  };
};
