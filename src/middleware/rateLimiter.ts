import rateLimit from 'express-rate-limit';

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.GENERAL_RATE_LIMIT_MAX ?? 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    }
  }
});

export const telemetryRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.TELEMETRY_RATE_LIMIT_PER_MINUTE ?? 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Telemetry rate limit exceeded. Please slow down and retry later.'
    }
  }
});
