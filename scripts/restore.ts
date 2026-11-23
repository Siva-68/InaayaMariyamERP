import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hinaya_mariyam_erp';
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');

export async function runRestore(targetBackupDir?: string, confirm: boolean = false): Promise<void> {
  let restoreDir = targetBackupDir;

  if (!restoreDir) {
    // Find latest backup directory
    if (!fs.existsSync(BACKUP_DIR)) {
      throw new Error(`Backup directory does not exist: ${BACKUP_DIR}`);
    }

    const entries = fs
      .readdirSync(BACKUP_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith('backup_'))
      .sort((a, b) => b.name.localeCompare(a.name));

    if (entries.length === 0) {
      throw new Error(`No backups found in ${BACKUP_DIR}`);
    }

    restoreDir = path.join(BACKUP_DIR, entries[0].name);
  }

  if (!fs.existsSync(restoreDir)) {
    throw new Error(`Specified backup directory does not exist: ${restoreDir}`);
  }

  const metaPath = path.join(restoreDir, 'metadata.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`metadata.json not found in backup directory: ${restoreDir}`);
  }

  const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  console.log(`[Restore] Target backup timestamp : ${metadata.timestamp}`);
  console.log(`[Restore] Target database         : ${metadata.database}`);
  console.log(`[Restore] Collections count       : ${Object.keys(metadata.collections).length}`);
  console.log(`[Restore] Total documents         : ${metadata.totalDocuments}`);

  if (!confirm) {
    console.log(
      '\n⚠️  DRY-RUN MODE: Use --confirm flag to execute actual restoration into MongoDB.\n'
    );
    return;
  }

  console.log(`\n[Restore] Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@')}`);
  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed: db object not found');
  }

  for (const [collName, docCount] of Object.entries(metadata.collections)) {
    const jsonPath = path.join(restoreDir, `${collName}.json`);
    if (!fs.existsSync(jsonPath)) {
      console.warn(`  ⚠️  File missing for collection ${collName}, skipping.`);
      continue;
    }

    const docs = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const collection = db.collection(collName);

    // Drop existing collection to ensure clean restore
    try {
      await collection.drop();
    } catch (err: unknown) {
      // Ignore NamespaceNotFound error if collection didn't exist
      const mongoErr = err as { code?: number };
      if (mongoErr.code !== 26) {
        throw err;
      }
    }

    if (docs.length > 0) {
      // Re-hydrate MongoDB ObjectIds & dates
      const hydratedDocs = docs.map((d: Record<string, unknown>) => hydrateBson(d));
      await collection.insertMany(hydratedDocs);
    }

    console.log(`  ✓ Restored ${collName.padEnd(20)} : ${docs.length} / ${docCount} documents`);
  }

  console.log('\n[Restore] Database restoration successfully completed!');
  await mongoose.disconnect();
}

function hydrateBson(item: unknown): unknown {
  if (!item || typeof item !== 'object') return item;

  if (Array.isArray(item)) {
    return item.map(hydrateBson);
  }

  const obj = item as Record<string, unknown>;

  // Check for MongoDB Extended JSON types if any
  if (obj.$oid && typeof obj.$oid === 'string') {
    return new mongoose.Types.ObjectId(obj.$oid);
  }

  if (obj.$date && typeof obj.$date === 'string') {
    return new Date(obj.$date);
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === '_id' && typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val)) {
      result[key] = new mongoose.Types.ObjectId(val);
    } else {
      result[key] = hydrateBson(val);
    }
  }
  return result;
}

// Direct CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const dirArgIndex = args.findIndex((a) => a === '--dir');
  const targetDir = dirArgIndex !== -1 ? args[dirArgIndex + 1] : undefined;

  runRestore(targetDir, confirm)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Restore Error]', err);
      process.exit(1);
    });
}
