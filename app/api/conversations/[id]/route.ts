import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { conversations } from "@/lib/schema";

export const runtime = "nodejs";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await context.params;
	const row = await db
		.select()
		.from(conversations)
		.where(
			and(
				eq(conversations.id, id),
				eq(conversations.userId, session.user.id),
			),
		);

	if (!row[0]) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json({ conversation: row[0] });
}
