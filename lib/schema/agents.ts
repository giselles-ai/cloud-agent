import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	name: text("name").notNull(),
	description: text("description"),
	systemPrompt: text("system_prompt"),
	tools: text("tools"),
	workspacePresetType: text("workspace_preset_type"),
	repoUrl: text("repo_url"),
	repoRevision: text("repo_revision"),
	repoDepth: text("repo_depth"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
