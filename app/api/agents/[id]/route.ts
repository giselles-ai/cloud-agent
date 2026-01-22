import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/schema";

export const runtime = "nodejs";

type AgentUpdate = {
	name?: string;
	systemPrompt?: string;
	tools?: { bash?: boolean };
	repoUrl?: string | null;
	repoRevision?: string | null;
	repoDepth?: string | null;
};

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await context.params;
	const [row] = await db
		.select()
		.from(agents)
		.where(eq(agents.id, id))
		.limit(1);

	if (!row || row.userId !== session.user.id) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json(row);
}

export async function PATCH(request: Request, context: RouteContext) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await context.params;
	const body = (await request.json()) as AgentUpdate;

	const [row] = await db
		.select()
		.from(agents)
		.where(eq(agents.id, id))
		.limit(1);

	if (!row || row.userId !== session.user.id) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const updates: Partial<typeof agents.$inferInsert> = {};
	updates.updatedAt = new Date();
	if (body.name) updates.name = body.name;
	if (body.systemPrompt) updates.systemPrompt = body.systemPrompt;
	if (body.tools)
		updates.tools = JSON.stringify({ bash: body.tools.bash ?? false });
	if (body.repoUrl !== undefined) updates.repoUrl = body.repoUrl;
	if (body.repoRevision !== undefined) updates.repoRevision = body.repoRevision;
	if (body.repoDepth !== undefined) updates.repoDepth = body.repoDepth;

	if (!Object.keys(updates).length) {
		return NextResponse.json(
			{ error: "No changes provided." },
			{ status: 400 },
		);
	}

	await db.update(agents).set(updates).where(eq(agents.id, id));

	return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await context.params;
	const [row] = await db
		.select()
		.from(agents)
		.where(eq(agents.id, id))
		.limit(1);

	if (!row || row.userId !== session.user.id) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	await db.delete(agents).where(eq(agents.id, id));

	return NextResponse.json({ ok: true });
}
