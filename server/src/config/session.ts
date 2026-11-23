import type { SessionOptions } from 'express-session';

const isProd = process.env.NODE_ENV === 'production';

export const sessionOptions: Omit<SessionOptions, 'store'> = {
  secret: process.env.SESSION_SECRET ?? 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'hm.sid', // custom name avoids default "connect.sid" fingerprinting
  cookie: {
    httpOnly: true,
    secure: isProd,          // HTTPS only in production
    sameSite: 'lax',
    maxAge: parseInt(process.env.SESSION_TTL_HOURS ?? '8') * 60 * 60 * 1000,
  },
  rolling: true, // reset TTL on activity
};

if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error(
    'SESSION_SECRET must be at least 32 characters in production. ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}
