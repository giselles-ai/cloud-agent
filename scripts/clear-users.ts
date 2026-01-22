import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "../lib/schema";

function printHelp() {
	console.log(`
Usage:
  bun scripts/clear-users.ts --yes [--auth-only]

Env:
  DATABASE_URL
  DATABASE_AUTH_TOKEN

Options:
  --yes        Required. Actually perform deletions.
  --auth-only  Only clears Better Auth tables (user/session/account/verification).
              Without this flag, also clears app tables (messages/sandbox_instances/conversations/agents).
`);
}

async function main() {
	const args = new Set(process.argv.slice(2));
	if (args.has("--help") || args.has("-h")) {
		printHelp();
		return;
	}

	const yes = args.has("--yes");
	const authOnly = args.has("--auth-only");

	if (!yes) {
		printHelp();
		throw new Error("Refusing to run without --yes");
	}

	const databaseUrl = process.env.DATABASE_URL;
	const authToken = process.env.DATABASE_AUTH_TOKEN;
	if (!databaseUrl || !authToken) {
		throw new Error("Missing DATABASE_URL / DATABASE_AUTH_TOKEN");
	}

	const client = createClient({ url: databaseUrl, authToken });
	const db = drizzle(client, { schema });

	console.log(
		`Clearing users${authOnly ? " (auth-only)" : " (auth + app data)"}...`,
	);

	// App tables (no FKs in current schema, so clear explicitly)
	if (!authOnly) {
		await db.delete(schema.messages);
		await db.delete(schema.sandboxInstances);
		await db.delete(schema.conversations);
		await db.delete(schema.agents);
	}

	// Better Auth tables
	await db.delete(schema.verification);
	await db.delete(schema.session);
	await db.delete(schema.account);
	await db.delete(schema.user);

	console.log("Done.");
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
