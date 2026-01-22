import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { stopSandbox } from "@/lib/sandbox/manager";
import { conversations, sandboxInstances } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(
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

	const now = new Date();
	const sandboxRow = await db
		.select()
		.from(sandboxInstances)
		.where(eq(sandboxInstances.conversationId, params.id));

	if (sandboxRow[0]) {
		await stopSandbox(sandboxRow[0].sandboxId);
		await db
			.update(sandboxInstances)
			.set({ status: "stopped", stoppedAt: now, updatedAt: now })
			.where(eq(sandboxInstances.id, sandboxRow[0].id));
	}

	await db
		.update(conversations)
		.set({ status: "archived", archivedAt: now, updatedAt: now })
		.where(eq(conversations.id, params.id));

	return NextResponse.json({ ok: true });
}
