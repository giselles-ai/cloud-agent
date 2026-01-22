import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "@/lib/schema";

const databaseUrl = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!databaseUrl || !authToken) {
	throw new Error("Missing database environment variables.");
}

const client = createClient({
	url: databaseUrl,
	authToken,
});

export const db = drizzle(client, { schema });
