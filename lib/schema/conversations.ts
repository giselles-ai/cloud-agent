import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conversations = sqliteTable("conversations", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	agentId: text("agent_id").notNull(),
	status: text("status").notNull(), // active | archived | failed
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
});
