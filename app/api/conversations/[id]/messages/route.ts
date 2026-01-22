import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getSandbox } from "@/lib/sandbox/manager";
import { conversations, messages, sandboxInstances } from "@/lib/schema";

export const runtime = "nodejs";

async function archiveConversation(conversationId: string) {
	const now = new Date();
	await db
		.update(conversations)
		.set({
			status: "archived",
			archivedAt: now,
			updatedAt: now,
		})
		.where(eq(conversations.id, conversationId));

	await db
		.update(sandboxInstances)
		.set({
			status: "stopped",
			stoppedAt: now,
			updatedAt: now,
		})
		.where(eq(sandboxInstances.conversationId, conversationId));
}

export async function GET(
	_request: Request,
	{ params }: { params: { id: string } },
) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const convo = await db
		.select()
		.from(conversations)
		.where(
			and(
				eq(conversations.id, params.id),
				eq(conversations.userId, session.user.id),
			),
		);

	if (!convo[0]) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const rows = await db
		.select()
		.from(messages)
		.where(eq(messages.conversationId, params.id))
		.orderBy(asc(messages.createdAt));

	return NextResponse.json({ messages: rows });
}

export async function POST(
	request: Request,
	{ params }: { params: { id: string } },
) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const convo = await db
		.select()
		.from(conversations)
		.where(
			and(
				eq(conversations.id, params.id),
				eq(conversations.userId, session.user.id),
			),
		);

	if (!convo[0]) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	if (convo[0].status !== "active") {
		return NextResponse.json(
			{ error: "Conversation archived" },
			{ status: 409 },
		);
	}

	const body = await request.json().catch(() => null);
	const content = typeof body?.content === "string" ? body.content.trim() : "";

	if (!content) {
		return NextResponse.json({ error: "content is required" }, { status: 400 });
	}

	const sandboxRow = await db
		.select()
		.from(sandboxInstances)
		.where(
			and(
				eq(sandboxInstances.conversationId, params.id),
				eq(sandboxInstances.status, "running"),
			),
		)
		.orderBy(desc(sandboxInstances.createdAt))
		.limit(1);

	if (!sandboxRow[0]) {
		await archiveConversation(params.id);
		return NextResponse.json(
			{ error: "Sandbox stopped", archived: true },
			{ status: 409 },
		);
	}

	const sandbox = await getSandbox(sandboxRow[0].sandboxId);
	if (!sandbox) {
		await archiveConversation(params.id);
		return NextResponse.json(
			{ error: "Sandbox not found", archived: true },
			{ status: 409 },
		);
	}
	if (sandbox.status !== "running") {
		await archiveConversation(params.id);
		return NextResponse.json(
			{ error: "Sandbox stopped", archived: true },
			{ status: 409 },
		);
	}
	try {
		if (sandbox.timeout < 120_000) {
			await sandbox.extendTimeout(5 * 60_000);
		}
	} catch {
		// If timeout extension fails, continue with the current session.
	}

	const now = new Date();
	await db.insert(messages).values({
		id: randomUUID(),
		conversationId: params.id,
		role: "user",
		content,
		createdAt: now,
	});

	let stdout = "";
	let stderr = "";
	let exitCode = 0;

	try {
		const result = await sandbox.runCommand({
			cmd: "bash",
			args: ["-lc", content],
		});
		exitCode = result.exitCode;
		stdout = await result.stdout();
		stderr = await result.stderr();
	} catch (error) {
		exitCode = 1;
		stderr = error instanceof Error ? error.message : String(error);
	}

	const output = [stdout, stderr].filter(Boolean).join(stderr ? "\n" : "");
	const assistantMessage = output || "(no output)";
	const metadata = JSON.stringify({
		command: content,
		exitCode,
		stdout,
		stderr,
	});

	await db.insert(messages).values({
		id: randomUUID(),
		conversationId: params.id,
		role: "assistant",
		content: assistantMessage,
		metadata,
		createdAt: now,
	});

	await db
		.update(conversations)
		.set({ updatedAt: now })
		.where(eq(conversations.id, params.id));

	await db
		.update(sandboxInstances)
		.set({ updatedAt: now })
		.where(eq(sandboxInstances.id, sandboxRow[0].id));

	return NextResponse.json({
		message: {
			role: "assistant",
			content: assistantMessage,
			metadata,
		},
	});
}
