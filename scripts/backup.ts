import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hinaya_mariyam_erp';
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);

interface BackupMetadata {
  timestamp: string;
  database: string;
  collections: Record<string, number>;
  totalDocuments: number;
  retentionDays: number;
}

export async function runBackup(): Promise<string> {
  console.log(`[Backup] Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@')}`);
  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed: db object not found');
  }

  // Format timestamp: YYYYMMDD_HHMMSS
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const targetDir = path.join(BACKUP_DIR, `backup_${timestampStr}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const collections = await db.listCollections().toArray();
  const metadata: BackupMetadata = {
    timestamp: now.toISOString(),
    database: db.databaseName,
    collections: {},
    totalDocuments: 0,
  };

  console.log(`[Backup] Starting backup for ${collections.length} collections into: ${targetDir}`);

  for (const collInfo of collections) {
    const collName = collInfo.name;
    // Skip internal system collections if any
    if (collName.startsWith('system.')) continue;

    const collection = db.collection(collName);
    const docs = await collection.find({}).toArray();
    const filePath = path.join(targetDir, `${collName}.json`);

    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
    metadata.collections[collName] = docs.length;
    metadata.totalDocuments += docs.length;

    console.log(`  ✓ ${collName.padEnd(20)} : ${docs.length} documents`);
  }

  // Write metadata file
  fs.writeFileSync(
    path.join(targetDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );

  console.log(`[Backup] Complete! Total documents archived: ${metadata.totalDocuments}`);

  // Retention cleanup
  pruneOldBackups(BACKUP_DIR, RETENTION_DAYS);

  await mongoose.disconnect();
  return targetDir;
}

function pruneOldBackups(backupBaseDir: string, maxDays: number) {
  if (!fs.existsSync(backupBaseDir)) return;

  const now = Date.now();
  const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;
  const entries = fs.readdirSync(backupBaseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('backup_')) {
      const fullPath = path.join(backupBaseDir, entry.name);
      const stat = fs.statSync(fullPath);
      const age = now - stat.mtimeMs;

      if (age > maxAgeMs) {
        console.log(`[Backup Retention] Removing outdated backup (> ${maxDays} days): ${entry.name}`);
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }
  }
}

// Direct CLI execution
if (require.main === module) {
  runBackup()
    .then((dir) => {
      console.log(`Backup completed successfully at ${dir}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Backup Error]', err);
      process.exit(1);
    });
}
