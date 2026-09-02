import { pgTable, varchar, jsonb, bigint, text } from "drizzle-orm/pg-core";

export const shiftRequests = pgTable("shift_requests", {
  id: varchar("id", { length: 255 }).primaryKey(),
  weekId: varchar("week_id", { length: 50 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  userName: varchar("user_name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  shifts: jsonb("shifts").notNull().default('[]'),
  submittedAt: bigint("submitted_at", { mode: 'number' }).notNull(),
});

export const swapRequests = pgTable("swap_requests", {
  id: varchar("id", { length: 255 }).primaryKey(),
  weekId: varchar("week_id", { length: 50 }).notNull(),
  date: varchar("date", { length: 50 }).notNull(),
  senderUserId: varchar("sender_user_id", { length: 255 }).notNull(),
  receiverUserId: varchar("receiver_user_id", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  createdAt: bigint("created_at", { mode: 'number' }).notNull(),
});

export const settings = pgTable("settings", {
  id: varchar("id", { length: 255 }).primaryKey(),
  value: text("value"),
});
