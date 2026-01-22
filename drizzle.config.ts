import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!databaseUrl) {
	throw new Error("Missing DATABASE_URL for drizzle-kit.");
}

export default defineConfig({
	schema: "./lib/schema/index.ts",
	out: "./db/migrations",
	dialect: "turso",
	dbCredentials: authToken
		? { url: databaseUrl, authToken }
		: { url: databaseUrl },
});
