import { useCallback, useEffect, useMemo, useState } from 'react';
import { aiApi, busesApi, routesApi } from '../services/api';
import type { AIAnalysis, Bus, Route, Telemetry } from '../types';

export interface DashboardState {
  buses: Bus[];
  routes: Route[];
  telemetryByBus: Record<string, Telemetry>;
  aiByBus: Record<string, AIAnalysis>;
  loading: boolean;
  error: string | null;
}

export const useDashboardData = () => {
  const [state, setState] = useState<DashboardState>({
    buses: [],
    routes: [],
    telemetryByBus: {},
    aiByBus: {},
    loading: true,
    error: null
  });

  const load = useCallback(async () => {
    try {
      setState((current) => ({ ...current, loading: true, error: null }));

      const [busesRes, routesRes] = await Promise.all([busesApi.list(), routesApi.list()]);
      const buses = busesRes.data.buses;
      const routes = routesRes.data.routes;

      const latestTelemetryMap = {} as Record<string, Telemetry>;
      const latestAiMap = {} as Record<string, AIAnalysis>;

      await Promise.all(
        buses.map(async (bus) => {
          try {
            const telemetryRes = await busesApi.latestTelemetry(bus._id);
            latestTelemetryMap[bus._id] = telemetryRes.data;
          } catch {
            latestTelemetryMap[bus._id] = null as any;
          }

          try {
            const aiRes = await aiApi.latest(bus._id);
            latestAiMap[bus._id] = aiRes.data;
          } catch {
            latestAiMap[bus._id] = null as any;
          }
        })
      );

      setState({
        buses,
        routes,
        telemetryByBus: latestTelemetryMap,
        aiByBus: latestAiMap,
        loading: false,
        error: null
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load dashboard data'
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({
      ...state,
      refresh: load
    }),
    [state, load]
  );
};
