import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BusFront,
  Clock3,
  Gauge,
  MapPinned,
  RefreshCcw,
  ShieldAlert,
  Wifi,
  WifiOff
} from 'lucide-react';
import { aiApi } from '../services/api';
import { connectSocket } from '../services/socket';
import { useDashboardData } from '../hooks/useDashboardData';
import type { AIAnalysis, AlertItem, Bus, BusStatus, Telemetry, User } from '../types';

const formatTimeAgo = (timestamp?: string | null): string => {
  if (!timestamp) return 'No telemetry';

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
};

const getRiskTone = (level?: string) => {
  const normalized = (level || '').toUpperCase();

  if (normalized === 'CRITICAL') return 'critical';
  if (normalized === 'HIGH') return 'high';
  if (normalized === 'MEDIUM') return 'medium';
  return 'low';
};

const scoreTone = (score: number) => {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
};

const getStatusColor = (status: BusStatus) => {
  switch (status) {
    case 'ACTIVE':
      return 'accent';
    case 'IDLE':
      return 'medium';
    case 'OFFLINE':
      return 'critical';
    case 'MAINTENANCE':
      return 'warning';
    case 'EMERGENCY':
      return 'critical';
    default:
      return 'low';
  }
};

const CommandCenterDashboard = ({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) => {
  const { buses, routes, telemetryByBus, aiByBus, loading, error, refresh } = useDashboardData();
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const socket = connectSocket(token);

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on('telemetry:update', () => {
      setLastUpdated(new Date());
      void refresh();
    });
    socket.on('bus:location', () => {
      setLastUpdated(new Date());
      void refresh();
    });
    socket.on('bus:status', () => {
      setLastUpdated(new Date());
      void refresh();
    });
    socket.on('bus:offline', () => {
      setLastUpdated(new Date());
      void refresh();
    });
    socket.on('ai:update', () => {
      setLastUpdated(new Date());
      void refresh();
    });
    socket.on('ai:prediction', () => {
      setLastUpdated(new Date());
      void refresh();
    });
    socket.on('alert:new', () => {
      setLastUpdated(new Date());
      void refresh();
    });
    socket.on('alert:updated', () => {
      setLastUpdated(new Date());
      void refresh();
    });
    socket.on('urban:insight', () => {
      setLastUpdated(new Date());
      void refresh();
    });

    return () => {
      socket.disconnect();
    };
  }, [refresh, token]);

  const selectedBus = useMemo(
    () => buses.find((bus) => bus._id === selectedBusId) || buses[0] || null,
    [buses, selectedBusId]
  );

  const selectedTelemetry = selectedBus ? telemetryByBus[selectedBus._id] : null;
  const selectedAi = selectedBus ? aiByBus[selectedBus._id] : null;

  useEffect(() => {
    if (!selectedBus && buses.length) {
      setSelectedBusId(buses[0]._id);
    }
  }, [buses, selectedBus]);

  useEffect(() => {
    if (!buses.length) return;

    const nextAlerts: AlertItem[] = [];

    buses.forEach((bus) => {
      const ai = aiByBus[bus._id];
      const telemetry = telemetryByBus[bus._id];

      if (bus.status === 'OFFLINE' || bus.status === 'EMERGENCY') {
        nextAlerts.push({
          id: `status-${bus._id}`,
          busId: bus._id,
          title: `${bus.busNumber} ${bus.status}`,
          message: bus.status === 'OFFLINE' ? 'Telemetry freshness threshold exceeded.' : 'Emergency status reported by bus.',
          level: bus.status === 'EMERGENCY' ? 'CRITICAL' : 'HIGH',
          timestamp: bus.lastSeenAt || new Date().toISOString()
        });
      }

      if (ai && (ai.riskLevel === 'HIGH' || ai.riskLevel === 'CRITICAL')) {
        nextAlerts.push({
          id: `ai-${bus._id}`,
          busId: bus._id,
          title: `${bus.busNumber} AI risk escalation`,
          message: `${ai.riskLevel} risk detected with congestion ${ai.congestionScore}/100.`,
          level: ai.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          timestamp: ai.timestamp
        });
      }

      if (telemetry && Date.now() - new Date(telemetry.timestamp).getTime() > 120000) {
        nextAlerts.push({
          id: `stale-${bus._id}`,
          busId: bus._id,
          title: `${bus.busNumber} stale telemetry`,
          message: 'Latest telemetry exceeded the freshness threshold.',
          level: 'WARNING',
          timestamp: telemetry.timestamp
        });
      }
    });

    setAlerts(nextAlerts.slice(0, 8));
  }, [buses, aiByBus, telemetryByBus]);

  useEffect(() => {
    const refreshClock = setInterval(() => setLastUpdated(new Date()), 2000);
    return () => clearInterval(refreshClock);
  }, []);

  const summary = useMemo(() => {
    const metrics = {
      totalFleet: buses.length,
      active: buses.filter((bus) => bus.status === 'ACTIVE').length,
      idle: buses.filter((bus) => bus.status === 'IDLE').length,
      offline: buses.filter((bus) => bus.status === 'OFFLINE').length,
      maintenance: buses.filter((bus) => bus.status === 'MAINTENANCE').length,
      emergency: buses.filter((bus) => bus.status === 'EMERGENCY').length,
      congested: buses.filter((bus) => aiByBus[bus._id]?.trafficCondition === 'CONGESTED' || aiByBus[bus._id]?.trafficCondition === 'SEVERE').length,
      highRisk: buses.filter((bus) => ['HIGH', 'CRITICAL'].includes(aiByBus[bus._id]?.riskLevel || '')).length,
      activeAlerts: alerts.filter((alert) => alert.level !== 'INFO').length
    };

    return metrics;
  }, [buses, aiByBus, alerts]);

  const aiSummary = useMemo(() => {
    const analyses = Object.values(aiByBus).filter(Boolean) as AIAnalysis[];

    if (!analyses.length) {
      return {
        congestion: 0,
        traffic: 'N/A',
        risk: 'N/A',
        anomalies: 0,
        eta: 0,
        confidence: 0
      };
    }

    const averageCongestion = Math.round(
      analyses.reduce((sum, analysis) => sum + analysis.congestionScore, 0) / analyses.length
    );

    const averageConfidence = Math.round(
      analyses.reduce((sum, analysis) => sum + analysis.confidenceScore, 0) / analyses.length
    );

    const averageEta = Math.round(
      analyses.reduce((sum, analysis) => sum + (analysis.estimatedETAMinutes ?? 0), 0) / analyses.length
    );

    return {
      congestion: averageCongestion,
      traffic: analyses[0].trafficCondition,
      risk: analyses[0].riskLevel,
      anomalies: analyses.filter((analysis) => analysis.anomalyScore > 0).length,
      eta: averageEta,
      confidence: averageConfidence
    };
  }, [aiByBus]);

  const handleAnalyzeSelected = async () => {
    if (!selectedBus) return;

    try {
      await aiApi.analyze(selectedBus._id);
      await refresh();
      setLastUpdated(new Date());
    } catch {
      // ignore for now
    }
  };

  const routeMap = useMemo(() => {
    return new Map(routes.map((route) => [route._id, route]));
  }, [routes]);

  return (
    <div className="command-center-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Urban Command Center</p>
          <h1>Live Fleet Operations</h1>
        </div>

        <div className="topbar-actions">
          <div className="user-pill">
            <span>{user.name}</span>
            <small>{user.role}</small>
          </div>
          <div className={`connection-pill ${socketConnected ? 'connected' : 'disconnected'}`}>
            {socketConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {socketConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </div>
          <div className="last-update">
            <Clock3 size={14} />
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button className="ghost-button" onClick={() => void refresh()}>
            <RefreshCcw size={14} />
            Refresh
          </button>
          <button className="ghost-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="metric-grid">
        <DashboardCard icon={<BusFront size={18} />} label="TOTAL FLEET" value={summary.totalFleet} />
        <DashboardCard icon={<Activity size={18} />} label="ACTIVE" value={summary.active} tone="accent" />
        <DashboardCard icon={<Gauge size={18} />} label="IDLE" value={summary.idle} tone="medium" />
        <DashboardCard icon={<WifiOff size={18} />} label="OFFLINE" value={summary.offline} tone="critical" />
        <DashboardCard icon={<ShieldAlert size={18} />} label="MAINTENANCE" value={summary.maintenance} tone="warning" />
        <DashboardCard icon={<AlertTriangle size={18} />} label="EMERGENCY" value={summary.emergency} tone="critical" />
      </section>

      <main className="main-grid">
        <aside className="panel fleet-panel">
          <div className="panel-header">
            <div>
              <p className="panel-label">Fleet Summary</p>
              <h2>Operations</h2>
            </div>
          </div>

          {loading ? (
            <div className="state-box">Loading fleet...</div>
          ) : error ? (
            <div className="state-box error">Unable to load fleet: {error}</div>
          ) : (
            <div className="fleet-list">
              {buses.map((bus) => {
                const ai = aiByBus[bus._id];
                const telemetry = telemetryByBus[bus._id];

                return (
                  <button
                    key={bus._id}
                    className={`fleet-item ${selectedBus?._id === bus._id ? 'selected' : ''}`}
                    onClick={() => setSelectedBusId(bus._id)}
                  >
                    <div className="fleet-item-header">
                      <div>
                        <strong>{bus.busNumber}</strong>
                        <span>{bus.registrationNumber}</span>
                      </div>
                      <span className={`status-badge ${getStatusColor(bus.status)}`}>{bus.status}</span>
                    </div>

                    <div className="fleet-meta">
                      <span>{routeMap.get(bus.routeId || '')?.routeNumber || 'Unassigned'}</span>
                      <span>{bus.currentSpeed ?? 0} km/h</span>
                    </div>

                    <div className="fleet-meta small">
                      <span>{ai ? `Traffic: ${ai.trafficCondition}` : 'No AI'}</span>
                      <span>{ai ? `${ai.congestionScore}/100` : 'N/A'}</span>
                    </div>

                    <div className="fleet-meta small">
                      <span>Telemetry</span>
                      <span>{formatTimeAgo(telemetry?.timestamp)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="panel map-panel">
          <div className="panel-header">
            <div>
              <p className="panel-label">Live Map</p>
              <h2>Fleet Movement</h2>
            </div>
            <div className="panel-actions">
              <button className="primary-button" onClick={handleAnalyzeSelected}>Analyze Selected</button>
            </div>
          </div>

          <div className="map-box">
            <MapPanel buses={buses} telemetryByBus={telemetryByBus} selectedBusId={selectedBusId} onSelectBus={setSelectedBusId} />
          </div>
        </section>

        <aside className="panel ai-panel">
          <div className="panel-header">
            <div>
              <p className="panel-label">AI Insights</p>
              <h2>Urban AI</h2>
            </div>
          </div>

          <div className="insight-stack">
            <InsightCard title="CONGESTION" value={`${aiSummary.congestion}/100`} tone={scoreTone(aiSummary.congestion)} />
            <InsightCard title="TRAFFIC" value={aiSummary.traffic} tone={scoreTone(aiSummary.congestion)} />
            <InsightCard title="RISK" value={aiSummary.risk} tone={getRiskTone(aiSummary.risk)} />
            <InsightCard title="ANOMALIES" value={`${aiSummary.anomalies}`} tone="warning" />
            <InsightCard title="AVG ETA" value={`${aiSummary.eta} min`} tone="medium" />
            <InsightCard title="CONFIDENCE" value={`${aiSummary.confidence}%`} tone={scoreTone(aiSummary.confidence)} />
          </div>
        </aside>
      </main>

      <section className="panel alerts-panel">
        <div className="panel-header">
          <div>
            <p className="panel-label">Live Events</p>
            <h2>Alert Center</h2>
          </div>
        </div>

        <div className="alerts-list">
          {alerts.length ? (
            alerts.map((alert) => (
              <div key={alert.id} className={`alert-item ${alert.level.toLowerCase()}`}>
                <div className="alert-time">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                <div className="alert-content">
                  <strong>{alert.title}</strong>
                  <span>{alert.message}</span>
                </div>
                <span className={`alert-level ${alert.level.toLowerCase()}`}>{alert.level}</span>
              </div>
            ))
          ) : (
            <div className="state-box">No live alerts.</div>
          )}
        </div>
      </section>

      <section className="panel analytics-panel">
        <div className="panel-header">
          <div>
            <p className="panel-label">Analytics</p>
            <h2>Operational Insights</h2>
          </div>
        </div>

        <div className="analytics-grid">
          <AnalyticsStat label="Fleet utilization" value={`${Math.round((summary.active / Math.max(summary.totalFleet, 1)) * 100)}%`} />
          <AnalyticsStat label="Active vs inactive" value={`${summary.active}/${summary.totalFleet}`} />
          <AnalyticsStat label="Traffic conditions" value={`${summary.congested} congested`} />
          <AnalyticsStat label="Risk distribution" value={`${summary.highRisk} high risk`} />
          <AnalyticsStat label="Average speed" value={`${Math.round(buses.reduce((sum, bus) => sum + (bus.currentSpeed || 0), 0) / Math.max(summary.totalFleet, 1))} km/h`} />
          <AnalyticsStat label="Average congestion" value={`${aiSummary.congestion}/100`} />
          <AnalyticsStat label="Average ETA" value={`${aiSummary.eta} min`} />
          <AnalyticsStat label="AI confidence" value={`${aiSummary.confidence}%`} />
        </div>
      </section>

      <section className="panel details-panel">
        <div className="panel-header">
          <div>
            <p className="panel-label">Selected Bus</p>
            <h2>{selectedBus ? selectedBus.busNumber : 'No bus selected'}</h2>
          </div>
        </div>

        {selectedBus && selectedTelemetry && selectedAi ? (
          <div className="selected-bus-grid">
            <div className="detail-field">
              <span>Status</span>
              <strong>{selectedBus.status}</strong>
            </div>
            <div className="detail-field">
              <span>Route</span>
              <strong>{routeMap.get(selectedBus.routeId || '')?.routeNumber || 'Unassigned'}</strong>
            </div>
            <div className="detail-field">
              <span>Speed</span>
              <strong>{selectedBus.currentSpeed ?? 0} km/h</strong>
            </div>
            <div className="detail-field">
              <span>Telemetry</span>
              <strong>{formatTimeAgo(selectedTelemetry.timestamp)}</strong>
            </div>
            <div className="detail-field">
              <span>Location</span>
              <strong>{selectedBus.currentLocation ? `${selectedBus.currentLocation.latitude.toFixed(3)}, ${selectedBus.currentLocation.longitude.toFixed(3)}` : 'Unavailable'}</strong>
            </div>
            <div className="detail-field">
              <span>AI Congestion</span>
              <strong>{selectedAi.congestionScore}/100</strong>
            </div>
            <div className="detail-field">
              <span>Traffic</span>
              <strong>{selectedAi.trafficCondition}</strong>
            </div>
            <div className="detail-field">
              <span>Risk</span>
              <strong>{selectedAi.riskLevel}</strong>
            </div>
            <div className="detail-field">
              <span>Anomaly</span>
              <strong>{selectedAi.anomalyScore}/100</strong>
            </div>
            <div className="detail-field">
              <span>ETA</span>
              <strong>{selectedAi.estimatedETAMinutes ?? 'N/A'} min</strong>
            </div>
            <div className="detail-field">
              <span>Confidence</span>
              <strong>{selectedAi.confidenceScore}%</strong>
            </div>
            <div className="detail-field full-span">
              <span>Reasons</span>
              <ul>
                {selectedAi.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="state-box">Waiting for bus telemetry and AI data...</div>
        )}
      </section>
    </div>
  );
};

const DashboardCard = ({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number | string; tone?: string }) => (
  <div className={`metric-card ${tone || ''}`}>
    <div className="metric-icon">{icon}</div>
    <div className="metric-content">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  </div>
);

const InsightCard = ({ title, value, tone }: { title: string; value: string; tone: string }) => (
  <div className={`insight-card ${tone}`}>
    <span>{title}</span>
    <strong>{value}</strong>
  </div>
);

const AnalyticsStat = ({ label, value }: { label: string; value: string }) => (
  <div className="analytic-box">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const MapPanel = ({
  buses,
  telemetryByBus,
  selectedBusId,
  onSelectBus
}: {
  buses: Bus[];
  telemetryByBus: Record<string, Telemetry>;
  selectedBusId: string | null;
  onSelectBus: (id: string) => void;
}) => {
  return (
    <div className="map-shell">
      <div className="map-overlay-grid">
        {buses.map((bus) => {
          const telemetry = telemetryByBus[bus._id];
          const position = telemetry?.location || bus.currentLocation;
          const isSelected = selectedBusId === bus._id;

          if (!position) return null;

          return (
            <button
              key={bus._id}
              className={`map-bus-marker ${isSelected ? 'selected' : ''}`}
              style={{ left: `${((position.longitude + 180) / 360) * 100}%`, top: `${((90 - position.latitude) / 180) * 100}%` }}
              onClick={() => onSelectBus(bus._id)}
            >
              <MapPinned size={18} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CommandCenterDashboard;
