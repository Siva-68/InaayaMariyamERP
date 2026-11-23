import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { isReplicaSetCapable } from '../config/db';

/**
 * GET /api/health
 * Returns server and database status.
 * Does not require authentication.
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  const dbState = mongoose.connection.readyState;
  const dbStateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbStatus = dbStateMap[dbState] ?? 'unknown';
  const replicaSet = isReplicaSetCapable();

  const data = {
    status: dbState === 1 ? 'ok' : 'degraded',
    db: dbStatus,
    replicaSet,
    replicaSetNote: replicaSet
      ? 'Transactions available (Phase 3+ billing supported)'
      : 'Standalone MongoDB — transactions unavailable. Billing will be blocked until a replica set is configured.',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: '0.1.0',
  };

  const statusCode = dbState === 1 ? 200 : 503;
  res.status(statusCode).json({ success: dbState === 1, data });
}
