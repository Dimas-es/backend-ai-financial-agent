import { Router } from 'express';
import { db } from '../../db';
import { budgets, transactions, categories, users } from '../../db/schema';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { getFinancialPeriod, getFinancialDateRange } from '../../utils/dateUtils';
import { upsertBudget } from '../../services/budgetService';

export const budgetRoutes = Router();

// GET /api/budgets?userId=...
budgetRoutes.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const userRecord = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const cycleStart = userRecord?.cycleStartDate || 25;

    const now = new Date();
    const { month, year } = getFinancialPeriod(now, cycleStart);
    const { startDate, endDate } = getFinancialDateRange(month, year, cycleStart);

    const activeBudgets = await db.select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      amount: budgets.amount,
      alertThreshold: budgets.alertThreshold,
    })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .where(
        and(
          eq(budgets.userId, userId),
          eq(budgets.month, month),
          eq(budgets.year, year)
        )
      );

    // Hitung progress
    const budgetsWithProgress = await Promise.all(activeBudgets.map(async (b) => {
      const txs = await db.select({ amount: transactions.amount })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.categoryId, b.categoryId),
            gte(transactions.date, startDate),
            lte(transactions.date, endDate)
          )
        );
        
      const spent = txs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const limit = parseFloat(b.amount);
      const percentage = limit > 0 ? (spent / limit) * 100 : 0;
      
      return {
        ...b,
        spent,
        percentage: Math.min(percentage, 100),
      };
    }));

    res.json({ budgets: budgetsWithProgress });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/budgets
budgetRoutes.post('/', async (req, res) => {
  try {
    const { userId, categoryId, amount } = req.body;
    if (!userId || !categoryId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const userRecord = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const cycleStart = userRecord?.cycleStartDate || 25;

    const { month, year } = getFinancialPeriod(new Date(), cycleStart);

    // Cek kategori nama
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId)
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const result = await upsertBudget(userId, category.name, parseFloat(amount), month, year);
    res.json({ success: true, budget: result });
  } catch (error) {
    console.error('Error saving budget:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
