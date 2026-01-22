import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { createSandbox } from "@/lib/sandbox/manager";
import { agents, conversations, sandboxInstances } from "@/lib/schema";

export const runtime = "nodejs";

export async function GET() {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const rows = await db
		.select()
		.from(conversations)
		.where(eq(conversations.userId, session.user.id))
		.orderBy(desc(conversations.updatedAt));

	return NextResponse.json({ conversations: rows });
}

export async function POST(request: Request) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const agentId = typeof body?.agentId === "string" ? body.agentId : null;

	if (!agentId) {
		return NextResponse.json({ error: "agentId is required" }, { status: 400 });
	}

	const agent = await db
		.select()
		.from(agents)
		.where(and(eq(agents.id, agentId), eq(agents.userId, session.user.id)));

	if (!agent[0]) {
		return NextResponse.json({ error: "Agent not found" }, { status: 404 });
	}

	const sandbox = await createSandbox();
	const now = new Date();
	const conversationId = randomUUID();

	await db.insert(conversations).values({
		id: conversationId,
		userId: session.user.id,
		agentId,
		status: "active",
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(sandboxInstances).values({
		id: randomUUID(),
		conversationId,
		sandboxId: sandbox.sandboxId,
		status: "running",
		createdAt: now,
		updatedAt: now,
	});

	const created = await db
		.select()
		.from(conversations)
		.where(eq(conversations.id, conversationId));

	return NextResponse.json({ conversation: created[0] });
}
