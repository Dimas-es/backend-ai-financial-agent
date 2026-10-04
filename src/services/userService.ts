import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

export interface User {
  id: string;
  whatsappNumber: string;
  name: string | null;
  createdAt: Date;
}

export async function getOrCreateUser(whatsappNumber: string, name?: string): Promise<User> {
  try {
    // 1. Cek apakah user sudah terdaftar di database
    const existingUser = await db.query.users.findFirst({
      where: eq(users.whatsappNumber, whatsappNumber),
    });

    if (existingUser) {
      return existingUser;
    }

    // 2. Jika belum, lakukan insert dengan proteksi konflik atomik (Upsert)
    // Ini mencegah error 'duplicate key' jika beberapa pesan masuk secara bersamaan
    const [user] = await db
      .insert(users)
      .values({
        whatsappNumber,
        name: name || 'Pengguna',
      })
      .onConflictDoUpdate({
        target: users.whatsappNumber,
        set: {
          name: name || 'Pengguna',
        },
      })
      .returning();

    console.log(`[UserService] User berhasil disimpan: ${whatsappNumber} (${name || 'Pengguna'})`);
    return user;
  } catch (error) {
    console.error(`[UserService] Gagal memeriksa atau mendaftarkan user ${whatsappNumber}:`, error);
    throw error;
  }
}
