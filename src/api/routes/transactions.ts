import { Router } from 'express';
import { db } from '../../db';
import { transactions, categories, users } from '../../db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { getFinancialPeriod, getFinancialDateRange } from '../../utils/dateUtils';
import { getMonthlySummary } from '../../services/transactionService';

export const transactionRoutes = Router();

// GET /api/transactions?userId=...
transactionRoutes.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const userRecord = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const cycleStart = userRecord?.cycleStartDate || 25;

    const now = new Date();
    const { month: currentMonth, year: currentYear } = getFinancialPeriod(now, cycleStart);
    const { startDate, endDate } = getFinancialDateRange(currentMonth, currentYear, cycleStart);

    const monthTxs = await db.select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      date: transactions.date,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
    })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .orderBy(desc(transactions.date));

    res.json({ transactions: monthTxs });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/transactions/summary?userId=...
transactionRoutes.get('/summary', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const userRecord = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const cycleStart = userRecord?.cycleStartDate || 25;

    const now = new Date();
    const { month, year } = getFinancialPeriod(now, cycleStart);
    const summary = await getMonthlySummary(userId, month, year);

    res.json({ summary });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
