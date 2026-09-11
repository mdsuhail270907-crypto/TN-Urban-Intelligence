export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteStop {
  name: string;
  latitude: number;
  longitude: number;
  sequence: number;
}

export const buildRoutePoints = (route: any): RoutePoint[] => {
  if (!route) {
    return [];
  }

  if (Array.isArray(route.path) && route.path.length >= 2) {
    return route.path.map((point: any) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude)
    }));
  }

  const stops: RouteStop[] = Array.isArray(route.stops)
    ? [...route.stops].sort((a, b) => Number(a.sequence) - Number(b.sequence))
    : [];

  return stops.map((stop) => ({
    latitude: Number(stop.latitude),
    longitude: Number(stop.longitude)
  }));
};

export const interpolatePoint = (start: RoutePoint, end: RoutePoint, progress: number): RoutePoint => ({
  latitude: start.latitude + (end.latitude - start.latitude) * progress,
  longitude: start.longitude + (end.longitude - start.longitude) * progress
});

export const calculateDistanceKm = (pointA: RoutePoint, pointB: RoutePoint): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(pointB.latitude - pointA.latitude);
  const dLon = toRad(pointB.longitude - pointA.longitude);

  const lat1 = toRad(pointA.latitude);
  const lat2 = toRad(pointB.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

export const calculateHeading = (start: RoutePoint, end: RoutePoint): number => {
  const angle = Math.atan2(end.longitude - start.longitude, end.latitude - start.latitude);
  const degrees = (angle * 180) / Math.PI;
  const normalized = (degrees + 360) % 360;
  return normalized;
};
