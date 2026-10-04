import { Router } from 'express';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

export const userRoutes = Router();

// GET /api/users/phone/:phone
userRoutes.get('/phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const userResult = await db.select().from(users).where(eq(users.whatsappNumber, phone)).limit(1);
    
    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: userResult[0] });
  } catch (error) {
    console.error('Error fetching user by phone:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id
userRoutes.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: userResult[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/settings
userRoutes.put('/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;
    const { currentBalance, cycleStartDate, aiPersona } = req.body;

    const updates: any = {};
    if (currentBalance !== undefined) updates.currentBalance = String(currentBalance);
    if (cycleStartDate !== undefined) updates.cycleStartDate = Number(cycleStartDate);
    if (aiPersona !== undefined) updates.aiPersona = aiPersona;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const [updatedUser] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
