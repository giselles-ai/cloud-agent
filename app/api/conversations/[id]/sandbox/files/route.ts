import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getSandbox } from "@/lib/sandbox/manager";
import { conversations, sandboxInstances } from "@/lib/schema";

export const runtime = "nodejs";

type RouteContext = {
	params: Promise<{ id: string }>;
};

function validatePath(rawPath: string) {
	const normalized = rawPath.replaceAll("\\", "/").trim();
	if (!normalized) {
		return null;
	}
	if (normalized.includes("..")) {
		return null;
	}
	if (
		normalized.startsWith("/") &&
		normalized !== "/vercel/sandbox" &&
		!normalized.startsWith("/vercel/sandbox/")
	) {
		return null;
	}
	return normalized;
}

function safeFilename(path: string) {
	const name = path.split("/").pop() || "file";
	return name.replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function GET(request: Request, context: RouteContext) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await context.params;
	const convoRows = await db
		.select()
		.from(conversations)
		.where(
			and(eq(conversations.id, id), eq(conversations.userId, session.user.id)),
		);
	const convo = convoRows[0];

	if (!convo) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	if (convo.status !== "active") {
		return NextResponse.json(
			{ error: "Conversation archived" },
			{ status: 409 },
		);
	}

	const { searchParams } = new URL(request.url);
	const requestedPath = searchParams.get("path") ?? "";
	const filePath = validatePath(requestedPath);
	if (!filePath) {
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });
	}

	const sandboxRow = await db
		.select()
		.from(sandboxInstances)
		.where(
			and(
				eq(sandboxInstances.conversationId, id),
				eq(sandboxInstances.status, "running"),
			),
		)
		.orderBy(desc(sandboxInstances.createdAt))
		.limit(1);

	if (!sandboxRow[0]) {
		return NextResponse.json({ error: "Sandbox stopped" }, { status: 409 });
	}

	const sandbox = await getSandbox(sandboxRow[0].sandboxId);
	if (!sandbox) {
		return NextResponse.json({ error: "Sandbox not found" }, { status: 409 });
	}

	if (sandbox.status !== "running") {
		return NextResponse.json({ error: "Sandbox stopped" }, { status: 409 });
	}

	try {
		if (sandbox.timeout < 120_000) {
			await sandbox.extendTimeout(5 * 60_000);
		}
	} catch {
		// Ignore timeout extension errors for downloads.
	}

	const buffer = await sandbox.readFileToBuffer({
		path: filePath,
		cwd: "/vercel/sandbox/workspace",
	});
	if (!buffer) {
		return NextResponse.json({ error: "File not found" }, { status: 404 });
	}

	const headers = new Headers();
	headers.set("Content-Type", "application/octet-stream");
	headers.set(
		"Content-Disposition",
		`attachment; filename="${safeFilename(filePath)}"`,
	);
	headers.set("Content-Length", buffer.byteLength.toString());
	headers.set("Cache-Control", "no-store");

	return new Response(buffer, { status: 200, headers });
}
