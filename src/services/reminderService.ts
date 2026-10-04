import { and, desc, eq, lte } from 'drizzle-orm';
import { db } from '../db';
import { reminders } from '../db/schema';

export interface Reminder {
  id: number;
  userId: string;
  message: string;
  scheduledAt: Date;
  isRecurring: boolean;
  recurrenceRule: string | null;
  status: string;
}

/**
 * Membuat jadwal pengingat baru untuk user.
 */
export async function createReminder(
  userId: string,
  message: string,
  scheduledAt: Date,
  isRecurring: boolean = false,
  recurrenceRule?: string
): Promise<Reminder> {
  try {
    const [newReminder] = await db
      .insert(reminders)
      .values({
        userId,
        message: message.trim(),
        scheduledAt,
        isRecurring,
        recurrenceRule: recurrenceRule || null,
        status: 'pending',
      })
      .returning();

    console.log(`[ReminderService] Pengingat baru dibuat untuk ${scheduledAt.toLocaleString()}: "${message}"`);
    return newReminder;
  } catch (error) {
    console.error(`[ReminderService] Gagal membuat pengingat:`, error);
    throw error;
  }
}

/**
 * Mengambil semua pengingat milik user yang masih berstatus 'pending'.
 */
export async function getUserPendingReminders(userId: string): Promise<Reminder[]> {
  try {
    const list = await db.query.reminders.findMany({
      where: and(
        eq(reminders.userId, userId),
        eq(reminders.status, 'pending')
      ),
      orderBy: (reminders, { asc }) => [asc(reminders.scheduledAt)],
    });

    return list;
  } catch (error) {
    console.error(`[ReminderService] Gagal mengambil pengingat user ${userId}:`, error);
    throw error;
  }
}

/**
 * Mengambil daftar pengingat yang sudah jatuh tempo (due) di seluruh user.
 * Sangat berguna untuk Cron Job di Modul 6.
 */
export async function getDueReminders(currentTime: Date = new Date()): Promise<Reminder[]> {
  try {
    const dueList = await db.query.reminders.findMany({
      where: and(
        eq(reminders.status, 'pending'),
        lte(reminders.scheduledAt, currentTime)
      ),
      orderBy: (reminders, { asc }) => [asc(reminders.scheduledAt)],
    });

    return dueList;
  } catch (error) {
    console.error(`[ReminderService] Gagal mengambil daftar reminder yang due:`, error);
    throw error;
  }
}

/**
 * Menandai status pengingat sebagai 'sent' setelah berhasil dikirim ke WhatsApp user.
 */
export async function markReminderSent(reminderId: number): Promise<void> {
  try {
    await db
      .update(reminders)
      .set({ status: 'sent' })
      .where(eq(reminders.id, reminderId));

    console.log(`[ReminderService] Reminder #${reminderId} ditandai sebagai 'sent'`);
  } catch (error) {
    console.error(`[ReminderService] Gagal mengupdate status reminder #${reminderId}:`, error);
    throw error;
  }
}
