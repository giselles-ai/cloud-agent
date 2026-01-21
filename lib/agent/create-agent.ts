import { gateway, stepCountIs, ToolLoopAgent } from "ai";
import { AGENT_INSTRUCTIONS } from "./instructions";
import { appendLimited, truncateText } from "./state";
import { createBashToolkit } from "./tools/bash";
import { browserTool } from "./tools/browser";
import type { AgentState } from "./types";

type CreateAgentParams = {
	state: AgentState;
	maxSteps: number;
	modelId: string;
};

type ToolResultLike = {
	toolName: string;
	input: unknown;
	output: unknown;
};

function summarizeToolResult(result: ToolResultLike): string {
	if (result.toolName === "bash") {
		const output = result.output as {
			stdout?: string;
			stderr?: string;
			exitCode?: number;
		};
		const stdout = output.stdout ? truncateText(output.stdout, 120) : "";
		const stderr = output.stderr ? truncateText(output.stderr, 120) : "";
		return [
			"bash",
			output.exitCode !== undefined ? `exit=${output.exitCode}` : undefined,
			stdout ? `stdout=${stdout}` : undefined,
			stderr ? `stderr=${stderr}` : undefined,
		]
			.filter(Boolean)
			.join(" ");
	}

	if (result.toolName === "readFile" || result.toolName === "writeFile") {
		const input = result.input as { path?: string };
		return `${result.toolName} ${input.path ?? ""}`.trim();
	}

	if (result.toolName === "browser") {
		const output = result.output as { ok?: boolean; error?: string };
		return output.ok
			? "browser ok"
			: `browser error: ${output.error ?? "unknown"}`;
	}

	return result.toolName;
}

function extractFilesTouched(results: ToolResultLike[]): string[] {
	const files: string[] = [];
	for (const result of results) {
		if (result.toolName === "readFile" || result.toolName === "writeFile") {
			const input = result.input as { path?: string };
			if (input.path) files.push(input.path);
		}
	}
	return files;
}

function getNextTaskFromText(text: string): string | undefined {
	const match = text.match(/^\s*NEXT:\s*(.+)\s*$/m);
	return match?.[1]?.trim() || undefined;
}

function buildUserPrompt(state: AgentState) {
	return [
		"STATE:",
		JSON.stringify(state, null, 2),
		"",
		`TASK: ${state.currentTask}`,
		"",
		state.lastStepSummary ? `LAST_STEP: ${state.lastStepSummary}` : "",
	]
		.filter(Boolean)
		.join("\n");
}

export async function createAgent({
	state,
	maxSteps,
	modelId,
}: CreateAgentParams) {
	const { tools: bashTools } = await createBashToolkit();

	const tools = {
		...bashTools,
		browser: browserTool,
	};

	const agent = new ToolLoopAgent({
		model: gateway(modelId as never),
		instructions: AGENT_INSTRUCTIONS,
		tools,
		stopWhen: [
			stepCountIs(maxSteps),
			({ lastStep }) => Boolean(lastStep?.text?.includes("DONE")),
		],
		prepareStep: async () => {
			return {
				messages: [
					{
						role: "user",
						content: buildUserPrompt(state),
					},
				],
			};
		},
		onStepFinish: ({ text, toolResults }) => {
			const results = (toolResults ?? []) as ToolResultLike[];
			const summaries = results.map(summarizeToolResult).filter(Boolean);
			if (summaries.length > 0) {
				state.lastStepSummary = summaries.join(" | ");
				appendLimited(state.completedSteps, state.lastStepSummary);
			}

			for (const file of extractFilesTouched(results)) {
				appendLimited(state.filesTouched, file);
			}

			const nextTask = getNextTaskFromText(text);
			if (nextTask) {
				state.currentTask = nextTask;
			}

			if (text.includes("DONE")) {
				state.status = "done";
			}
		},
	});

	return { agent, tools };
}
