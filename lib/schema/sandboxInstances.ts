import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sandboxInstances = sqliteTable("sandbox_instances", {
	id: text("id").primaryKey(),
	conversationId: text("conversation_id").notNull(),
	sandboxId: text("sandbox_id").notNull(),
	status: text("status").notNull(), // running | stopped | failed
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	stoppedAt: integer("stopped_at", { mode: "timestamp_ms" }),
});
