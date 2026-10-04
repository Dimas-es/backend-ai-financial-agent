import { and, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { budgets, categories, transactions } from '../db/schema';
import { getOrCreateCategory } from './categoryService';
import { getFinancialDateRange } from '../utils/dateUtils';

export interface BudgetStatus {
  budgetId: number;
  categoryId: number;
  categoryName: string;
  month: number;
  year: number;
  budgetAmount: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  alertThreshold: number;
  isAlertTriggered: boolean;
  isAlertSent: boolean;
}

/**
 * Membuat atau memperbarui budget bulanan untuk kategori tertentu.
 */
export async function upsertBudget(
  userId: string,
  categoryName: string,
  amount: number | string,
  month: number,
  year: number,
  alertThreshold: number = 80
) {
  try {
    // 1. Dapatkan atau buat kategori pengeluaran
    const category = await getOrCreateCategory(userId, categoryName, 'expense');

    const numericAmount = typeof amount === 'number' ? amount.toFixed(2) : parseFloat(amount).toFixed(2);

    // 2. Cek apakah sudah ada budget untuk kategori dan periode ini
    const existingBudget = await db.query.budgets.findFirst({
      where: and(
        eq(budgets.userId, userId),
        eq(budgets.categoryId, category.id),
        eq(budgets.month, month),
        eq(budgets.year, year)
      ),
    });

    if (existingBudget) {
      // Update data budget yang sudah ada
      const [updated] = await db
        .update(budgets)
        .set({
          amount: numericAmount,
          alertThreshold,
          isAlertSent: false, // Reset status alert jika budget diperbarui
        })
        .where(eq(budgets.id, existingBudget.id))
        .returning();

      console.log(`[BudgetService] Budget diperbarui untuk kategori "${category.name}": Rp ${numericAmount} (${month}/${year})`);
      return {
        ...updated,
        categoryName: category.name,
      };
    }

    // 3. Jika belum ada, buat baru
    const [newBudget] = await db
      .insert(budgets)
      .values({
        userId,
        categoryId: category.id,
        amount: numericAmount,
        month,
        year,
        alertThreshold,
        isAlertSent: false,
      })
      .returning();

    console.log(`[BudgetService] Budget baru dibuat untuk kategori "${category.name}": Rp ${numericAmount} (${month}/${year})`);
    return {
      ...newBudget,
      categoryName: category.name,
    };
  } catch (error) {
    console.error(`[BudgetService] Gagal menyimpan budget untuk user ${userId}:`, error);
    throw error;
  }
}

/**
 * Memeriksa status pemakaian anggaran untuk kategori tertentu pada bulan dan tahun yang ditentukan.
 */
export async function checkBudgetStatus(
  userId: string,
  categoryName: string,
  month: number,
  year: number
): Promise<BudgetStatus | null> {
  try {
    // 1. Cari kategori
    const category = await db.query.categories.findFirst({
      where: and(
        eq(categories.userId, userId),
        eq(categories.name, categoryName.trim())
      ),
    });

    if (!category) {
      return null;
    }

    // 2. Ambil data budget
    const budget = await db.query.budgets.findFirst({
      where: and(
        eq(budgets.userId, userId),
        eq(budgets.categoryId, category.id),
        eq(budgets.month, month),
        eq(budgets.year, year)
      ),
    });

    if (!budget) {
      return null;
    }

    // 3. Hitung total pengeluaran kategori ini di bulan yang bersangkutan
    const { startDate, endDate } = getFinancialDateRange(month, year);

    const expenseResult = await db
      .select({
        totalSpent: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.categoryId, category.id),
          eq(transactions.type, 'expense'),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );

    const budgetAmount = parseFloat(budget.amount);
    const spent = parseFloat(expenseResult[0]?.totalSpent || '0');
    const remaining = budgetAmount - spent;
    const percentageUsed = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
    const isAlertTriggered = percentageUsed >= budget.alertThreshold;

    return {
      budgetId: budget.id,
      categoryId: category.id,
      categoryName: category.name,
      month,
      year,
      budgetAmount,
      spent,
      remaining,
      percentageUsed: Math.round(percentageUsed * 100) / 100,
      alertThreshold: budget.alertThreshold,
      isAlertTriggered,
      isAlertSent: budget.isAlertSent,
    };
  } catch (error) {
    console.error(`[BudgetService] Gagal memeriksa status budget kategori "${categoryName}":`, error);
    throw error;
  }
}

/**
 * Menandai bahwa notifikasi peringatan anggaran sudah terkirim (anti-spam).
 */
export async function markAlertSent(budgetId: number): Promise<void> {
  try {
    await db
      .update(budgets)
      .set({ isAlertSent: true })
      .where(eq(budgets.id, budgetId));
  } catch (error) {
    console.error(`[BudgetService] Gagal mengupdate isAlertSent untuk budget ${budgetId}:`, error);
  }
}
