import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "@/lib/db/schema";

const connectionUrl = process.env.TURSO_CONNECTION_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!connectionUrl || !authToken) {
	throw new Error("Missing Turso environment variables.");
}

const client = createClient({
	url: connectionUrl,
	authToken,
});

export const db = drizzle(client, { schema });
