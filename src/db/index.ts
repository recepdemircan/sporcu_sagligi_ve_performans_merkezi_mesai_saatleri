import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_USER;
const password = process.env.SQL_PASSWORD;

if (!sqlHost || !sqlDbName || !user || !password) {
  console.error("Missing database connection parameters. Some features may not work.");
}

const client = postgres({
  host: sqlHost || '',
  database: sqlDbName || '',
  user: user || '',
  password: password || '',
  ssl: false,
});

export const db = drizzle(client, { schema });
