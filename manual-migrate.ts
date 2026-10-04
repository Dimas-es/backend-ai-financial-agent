import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Running raw SQL migrations...');
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS current_balance numeric(12,2) DEFAULT '0' NOT NULL;`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cycle_start_date integer DEFAULT 25 NOT NULL;`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_persona text;`);
    console.log('Migration success!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
  process.exit(0);
}

migrate();
