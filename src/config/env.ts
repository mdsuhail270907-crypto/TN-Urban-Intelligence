import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;

  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const env = {
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  PORT: Number(getEnv('PORT', '5000')),
  MONGODB_URI: getEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017/urban-intelligence'),
  JWT_SECRET: getEnv('JWT_SECRET', 'development_secret'),
  JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', '7d'),
  CORS_ORIGIN: getEnv('CORS_ORIGIN', 'http://localhost:3000'),
  TELEMETRY_STALE_THRESHOLD_SECONDS: Number(getEnv('TELEMETRY_STALE_THRESHOLD_SECONDS', '60')),
  SIMULATOR_INTERVAL_MS: Number(getEnv('SIMULATOR_INTERVAL_MS', '2000')),
  TELEMETRY_RATE_LIMIT_PER_MINUTE: Number(getEnv('TELEMETRY_RATE_LIMIT_PER_MINUTE', '120')),
  AI_ENGINE_MODE: getEnv('AI_ENGINE_MODE', 'heuristic'),
  AI_AUTO_ANALYSIS_ENABLED: getEnv('AI_AUTO_ANALYSIS_ENABLED', 'false') === 'true',
  AI_ANALYSIS_COOLDOWN_SECONDS: Number(getEnv('AI_ANALYSIS_COOLDOWN_SECONDS', '60'))
};
