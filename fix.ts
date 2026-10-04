import { db } from './src/db/index.ts';
import { transactions } from './src/db/schema.ts';
import { sql } from 'drizzle-orm';

async function clearTransactions() {
  console.log('Clearing all transactions...');
  await db.delete(transactions);
  console.log('Cleared!');
  process.exit(0);
}

clearTransactions();
