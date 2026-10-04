import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { transactions, categories, users } from '../db/schema';
import { getOrCreateCategory } from './categoryService';
import { getFinancialDateRange } from '../utils/dateUtils';

export interface AddTransactionParams {
  userId: string;
  type: 'income' | 'expense';
  amount: number | string;
  description: string;
  categoryName?: string;
  date?: Date;
}

export interface MonthlySummary {
  month: number;
  year: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  walletBalance: number;
  transactionCount: number;
}

export interface TransactionWithCategory {
  id: number;
  userId: string;
  categoryId: number | null;
  categoryName: string | null;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: Date;
  createdAt: Date;
}

/**
 * Mencatat transaksi baru (pemasukan atau pengeluaran) ke database.
 * Otomatis mencari atau membuat kategori jika categoryName diberikan.
 */
export async function addTransaction(params: AddTransactionParams): Promise<TransactionWithCategory> {
  const { userId, type, amount, description, categoryName, date } = params;

  try {
    let categoryId: number | null = null;
    let resolvedCategoryName: string | null = null;

    if (categoryName && categoryName.trim() !== '') {
      const category = await getOrCreateCategory(userId, categoryName.trim(), type);
      categoryId = category.id;
      resolvedCategoryName = category.name;
    }

    // Format amount ke string desimal 2 angka untuk kolom numeric(12,2)
    const numericAmount = typeof amount === 'number' ? amount.toFixed(2) : parseFloat(amount).toFixed(2);

    const [inserted] = await db
      .insert(transactions)
      .values({
        userId,
        categoryId,
        type,
        amount: numericAmount,
        description: description.trim(),
        date: date || new Date(),
      })
      .returning();

    // Update currentBalance di users
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (user) {
      let currentBal = parseFloat(user.currentBalance);
      const amt = parseFloat(numericAmount);
      if (type === 'income') {
        currentBal += amt;
      } else {
        currentBal -= amt;
      }
      await db.update(users).set({ currentBalance: currentBal.toFixed(2) }).where(eq(users.id, userId));
    }

    console.log(`[TransactionService] Transaksi baru tersimpan: ${type.toUpperCase()} Rp ${numericAmount} - "${description}"`);

    return {
      id: inserted.id,
      userId: inserted.userId,
      categoryId: inserted.categoryId,
      categoryName: resolvedCategoryName,
      type: inserted.type,
      amount: parseFloat(inserted.amount),
      description: inserted.description,
      date: inserted.date,
      createdAt: inserted.createdAt,
    };
  } catch (error) {
    console.error(`[TransactionService] Gagal mencatat transaksi:`, error);
    throw error;
  }
}

/**
 * Menghitung ringkasan keuangan bulanan (total pemasukan, total pengeluaran, selisih saldo).
 * @param month Bulan (1-12)
 * @param year Tahun (contoh: 2026)
 */
export async function getMonthlySummary(
  userId: string,
  month: number,
  year: number
): Promise<MonthlySummary> {
  try {
    // Ambil cycleStartDate dari db user
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const cycleStart = user?.cycleStartDate || 25;
    
    // Rentang awal dan akhir bulan finansial
    const { startDate, endDate } = getFinancialDateRange(month, year, cycleStart);

    const result = await db
      .select({
        totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
        totalExpense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
        count: sql<string>`COUNT(*)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );

    const summaryData = result[0] || { totalIncome: '0', totalExpense: '0', count: '0' };
    const totalIncome = parseFloat(summaryData.totalIncome);
    const totalExpense = parseFloat(summaryData.totalExpense);
    const balance = totalIncome - totalExpense;

    return {
      month,
      year,
      totalIncome,
      totalExpense,
      balance,
      walletBalance: balance,
      transactionCount: parseInt(summaryData.count, 10),
    };
  } catch (error) {
    console.error(`[TransactionService] Gagal menghitung ringkasan bulanan untuk user ${userId}:`, error);
    throw error;
  }
}

/**
 * Mengambil daftar transaksi terbaru milik user.
 */
export async function getRecentTransactions(
  userId: string,
  limit: number = 5
): Promise<TransactionWithCategory[]> {
  try {
    const list = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        type: transactions.type,
        amount: transactions.amount,
        description: transactions.description,
        date: transactions.date,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date), desc(transactions.id))
      .limit(limit);

    return list.map((item) => ({
      ...item,
      amount: parseFloat(item.amount),
    }));
  } catch (error) {
    console.error(`[TransactionService] Gagal mengambil transaksi terbaru user ${userId}:`, error);
    throw error;
  }
}
