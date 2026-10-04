import {
  addTransaction,
  getMonthlySummary,
  getRecentTransactions,
} from '../services/transactionService';
import { upsertBudget, checkBudgetStatus } from '../services/budgetService';
import { createReminder, getUserPendingReminders } from '../services/reminderService';
import { getFinancialPeriod } from '../utils/dateUtils';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Mengeksekusi tool (fungsi) yang dipilih oleh Gemini AI.
 * File ini adalah "jembatan" antara output Function Call dari Gemini
 * dan Services layer (Fase 3) yang berinteraksi langsung dengan database.
 *
 * AI TIDAK PERNAH akses database langsung — semuanya melalui fungsi di sini.
 */
export async function executeTool(
  userId: string,
  toolName: string,
  toolArgs: Record<string, any>
): Promise<Record<string, any>> {
  console.log(`[ToolExecutor] Menjalankan tool: ${toolName}`, JSON.stringify(toolArgs));

  try {
    switch (toolName) {
      // ──────────────────────────────────────────────
      // TRANSAKSI
      // ──────────────────────────────────────────────
      case 'add_transaction': {
        const { type, amount, description, categoryName, date } = toolArgs;

        // Validasi amount
        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          return { success: false, error: 'Jumlah uang harus berupa angka positif.' };
        }
        if (numAmount > 999999999) {
          return { success: false, error: 'Jumlah uang terlalu besar. Maksimum Rp999.999.999.' };
        }

        // Parsing date jika ada
        let txDate: Date | undefined = undefined;
        if (date) {
          const parsedDate = new Date(date);
          if (!isNaN(parsedDate.getTime())) {
            txDate = parsedDate;
          }
        }

        const transaction = await addTransaction({
          userId,
          type,
          amount: numAmount,
          description: description || 'Transaksi',
          categoryName: categoryName || undefined,
          date: txDate,
        });

        return {
          success: true,
          transaction: {
            id: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            description: transaction.description,
            categoryName: transaction.categoryName,
            date: transaction.date.toISOString(),
          },
        };
      }

      case 'get_monthly_summary': {
        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        const cycleStart = user?.cycleStartDate || 25;
        
        const { month: currentMonth, year: currentYear } = getFinancialPeriod(new Date(), cycleStart);
        const month = Number(toolArgs.month) || currentMonth;
        const year = Number(toolArgs.year) || currentYear;

        const summary = await getMonthlySummary(userId, month, year);

        return {
          success: true,
          summary: {
            month: summary.month,
            year: summary.year,
            totalIncome: summary.totalIncome,
            totalExpense: summary.totalExpense,
            balance: summary.balance,
            walletBalance: summary.walletBalance,
            transactionCount: summary.transactionCount,
          },
        };
      }

      case 'get_recent_transactions': {
        let limit = Number(toolArgs.limit) || 5;
        if (limit > 10) limit = 10;
        if (limit < 1) limit = 1;

        const transactions = await getRecentTransactions(userId, limit);

        return {
          success: true,
          transactions: transactions.map((tx) => ({
            type: tx.type,
            amount: tx.amount,
            description: tx.description,
            categoryName: tx.categoryName,
            date: tx.date.toISOString(),
          })),
        };
      }

      // ──────────────────────────────────────────────
      // BUDGET / ANGGARAN
      // ──────────────────────────────────────────────
      case 'set_budget': {
        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        const cycleStart = user?.cycleStartDate || 25;
        const { month: currentMonth, year: currentYear } = getFinancialPeriod(new Date(), cycleStart);
        const { categoryName, amount } = toolArgs;
        const month = Number(toolArgs.month) || currentMonth;
        const year = Number(toolArgs.year) || currentYear;

        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          return { success: false, error: 'Jumlah budget harus berupa angka positif.' };
        }

        const budget = await upsertBudget(userId, categoryName, numAmount, month, year);

        return {
          success: true,
          budget: {
            categoryName: budget.categoryName,
            amount: parseFloat(budget.amount),
            month,
            year,
          },
        };
      }

      case 'check_budget': {
        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        const cycleStart = user?.cycleStartDate || 25;
        const { month: currentMonth, year: currentYear } = getFinancialPeriod(new Date(), cycleStart);
        const { categoryName } = toolArgs;
        const month = Number(toolArgs.month) || currentMonth;
        const year = Number(toolArgs.year) || currentYear;

        const status = await checkBudgetStatus(userId, categoryName, month, year);

        if (!status) {
          return {
            success: false,
            error: `Tidak ditemukan budget untuk kategori "${categoryName}" pada bulan ${month}/${year}.`,
          };
        }

        return {
          success: true,
          budgetStatus: {
            categoryName: status.categoryName,
            budgetAmount: status.budgetAmount,
            spent: status.spent,
            remaining: status.remaining,
            percentageUsed: status.percentageUsed,
            isAlertTriggered: status.isAlertTriggered,
          },
        };
      }

      // ──────────────────────────────────────────────
      // PENGINGAT / REMINDER
      // ──────────────────────────────────────────────
      case 'create_reminder': {
        const { message, scheduledAt, isRecurring } = toolArgs;

        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
          return { success: false, error: 'Format tanggal tidak valid.' };
        }

        const reminder = await createReminder(
          userId,
          message,
          scheduledDate,
          isRecurring || false
        );

        return {
          success: true,
          reminder: {
            id: reminder.id,
            message: reminder.message,
            scheduledAt: reminder.scheduledAt.toISOString(),
            isRecurring: reminder.isRecurring,
          },
        };
      }

      case 'get_pending_reminders': {
        const reminders = await getUserPendingReminders(userId);

        return {
          success: true,
          reminders: reminders.map((r) => ({
            id: r.id,
            message: r.message,
            scheduledAt: r.scheduledAt.toISOString(),
            isRecurring: r.isRecurring,
          })),
        };
      }

      // ──────────────────────────────────────────────
      // TOOL TIDAK DIKENAL
      // ──────────────────────────────────────────────
      default:
        console.warn(`[ToolExecutor] Tool tidak dikenal: ${toolName}`);
        return { success: false, error: `Tool "${toolName}" tidak tersedia.` };
    }
  } catch (error) {
    console.error(`[ToolExecutor] Error saat menjalankan tool "${toolName}":`, error);
    return {
      success: false,
      error: `Terjadi kesalahan internal saat menjalankan ${toolName}.`,
    };
  }
}
