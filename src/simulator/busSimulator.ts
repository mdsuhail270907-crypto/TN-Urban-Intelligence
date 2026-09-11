import { exec } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import { env } from '../config/env';
import logger from '../utils/logger';
import { buildRoutePoints, calculateDistanceKm, calculateHeading, interpolatePoint } from './routes';

interface SimulatorConfig {
  busCount: number;
  intervalMs: number;
  routeIds?: string[];
  apiBaseUrl: string;
  token: string;
}

interface BusAssignment {
  busId: string;
  busNumber: string;
  routeId: string;
  route: any;
  currentIndex: number;
}

const fetchJson = async (url: string, token?: string, body?: any): Promise<any> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
};

const verifyBackendReachable = async (apiBaseUrl: string): Promise<void> => {
  try {
    const response = await fetch(`${apiBaseUrl}/health`);

    if (!response.ok) {
      throw new Error(`Backend health endpoint returned ${response.status}`);
    }
  } catch (error) {
    throw new Error(`Backend unreachable at ${apiBaseUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const runSimulator = async (config: SimulatorConfig): Promise<void> => {
  const apiBaseUrl = config.apiBaseUrl || 'http://localhost:5000';
  const intervalMs = config.intervalMs || env.SIMULATOR_INTERVAL_MS || 2000;

  await verifyBackendReachable(apiBaseUrl);

  const busesResponse = await fetchJson(`${apiBaseUrl}/api/buses?limit=100`, config.token);
  const routesResponse = await fetchJson(`${apiBaseUrl}/api/routes?limit=100`, config.token);

  const buses = Array.isArray(busesResponse?.data?.buses) ? busesResponse.data.buses : [];
  const routes = Array.isArray(routesResponse?.data?.routes) ? routesResponse.data.routes : [];

  if (!buses.length) {
    throw new Error('No buses found. Create at least one bus before starting the simulator.');
  }

  if (!routes.length) {
    throw new Error('No routes found. Create at least one route before starting the simulator.');
  }

  const selectedBuses = buses.slice(0, Math.max(1, Number(config.busCount || buses.length)));

  const assignments: BusAssignment[] = selectedBuses.map((bus: any) => {
    const routeId = bus.routeId || (Array.isArray(config.routeIds) && config.routeIds.length ? config.routeIds[0] : routes[0]._id);
    const route = routes.find((item: any) => item._id === routeId) || routes[0];

    if (!route) {
      throw new Error(`Bus ${bus.busNumber} has no valid route assignment`);
    }

    return {
      busId: bus._id,
      busNumber: bus.busNumber,
      routeId: route._id,
      route,
      currentIndex: 0
    };
  });

  logger.info(`Simulator started for ${assignments.length} buses`);

  while (true) {
    for (const assignment of assignments) {
      const points = buildRoutePoints(assignment.route);
      if (points.length < 2) {
        continue;
      }

      const start = points[assignment.currentIndex % (points.length - 1)];
      const end = points[(assignment.currentIndex % (points.length - 1)) + 1] || points[0];
      const progress = 0.25;
      const nextPoint = interpolatePoint(start, end, progress);
      const distanceKm = calculateDistanceKm(start, end);
      const heading = calculateHeading(start, end);
      const speed = Math.max(5, Math.min(50, distanceKm * 60));

      const payload = {
        busId: assignment.busId,
        deviceId: `SIM-${assignment.busNumber}`,
        routeId: assignment.routeId,
        location: {
          latitude: nextPoint.latitude,
          longitude: nextPoint.longitude
        },
        speed,
        heading,
        status: 'ACTIVE',
        timestamp: new Date().toISOString()
      };

      try {
        await fetchJson(`${apiBaseUrl}/api/telemetry`, config.token, payload);
        logger.info(`Simulator posted telemetry for ${assignment.busNumber}`);
      } catch (error) {
        logger.error(`Simulator failed for ${assignment.busNumber}: ${error instanceof Error ? error.message : String(error)}`);
      }

      assignment.currentIndex = (assignment.currentIndex + 1) % (points.length - 1);
    }

    await delay(intervalMs);
  }
};

export const startSimulatorCli = async (): Promise<void> => {
  const cliArgs = process.argv.slice(2);
  const busCount = Number(cliArgs[0] || 1);
  const intervalMs = Number(cliArgs[1] || env.SIMULATOR_INTERVAL_MS || 2000);
  const apiBaseUrl = cliArgs[2] || 'http://localhost:5000';
  const token = cliArgs[3] || process.env.SIMULATOR_TOKEN || '';

  if (!token) {
    throw new Error('SIMULATOR_TOKEN or CLI token is required. Generate a device user and pass a valid JWT token.');
  }

  await runSimulator({
    busCount,
    intervalMs,
    apiBaseUrl,
    token
  });
};

startSimulatorCli().catch((error) => {
  logger.error(`Simulator failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
