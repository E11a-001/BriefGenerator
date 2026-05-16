import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileDatabase } from './file-db.js';

const { Pool } = pg;

const modulePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(modulePath);
const defaultFileDbPath = path.join(__dirname, '..', '.local-data', 'app-data.json');

function shouldFallbackToFileDb(error) {
  return [
    'ECONNREFUSED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ETIMEDOUT'
  ].includes(error?.code);
}

export function createDb(databaseUrl) {
  const fileDb = new FileDatabase(defaultFileDbPath);

  if (!databaseUrl) {
    console.warn(`DATABASE_URL is not configured. Using local file storage at ${defaultFileDbPath}.`);
    return fileDb;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  let activeDb = pool;

  async function fallbackToFileDb(error) {
    if (activeDb === fileDb) {
      return fileDb;
    }

    if (!shouldFallbackToFileDb(error)) {
      throw error;
    }

    console.warn(`Postgres is unavailable (${error.code}). Falling back to local file storage at ${defaultFileDbPath}.`);
    activeDb = fileDb;
    await pool.end().catch(() => {});
    return fileDb;
  }

  return {
    async query(sql, params = []) {
      try {
        return await activeDb.query(sql, params);
      } catch (error) {
        const fallback = await fallbackToFileDb(error);
        return fallback.query(sql, params);
      }
    },

    async connect() {
      try {
        return await activeDb.connect();
      } catch (error) {
        const fallback = await fallbackToFileDb(error);
        return fallback.connect();
      }
    }
  };
}
