import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in .env');
}

// Client postgres connection
const client = postgres(connectionString);

// Drizzle instance with schema configured
export const db = drizzle(client, { schema });
