export interface ETAInput {
  currentSpeed: number;
  route?: {
    distanceKm?: number;
    path?: Array<{ latitude: number; longitude: number }>;
    estimatedDurationMinutes?: number;
  } | null;
}

export interface ETAResult {
  estimatedETAMinutes: number | null;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const calculatePolylineDistanceKm = (path?: Array<{ latitude: number; longitude: number }>): number | null => {
  if (!path || path.length < 2) {
    return null;
  }

  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;

  let distanceKm = 0;

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];

    const dLat = toRadians(current.latitude - previous.latitude);
    const dLng = toRadians(current.longitude - previous.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(previous.latitude)) *
        Math.cos(toRadians(current.latitude)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    distanceKm += earthRadiusKm * c;
  }

  return distanceKm;
};

export const estimateETA = (input: ETAInput): ETAResult => {
  const reasons: string[] = [];

  const currentSpeed = Number(input.currentSpeed);

  if (!Number.isFinite(currentSpeed) || currentSpeed <= 0) {
    return {
      estimatedETAMinutes: null,
      reasons: ['ETA could not be estimated because the latest telemetry speed was missing or zero.']
    };
  }

  const routeDistanceKm =
    input.route?.distanceKm && Number.isFinite(input.route.distanceKm) && input.route.distanceKm > 0
      ? Number(input.route.distanceKm)
      : calculatePolylineDistanceKm(input.route?.path);

  if (!routeDistanceKm || routeDistanceKm <= 0) {
    return {
      estimatedETAMinutes: null,
      reasons: ['ETA could not be estimated because route distance or path information was unavailable.']
    };
  }

  const estimatedETAMinutes = clamp((routeDistanceKm / currentSpeed) * 60, 0, Number.MAX_SAFE_INTEGER);

  reasons.push('ETA was estimated from the route distance and the bus current speed.');

  if (input.route?.estimatedDurationMinutes) {
    reasons.push('The route estimated duration was preserved as a contextual reference but the ETA remained speed-based.');
  }

  return {
    estimatedETAMinutes: Number.isFinite(estimatedETAMinutes) ? Math.round(estimatedETAMinutes) : null,
    reasons: Array.from(new Set(reasons))
  };
};
