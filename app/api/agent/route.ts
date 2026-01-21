import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";

type AgentRequestBody = {
	task?: string;
	maxSteps?: number;
	modelId?: string;
};

export async function POST(request: Request) {
	const body = (await request
		.json()
		.catch(() => null)) as AgentRequestBody | null;

	if (!body?.task) {
		return NextResponse.json({ error: "task is required" }, { status: 400 });
	}

	const result = await runAgent({
		task: body.task,
		maxSteps: body.maxSteps,
		modelId: body.modelId,
	});

	return NextResponse.json(result);
}
