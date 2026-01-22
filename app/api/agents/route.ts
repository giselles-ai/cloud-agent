import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/schema";

export const runtime = "nodejs";

export async function GET() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const rows = await db
		.select({
			id: agents.id,
			name: agents.name,
			systemPrompt: agents.systemPrompt,
			repoUrl: agents.repoUrl,
		})
		.from(agents)
		.where(eq(agents.userId, session.user.id))
		.orderBy(desc(agents.createdAt));

	return NextResponse.json(rows);
}

export async function POST(request: Request) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = (await request.json()) as {
		name?: string;
		systemPrompt?: string;
		tools?: { bash?: boolean };
		workspacePresetType?: string;
		repoUrl?: string | null;
		repoRevision?: string | null;
		repoDepth?: string | null;
	};

	if (!body.name || !body.systemPrompt || !body.repoUrl) {
		return NextResponse.json(
			{ error: "Missing required fields." },
			{ status: 400 },
		);
	}

	if (body.workspacePresetType !== "repo_public") {
		return NextResponse.json(
			{ error: "Only repo_public preset is supported." },
			{ status: 400 },
		);
	}

	const toolConfig = JSON.stringify({ bash: body.tools?.bash ?? false });
	const now = new Date();

	const [row] = await db
		.insert(agents)
		.values({
			id: randomUUID(),
			userId: session.user.id,
			name: body.name,
			systemPrompt: body.systemPrompt,
			tools: toolConfig,
			workspacePresetType: body.workspacePresetType,
			repoUrl: body.repoUrl,
			repoRevision: body.repoRevision ?? null,
			repoDepth: body.repoDepth ?? null,
			createdAt: now,
			updatedAt: now,
		})
		.returning({ id: agents.id });

	return NextResponse.json(row);
}
