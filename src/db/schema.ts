import { 
  pgTable, 
  serial, 
  text, 
  timestamp, 
  integer, 
  numeric, 
  date, 
  uuid, 
  boolean,
  pgEnum 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ENUMS
export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense']);
export const goalStatusEnum = pgEnum('goal_status', ['active', 'achieved', 'abandoned']);

// 1. Users Table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  whatsappNumber: text('whatsapp_number').unique().notNull(),
  name: text('name'),
  currentBalance: numeric('current_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  cycleStartDate: integer('cycle_start_date').default(25).notNull(),
  aiPersona: text('ai_persona'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Categories Table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(), 
  type: transactionTypeEnum('type').notNull(),
  icon: text('icon'),
});

// 3. Transactions Table
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  categoryId: integer('category_id').references(() => categories.id), 
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description').notNull(),
  date: timestamp('date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Budgets Table
export const budgets = pgTable('budgets', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  month: integer('month').notNull(), 
  year: integer('year').notNull(),
  alertThreshold: integer('alert_threshold').default(80).notNull(),
  isAlertSent: boolean('is_alert_sent').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Goals Table
export const goals = pgTable('goals', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  targetAmount: numeric('target_amount', { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric('current_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  deadline: date('deadline'), 
  status: goalStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Reminders Table
export const reminders = pgTable('reminders', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  message: text('message').notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  isRecurring: boolean('is_recurring').default(false).notNull(),
  recurrenceRule: text('recurrence_rule'),
  status: text('status').default('pending').notNull(), // pending, sent, cancelled
});

// RELATIONS
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  categories: many(categories),
  budgets: many(budgets),
  goals: many(goals),
  reminders: many(reminders),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
}));
