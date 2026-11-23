import mongoose from 'mongoose';
import { logger } from '../utils/logger';

const REQUIRED_ENV = 'MONGODB_URI';

/**
 * Connect to MongoDB. Requires a replica-set capable URI for transaction support.
 * Phase 3+ (billing) will fail if the connection is not on a replica set.
 */
export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      `Missing environment variable: ${REQUIRED_ENV}\n` +
        'Set MONGODB_URI in server/.env pointing to a replica-set capable MongoDB deployment.\n' +
        'Example: mongodb://127.0.0.1:27017/hinaya_mariyam_erp?replicaSet=rs0\n' +
        'See README.md for local replica-set setup instructions.'
    );
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  const conn = mongoose.connection;

  conn.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message });
  });

  conn.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  conn.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  // Check replica set capability (required for transactions in Phase 3+)
  await checkReplicaSet(conn);

  logger.info(`MongoDB connected: ${conn.host}:${conn.port}/${conn.name}`);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed (SIGINT)');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed (SIGTERM)');
    process.exit(0);
  });
}
/**
 * Verifies that the connected MongoDB supports replica sets (required for transactions).
 * Logs a warning but does NOT exit — Phase 3 billing routes will refuse to operate
 * if transactions are unavailable, giving a clear error at the billing call site.
 */
async function checkReplicaSet(conn: mongoose.Connection): Promise<void> {
  try {
    const admin = conn.db?.admin();
    if (!admin) return;

    const status = await admin.command({ isMaster: 1 });
    const isReplicaSet = !!status.setName;

    if (isReplicaSet) {
      logger.info(`MongoDB replica set detected: ${status.setName as string}`);
      process.env._MONGO_REPLICA_SET = 'true';
    } else {
      logger.warn(
        '⚠️  MongoDB is running as STANDALONE (no replica set). ' +
          'Multi-document transactions are NOT available. ' +
          'Billing (Phase 3) will refuse to process invoices until a replica set is configured. ' +
          'See README.md for setup instructions.'
      );
      process.env._MONGO_REPLICA_SET = 'false';
    }
  } catch {
    logger.warn('Could not determine MongoDB replica set status.');
    process.env._MONGO_REPLICA_SET = 'unknown';
  }
}

/** Returns true if the MongoDB connection supports transactions */
export function isReplicaSetCapable(): boolean {
  return process.env._MONGO_REPLICA_SET === 'true';
}
