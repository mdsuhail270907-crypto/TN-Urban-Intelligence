export type UserRole = 'ADMIN' | 'AUTHORITY' | 'OPERATOR' | 'ANALYST' | 'DEVICE';

export type BusStatus = 'ACTIVE' | 'IDLE' | 'OFFLINE' | 'MAINTENANCE' | 'EMERGENCY';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface Location {
  latitude: number;
  longitude: number;
  timestamp?: string;
}

export interface Bus {
  _id: string;
  busNumber: string;
  registrationNumber: string;
  vehicleType: string;
  operatorName: string;
  routeId?: string | null;
  status: BusStatus;
  capacity?: number | null;
  currentLocation?: Location | null;
  currentSpeed?: number | null;
  lastSeenAt?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RouteStop {
  name: string;
  latitude: number;
  longitude: number;
  sequence: number;
}

export interface RoutePathPoint {
  latitude: number;
  longitude: number;
}

export interface Route {
  _id: string;
  routeNumber: string;
  routeName: string;
  description?: string;
  stops: RouteStop[];
  path?: RoutePathPoint[];
  distanceKm?: number | null;
  estimatedDurationMinutes?: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Telemetry {
  _id: string;
  busId: string;
  deviceId: string;
  routeId?: string | null;
  location: {
    latitude: number;
    longitude: number;
  };
  speed: number;
  heading: number;
  status: BusStatus;
  timestamp: string;
  accuracy?: number | null;
  altitude?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AIAnalysis {
  _id: string;
  busId: string;
  routeId?: string | null;
  timestamp: string;
  congestionScore: number;
  trafficCondition: 'FREE_FLOW' | 'MODERATE' | 'CONGESTED' | 'SEVERE';
  occupancyEstimate: number | null;
  anomalyScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedETAMinutes: number | null;
  confidenceScore: number;
  reasons: string[];
  source: 'HEURISTIC_BASELINE' | 'ML_MODEL';
  modelVersion: string;
  inputTelemetryTimestamp: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface AlertItem {
  id: string;
  busId?: string;
  title: string;
  message: string;
  level: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  timestamp: string;
}

export interface DashboardMetrics {
  totalFleet: number;
  active: number;
  idle: number;
  offline: number;
  maintenance: number;
  emergency: number;
  congested: number;
  highRisk: number;
  activeAlerts: number;
}
