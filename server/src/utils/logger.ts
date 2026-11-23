import winston from 'winston';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const isProd = process.env.NODE_ENV === 'production';

/**
 * Redacts sensitive fields from log metadata before writing.
 * Prevents credentials, tokens, and password hashes leaking into logs.
 */
const redactSensitive = winston.format((info) => {
  const redactKeys = [
    'password', 'passwordHash', 'token', 'accessToken', 'secret',
    'sessionToken', 'cookie', 'authorization', 'x-csrf-token',
  ];

  function redact(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lk = key.toLowerCase();
      if (redactKeys.some((r) => lk.includes(r))) {
        result[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = redact(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  if (info.metadata && typeof info.metadata === 'object') {
    info.metadata = redact(info.metadata as Record<string, unknown>);
  }

  return info;
})();

export const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: combine(
    redactSensitive,
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    isProd ? json() : combine(colorize(), simple())
  ),
  transports: [
    new winston.transports.Console(),
    ...(isProd
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 10,
          }),
        ]
      : []),
  ],
});
