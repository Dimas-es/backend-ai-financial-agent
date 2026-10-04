import { Router } from 'express';
import { db } from '../../db';
import { categories, budgets, transactions } from '../../db/schema';
import { eq } from 'drizzle-orm';

export const categoryRoutes = Router();

// GET /api/categories?userId=...
categoryRoutes.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
    res.json({ categories: userCategories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/categories
categoryRoutes.post('/', async (req, res) => {
  try {
    const { userId, name, type } = req.body;
    if (!userId || !name || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [newCategory] = await db.insert(categories).values({
      userId,
      name: name.trim(),
      type,
    }).returning();

    res.json({ success: true, category: newCategory });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/categories/:id
categoryRoutes.put('/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { name, type } = req.body;
    
    if (isNaN(categoryId) || !name || !type) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const [updated] = await db.update(categories)
      .set({ name: name.trim(), type })
      .where(eq(categories.id, categoryId))
      .returning();

    res.json({ success: true, category: updated });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/categories/:id
categoryRoutes.delete('/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Set null on transactions
    await db.update(transactions)
      .set({ categoryId: null })
      .where(eq(transactions.categoryId, categoryId));

    // Delete budgets
    await db.delete(budgets)
      .where(eq(budgets.categoryId, categoryId));

    // Delete category
    await db.delete(categories)
      .where(eq(categories.id, categoryId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
