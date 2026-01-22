import { randomUUID } from "node:crypto";
import { createAgentUIStreamResponse, type UIMessage } from "ai";
import { and, asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { buildConversationAgent } from "@/lib/agent/runtime-agent";
import { getSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getSandbox } from "@/lib/sandbox/manager";
import {
	agents,
	conversations,
	messages,
	sandboxInstances,
} from "@/lib/schema";

export const runtime = "nodejs";

type StoredMessageRow = typeof messages.$inferSelect;

type IncomingBody = {
	conversationId?: string;
	message?: UIMessage;
	messages?: UIMessage[];
};

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

function parseStoredUiMessage(metadata: string | null): UIMessage | null {
	if (!metadata) {
		return null;
	}
	try {
		const parsed = JSON.parse(metadata) as {
			uiMessage?: UIMessage;
		} | null;
		if (parsed?.uiMessage?.parts && parsed.uiMessage.role) {
			return parsed.uiMessage;
		}
		if (
			(parsed as UIMessage | null)?.parts &&
			(parsed as UIMessage | null)?.role
		) {
			return parsed as UIMessage;
		}
	} catch {
		return null;
	}
	return null;
}

function rowToUiMessage(row: StoredMessageRow): UIMessage {
	const stored = parseStoredUiMessage(row.metadata ?? null);
	if (stored) {
		return stored;
	}
	return {
		id: row.id,
		role: row.role as UIMessage["role"],
		parts: [
			{
				type: "text",
				text: row.content,
			},
		],
	};
}

function textFromMessage(message: UIMessage): string {
	const text = message.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("");
	const fallback =
		typeof (message as { content?: unknown }).content === "string"
			? ((message as { content?: string }).content ?? "")
			: "";
	return text || fallback || "";
}

function serializeUiMessage(message: UIMessage) {
	return JSON.stringify({ uiMessage: message });
}

async function persistMessages(
	conversationId: string,
	uiMessages: UIMessage[],
	sandboxInstanceId: string,
) {
	const existingRows = await db
		.select({ id: messages.id })
		.from(messages)
		.where(eq(messages.conversationId, conversationId));
	const existingIds = new Set(existingRows.map((row) => row.id));
	const now = new Date();

	const inserts: Array<typeof messages.$inferInsert> = [];
	const updates: Array<{ id: string; content: string; metadata: string }> = [];

	for (const message of uiMessages) {
		const content = textFromMessage(message);
		const metadata = serializeUiMessage(message);
		const id = message.id ?? randomUUID();
		if (existingIds.has(id)) {
			updates.push({ id, content, metadata });
		} else {
			inserts.push({
				id,
				conversationId,
				role: message.role,
				content,
				metadata,
				createdAt: now,
			});
		}
	}

	if (inserts.length > 0) {
		await db.insert(messages).values(inserts);
	}
	for (const update of updates) {
		await db
			.update(messages)
			.set({ content: update.content, metadata: update.metadata })
			.where(eq(messages.id, update.id));
	}

	await db
		.update(conversations)
		.set({ updatedAt: now })
		.where(eq(conversations.id, conversationId));

	await db
		.update(sandboxInstances)
		.set({ updatedAt: now })
		.where(eq(sandboxInstances.id, sandboxInstanceId));
}

export async function POST(request: Request) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!process.env.AI_GATEWAY_API_KEY) {
		return NextResponse.json(
			{ error: "AI gateway is not configured." },
			{ status: 500 },
		);
	}

	const body = (await request.json().catch(() => null)) as IncomingBody | null;
	const conversationId =
		typeof body?.conversationId === "string" ? body.conversationId : null;

	if (!conversationId) {
		return NextResponse.json(
			{ error: "conversationId is required." },
			{ status: 400 },
		);
	}

	const convoRows = await db
		.select()
		.from(conversations)
		.where(
			and(
				eq(conversations.id, conversationId),
				eq(conversations.userId, session.user.id),
			),
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

	const sandboxRow = await db
		.select()
		.from(sandboxInstances)
		.where(
			and(
				eq(sandboxInstances.conversationId, conversationId),
				eq(sandboxInstances.status, "running"),
			),
		)
		.orderBy(desc(sandboxInstances.createdAt))
		.limit(1);

	if (!sandboxRow[0]) {
		await archiveConversation(conversationId);
		return NextResponse.json(
			{ error: "Sandbox stopped", archived: true },
			{ status: 409 },
		);
	}

	const sandbox = await getSandbox(sandboxRow[0].sandboxId);
	if (!sandbox) {
		await archiveConversation(conversationId);
		return NextResponse.json(
			{ error: "Sandbox not found", archived: true },
			{ status: 409 },
		);
	}

	if (sandbox.status !== "running") {
		await archiveConversation(conversationId);
		return NextResponse.json(
			{ error: "Sandbox stopped", archived: true },
			{ status: 409 },
		);
	}

	const agentRow = await db
		.select()
		.from(agents)
		.where(eq(agents.id, convo.agentId));
	const agent = agentRow[0];

	if (!agent || agent.userId !== session.user.id) {
		return NextResponse.json({ error: "Agent not found" }, { status: 404 });
	}

	const rows = await db
		.select()
		.from(messages)
		.where(eq(messages.conversationId, conversationId))
		.orderBy(asc(messages.createdAt));

	const storedMessages = rows.map(rowToUiMessage);
	const incomingMessages = Array.isArray(body?.messages) ? body.messages : [];
	const incomingMessage = body?.message;

	let uiMessages = storedMessages;
	if (incomingMessages.length > 0) {
		uiMessages = incomingMessages;
	} else if (incomingMessage) {
		uiMessages = [
			...storedMessages.filter((message) => message.id !== incomingMessage.id),
			incomingMessage,
		];
	}

	const { agent: conversationAgent } = await buildConversationAgent({
		agent,
		sandbox,
	});

	return createAgentUIStreamResponse({
		agent: conversationAgent,
		uiMessages,
		onFinish: async ({ messages: finishedMessages }) => {
			await persistMessages(conversationId, finishedMessages, sandboxRow[0].id);
		},
	});
}
