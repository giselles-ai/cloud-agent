import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const messages = sqliteTable("messages", {
	id: text("id").primaryKey(),
	conversationId: text("conversation_id").notNull(),
	role: text("role").notNull(), // user | assistant | system | tool
	content: text("content").notNull(),
	metadata: text("metadata"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
