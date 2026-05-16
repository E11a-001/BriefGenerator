import 'dotenv/config';

export function getConfig() {
  return {
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3000),
    databaseUrl: process.env.DATABASE_URL || ''
  };
}
