# Urban Intelligence Backend

Phase 1 to Phase 5 backend foundation for the AI Powered Mobile Urban Intelligence Platform.

## Overview

This project provides a TypeScript + Express + MongoDB + Socket.IO backend with:

- Phase 1: application foundation, health checks, environment configuration, DB setup, and middleware
- Phase 2: authentication and authorization for ADMIN, AUTHORITY, OPERATOR, ANALYST, and DEVICE roles
- Phase 3: fleet and route management APIs
- Phase 4: real-time fleet telemetry ingestion, retrieval, offline detection, and simulator support
- Phase 5: explainable heuristic AI analysis for congestion, anomalies, risk, ETA, and confidence with persisted AIAnalysis records

## Features

- Express + TypeScript REST API
- MongoDB persistence with Mongoose
- JWT-based authentication and role-protected APIs
- Bus and route management endpoints
- Telemetry submission and history retrieval
- Socket.IO realtime bus and route subscriptions
- Bus offline detection based on stale telemetry
- Built-in bus simulator for live telemetry generation
- Phase 5 heuristic AI engine using real telemetry and route data only
- Explainable AI outputs with persisted analysis history and Socket.IO broadcasts
- Centralized logging, rate limiting, and error handling

## Project Structure

```text
urban-intelligence-backend/
├── src/
│   ├── config/
│   │   ├── db.ts
│   │   ├── env.ts
│   │   └── socket.ts
│   ├── controllers/
│   │   ├── ai.controller.ts
│   │   ├── auth.controller.ts
│   │   ├── bus.controller.ts
│   │   ├── route.controller.ts
│   │   └── telemetry.controller.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   └── rateLimiter.ts
│   ├── models/
│   │   ├── AIAnalysis.ts
│   │   ├── Bus.ts
│   │   ├── Route.ts
│   │   ├── Telemetry.ts
│   │   └── User.ts
│   ├── routes/
│   │   ├── ai.routes.ts
│   │   ├── auth.routes.ts
│   │   ├── bus.routes.ts
│   │   ├── route.routes.ts
│   │   └── telemetry.routes.ts
│   ├── services/
│   │   ├── ai/
│   │   │   ├── anomaly.service.ts
│   │   │   ├── confidence.service.ts
│   │   │   ├── congestion.service.ts
│   │   │   ├── eta.service.ts
│   │   │   └── risk.service.ts
│   │   ├── auth.service.ts
│   │   ├── bus.service.ts
│   │   ├── route.service.ts
│   │   ├── telemetry.service.ts
│   │   └── urbanAI.service.ts
│   ├── simulator/
│   │   ├── busSimulator.ts
│   │   └── routes.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── response.ts
│   ├── websocket/
│   │   └── telemetry.ts
│   ├── app.ts
│   └── server.ts
├── tests/
├── .env.example
├── .env (local, not in git)
├── package.json
├── tsconfig.json
├── README.md
└── package-lock.json
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local `.env` file from `.env.example`:

```bash
copy .env.example .env
```

3. Update the environment values for your local setup.

4. Start in development mode:

```bash
npm run dev
```

5. Build the project:

```bash
npm run build
```

6. Run the production build:

```bash
npm start
```

## Environment Variables

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/urban-intelligence
JWT_SECRET=your_jwt_secret_here
CORS_ORIGIN=http://localhost:3000
TELEMETRY_STALE_THRESHOLD_SECONDS=60
SIMULATOR_INTERVAL_MS=2000
TELEMETRY_RATE_LIMIT_PER_MINUTE=120
AI_ENGINE_MODE=heuristic
AI_AUTO_ANALYSIS_ENABLED=true
AI_ANALYSIS_COOLDOWN_SECONDS=30
```

## Authentication

The API supports the following roles:

- ADMIN
- AUTHORITY
- OPERATOR
- ANALYST
- DEVICE

Protected routes can be accessed using a JWT returned from `/api/auth/login`.

## Phase 5 AI Engine

The Phase 5 implementation adds an explainable heuristic AI layer that evaluates live bus telemetry against route metadata. It does not use a trained ML model; instead, it deterministically scores congestion, anomalies, risk, ETA, and confidence using real inputs already available in the platform.

### AI architecture

- `src/services/urbanAI.service.ts` orchestrates AI analysis and persistence
- `src/services/ai/congestion.service.ts` scores congestion and classifies traffic condition
- `src/services/ai/anomaly.service.ts` detects stale or suspicious telemetry patterns
- `src/services/ai/risk.service.ts` combines congestion, anomaly, and freshness into a risk level
- `src/services/ai/eta.service.ts` estimates ETA with defensive safeguards
- `src/services/ai/confidence.service.ts` calculates confidence from freshness and completeness
- `src/models/AIAnalysis.ts` stores the persisted AI result set
- `src/websocket/telemetry.ts` emits `ai:update` broadcasts for connected clients

