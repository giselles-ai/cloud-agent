import { createClient } from "@libsql/client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/libsql";

const databaseUrl = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is not defined");
}

if (!authToken) {
	throw new Error("DATABASE_AUTH_TOKEN is not defined");
}

const client = authToken
	? createClient({ url: databaseUrl, authToken })
	: createClient({ url: databaseUrl });

const db = drizzle(client);

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite" }),
	emailAndPassword: {
		enabled: true,
	},
});

export default auth;
