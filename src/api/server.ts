import express from 'express';
import cors from 'cors';
import { transactionRoutes } from './routes/transactions';
import { budgetRoutes } from './routes/budgets';
import { categoryRoutes } from './routes/categories';
import { userRoutes } from './routes/users';

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/users', userRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/budgets', budgetRoutes);
  app.use('/api/categories', categoryRoutes);

  return app;
}
