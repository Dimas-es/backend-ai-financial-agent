import { and, eq, ilike } from 'drizzle-orm';
import { db } from '../db';
import { categories } from '../db/schema';

export interface Category {
  id: number;
  userId: string;
  name: string;
  type: 'income' | 'expense';
  icon: string | null;
}

/**
 * Mencari kategori berdasarkan userId dan nama (case-insensitive).
 * Jika belum ada, fungsi ini otomatis membuat kategori baru.
 */
export async function getOrCreateCategory(
  userId: string,
  name: string,
  type: 'income' | 'expense' = 'expense',
  icon?: string
): Promise<Category> {
  const trimmedName = name.trim();

  try {
    // 1. Cari kategori yang sudah ada milik user (case-insensitive)
    const existing = await db.query.categories.findFirst({
      where: and(
        eq(categories.userId, userId),
        ilike(categories.name, trimmedName)
      ),
    });

    if (existing) {
      return existing;
    }

    // 2. Jika belum ada, buat kategori baru
    const [newCategory] = await db
      .insert(categories)
      .values({
        userId,
        name: trimmedName,
        type,
        icon: icon || null,
      })
      .returning();

    console.log(`[CategoryService] Kategori baru dibuat: "${newCategory.name}" (${newCategory.type}) untuk user: ${userId}`);
    return newCategory;
  } catch (error) {
    console.error(`[CategoryService] Error saat mencari/membuat kategori "${name}":`, error);
    throw error;
  }
}

/**
 * Mengambil semua kategori milik user tertentu, bisa difilter berdasarkan tipe.
 */
export async function getUserCategories(
  userId: string,
  type?: 'income' | 'expense'
): Promise<Category[]> {
  try {
    const whereConditions = type
      ? and(eq(categories.userId, userId), eq(categories.type, type))
      : eq(categories.userId, userId);

    const result = await db.query.categories.findMany({
      where: whereConditions,
      orderBy: (categories, { asc }) => [asc(categories.name)],
    });

    return result;
  } catch (error) {
    console.error(`[CategoryService] Gagal mengambil kategori untuk user ${userId}:`, error);
    throw error;
  }
}