### AI endpoints

```http
POST /api/ai/analyze/:busId
GET /api/ai/bus/:busId
GET /api/ai/bus/:busId/history
POST /api/ai/batch-analyze
```

Role access:

- `ADMIN`, `AUTHORITY`, and `ANALYST` can trigger analysis and batch analysis
- `ADMIN`, `AUTHORITY`, `ANALYST`, and `OPERATOR` can read AI results
- `DEVICE` does not receive direct AI analysis access

### AI response shape

```json
{
  "success": true,
  "data": {
    "busId": "...",
    "routeId": "...",
    "congestionScore": 69,
    "trafficCondition": "CONGESTED",
    "occupancyEstimate": null,
    "anomalyScore": 0,
    "riskLevel": "MEDIUM",
    "estimatedETAMinutes": 69,
    "confidenceScore": 90,
    "reasons": ["..."],
    "source": "HEURISTIC_BASELINE",
    "modelVersion": "baseline-v1"
  },
  "message": "AI analysis completed successfully"
}
```

### Phase 5 verification

The AI engine was verified live against a running MongoDB-backed server with real route and telemetry data. Observed outputs included:

- `POST /api/ai/analyze/:busId` returning persisted AI analysis documents
- `GET /api/ai/bus/:busId` returning the latest result
- `GET /api/ai/bus/:busId/history` returning bounded history with pagination
- `POST /api/ai/batch-analyze` returning per-bus success/error payloads
- Socket.IO broadcasts of `ai:update` for subscribed clients

## Core Endpoints

### Health

```http
GET /health
```

### Auth

```http
POST /api/auth/login
POST /api/auth/register
GET /api/auth/me
```

### Routes

```http
GET /api/routes
POST /api/routes
GET /api/routes/:id
PUT /api/routes/:id
DELETE /api/routes/:id
```

### Buses

```http
GET /api/buses
POST /api/buses
GET /api/buses/:id
PUT /api/buses/:id
DELETE /api/buses/:id
```

### Telemetry

```http
POST /api/telemetry
GET /api/telemetry/bus/:busId
GET /api/telemetry/bus/:busId/latest
```

#### Telemetry payload

```json
{
  "busId": "bus_object_id",
  "deviceId": "SIM-DEVICE-01",
  "routeId": "route_object_id",
  "location": {
    "latitude": 12.16,
    "longitude": 77.16
  },
  "speed": 22,
  "heading": 90,
  "status": "ACTIVE",
  "timestamp": "2026-09-11T04:23:01.248Z"
}
```

The telemetry service stores the incoming record, updates the parent bus with the latest location, speed, last seen time, and status, and broadcasts updates over Socket.IO.

## Socket.IO

### Events

- `bus:subscribe`
- `route:subscribe`
- `telemetry:update`
- `bus:location`
- `bus:status`
- `bus:offline`

### Example client usage

```javascript
socket.emit('bus:subscribe', 'bus_object_id');
socket.emit('route:subscribe', 'route_object_id');

socket.on('telemetry:update', (payload) => {
  console.log(payload);
});
```

## Simulator

The bus simulator can generate periodic telemetry for existing buses and routes.

### Run the simulator

```bash
SIMULATOR_TOKEN=<device_or_admin_jwt> npm run simulator
```

You can also pass positional arguments:

```bash
npm run simulator -- 1 2000 http://localhost:5000 <jwt_token>
```

Arguments are interpreted as:

1. `busCount`
2. `intervalMs`
3. `apiBaseUrl`
4. `token`

## Verification

The backend was verified with live requests against a running MongoDB-backed server:

- `GET /health` returned 200 with MongoDB and Socket.IO status reported as connected/running
- `POST /api/auth/login` returned a valid JWT
- Route and bus creation APIs worked successfully
- `POST /api/telemetry` stored a telemetry record and updated the bus snapshot
- `GET /api/telemetry/bus/:busId/latest` returned the latest record
- `GET /api/telemetry/bus/:busId` returned telemetry history
- Phase 5 AI endpoints produced persisted heuristic analysis results and history records
- `npm run test:ai` passed with 8/8 deterministic checks succeeding

## Notes

- MongoDB must be running locally or reachable through a valid Atlas URI.
- The simulator expects a valid JWT token. A device role token is ideal for real-world simulator usage.
- Telemetry is rate limited via `TELEMETRY_RATE_LIMIT_PER_MINUTE` and stale bus detection is controlled by `TELEMETRY_STALE_THRESHOLD_SECONDS`.
