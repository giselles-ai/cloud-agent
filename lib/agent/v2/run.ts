import { gateway, generateText, Output, stepCountIs, ToolLoopAgent } from "ai";
import { z } from "zod";
import { createBashToolkit } from "../tools/bash";
import { browserTool } from "../tools/browser";
import {
	type AgentState,
	createAgentState,
	type ErrorObject,
	type Plan,
	type ReviewingState,
	type WaitingPlan,
} from "./state";

const DEFAULT_MODEL_ID = "openai/gpt-5-mini";

const TOOL_LIST_TEXT = [
	"Available tools (NOT executable in this phase):",
	`- bash: run shell commands`,
	`- readFile: read file contents`,
	`- writeFile: write file contents`,
	"",
	"Planning can reference these tools, but execution must be tool-free.",
].join("\n");

function getModel(modelId = DEFAULT_MODEL_ID) {
	return gateway(modelId as never);
}

async function thinkUserIntent(prompt: string) {
	const { text } = await generateText({
		model: getModel(),
		prompt: [
			"Summarize the user's intent and success criteria.",
			"Output a short, concrete statement in Japanese.",
			"",
			`User prompt: ${prompt}`,
		].join("\n"),
	});
	return text.trim();
}

async function thinkPlans(
	prompt: string,
	userIntent: string,
	handoff: string | undefined,
) {
	const planSchema = z.object({
		plans: z
			.array(
				z.object({
					objective: z.string().min(1),
				}),
			)
			.min(1),
	});

	const { output } = await generateText({
		model: getModel(),
		output: Output.object({
			schema: planSchema,
		}),
		prompt: [
			"Create a concise plan (1-5 steps) for the task.",
			"Each objective should be a single, testable action.",
			"Do not execute tools now. You may mention tools as future steps.",
			"",
			TOOL_LIST_TEXT,
			"",
			`User prompt: ${prompt}`,
			`User intent: ${userIntent}`,
			handoff ? `Handoff: ${handoff}` : "",
		]
			.filter(Boolean)
			.join("\n"),
	});

	return output.plans.map((plan) => ({
		state: "waiting",
		objective: plan.objective,
	})) as Plan[];
}

type ToolResultLike = {
	toolName: string;
	input: unknown;
	output: unknown;
};

function truncateText(value: string, max = 200): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max)}…`;
}

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
			JSON.stringify(result.input),
			JSON.stringify(result.output),
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

type StepExecState = {
	completedSteps: string[];
	filesTouched: string[];
	lastStepSummary?: string;
};

function appendLimited(list: string[], value: string, max = 50) {
	if (!value) return;
	if (list.includes(value)) return;
	list.push(value);
	if (list.length > max) {
		list.splice(0, list.length - max);
	}
}

const V2_TOOL_INSTRUCTIONS = [
	"You are an autonomous task-execution agent.",
	"Complete the single objective using tools if needed.",
	"",
	"Rules:",
	"- Do NOT output control tokens like NEXT: or DONE.",
	"- Output plain text only.",
	"- Focus on producing the final result, not meta commentary.",
].join("\n");

function buildExecutionPrompt({
	userIntent,
	overallTask,
	objective,
}: {
	userIntent: string;
	overallTask: string;
	objective: string;
}) {
	return [
		"USER_INTENT:",
		userIntent,
		"",
		"OVERALL_TASK:",
		overallTask,
		"",
		"OBJECTIVE:",
		objective,
		"",
		"Output requirements:",
		"- Plain text only (no control tokens).",
	]
		.filter(Boolean)
		.join("\n");
}

async function executePlanToolLoop({
	plan,
	overallTask,
	userIntent,
	modelId,
	maxToolSteps,
	pushLog,
}: {
	plan: WaitingPlan;
	overallTask: string;
	userIntent: string;
	modelId: string;
	maxToolSteps: number;
	pushLog: (line: string) => void;
}) {
	const { tools: bashTools } = await createBashToolkit();
	const tools = {
		...bashTools,
		browser: browserTool,
	};

	const execState: StepExecState = {
		completedSteps: [],
		filesTouched: [],
	};

	const agent = new ToolLoopAgent({
		model: getModel(modelId),
		instructions: V2_TOOL_INSTRUCTIONS,
		tools,
		stopWhen: [stepCountIs(maxToolSteps)],
		onStepFinish: ({
			text,
			toolResults,
		}: {
			text: string;
			toolResults?: ToolResultLike[];
		}) => {
			const results = (toolResults ?? []) as ToolResultLike[];
			const summaries = results.map(summarizeToolResult).filter(Boolean);
			if (summaries.length > 0) {
				execState.lastStepSummary = summaries.join(" | ");
				appendLimited(execState.completedSteps, execState.lastStepSummary);
				pushLog(`TOOL_STEP: ${execState.lastStepSummary}`);
			} else {
				pushLog("TOOL_STEP: (no tools)");
			}

			for (const file of extractFilesTouched(results)) {
				appendLimited(execState.filesTouched, file);
				pushLog(`FILE: ${file}`);
			}
			if (text) {
				pushLog("MODEL_STEP: text received");
				pushLog(`TEXT: ${text}`);
			}
		},
	});

	const result = await agent.generate({
		prompt: buildExecutionPrompt({
			userIntent,
			overallTask,
			objective: plan.objective,
		}),
	});
	if (result.text.trim() === "") {
		pushLog("MODEL_STEP: no text received");
	}
	return result.text.trim();
}

async function executePlan({
	plan,
	overallTask,
	userIntent,
	modelId,
	toolsEnabled,
	maxToolSteps,
	pushLog,
}: {
	plan: WaitingPlan;
	overallTask: string;
	userIntent: string;
	modelId: string;
	toolsEnabled: boolean;
	maxToolSteps: number;
	pushLog: (line: string) => void;
}) {
	if (toolsEnabled) {
		pushLog(
			`EXECUTE_PLAN: using tools maxToolSteps=${maxToolSteps} objective=${JSON.stringify(
				plan.objective,
			)}`,
		);
		return executePlanToolLoop({
			plan,
			overallTask,
			userIntent,
			modelId,
			maxToolSteps,
			pushLog,
		});
	}

	const { text } = await generateText({
		model: getModel(modelId),
		prompt: [
			"Execute the plan step WITHOUT using any tools.",
			"Return the final result as plain text (no control tokens).",
			"Focus on completing the objective.",
			"",
			buildExecutionPrompt({
				userIntent,
				overallTask,
				objective: plan.objective,
			}),
		].join("\n"),
	});
	return text.trim();
}

type ReviewResult = { ok: true } | { ok: false; comment: string };
async function reviewingResults(
	reviewingState: ReviewingState,
): Promise<ReviewResult> {
	const reviewSchema = z.object({
		ok: z.boolean(),
		// NOTE: Some gateways require `required` to include *all* keys in `properties`
		// for `response_format` JSON Schema. Making this optional can cause schema
		// validation failures (e.g. missing "comment" in `required`).
		//
		// Convention:
		// - ok=true  -> comment must be "" (empty string)
		// - ok=false -> comment must be a brief reason
		comment: z.string(),
	});
	const { output } = await generateText({
		model: getModel(),
		output: Output.object({ schema: reviewSchema }),
		prompt: [
			"Review whether the plan results satisfy the user intent.",
			'If satisfied, return ok=true and comment="".',
			"If not satisfied, return ok=false and comment with a brief reason.",
			"",
			`User prompt: ${reviewingState.prompt}`,
			`User intent: ${reviewingState.userIntent}`,
			`Plans: ${JSON.stringify(reviewingState.plans, null, 2)}`,
		].join("\n"),
	});
	if (output.ok) return { ok: true };
	return { ok: false, comment: output.comment || "Insufficient result" };
}

async function generateHandoff(
	reviewingState: ReviewingState,
	reviewComment: string,
): Promise<string | undefined> {
	const { text } = await generateText({
		model: getModel(),
		prompt: [
			"Create a short handoff note for replanning based on review feedback.",
			"Be concise and actionable.",
			"",
			`User prompt: ${reviewingState.prompt}`,
			`User intent: ${reviewingState.userIntent}`,
			`Review comment: ${reviewComment}`,
		].join("\n"),
	});
	return text.trim() || undefined;
}

async function generateFinalOutput(reviewingState: ReviewingState) {
	const { text } = await generateText({
		model: getModel(),
		prompt: [
			"Write the final response to the user based on the completed plan.",
			"Do not claim to have executed tools; describe results as reasoning only.",
			"",
			`User prompt: ${reviewingState.prompt}`,
			`User intent: ${reviewingState.userIntent}`,
			`Plans: ${JSON.stringify(reviewingState.plans, null, 2)}`,
		].join("\n"),
	});
	return text.trim();
}

const MAX_ITERATIONS = 50;
const MAX_REPLANS = 3;

export type RunAgentV2Options = {
	/** Model id for AI Gateway (e.g. "openai/gpt-5.2") */
	modelId?: string;
	/**
	 * Enable step-by-step logs.
	 * - true: logs are printed to console (via console.log)
	 * - (line) => void: logs are emitted to the provided sink
	 */
	log?: boolean | ((line: string) => void);
	/**
	 * Enable tool execution for each plan step (ToolLoopAgent).
	 * When disabled, v2 will be tool-free (reasoning only).
	 */
	tools?: boolean;
	/** Max tool-loop steps per plan step when tools are enabled. */
	maxToolSteps?: number;
};

function createLogSink(log: RunAgentV2Options["log"]): {
	enabled: boolean;
	write: (line: string) => void;
} {
	if (log === true) {
		return { enabled: true, write: (line) => console.log(line) };
	}
	if (typeof log === "function") {
		return { enabled: true, write: log };
	}
	return { enabled: false, write: () => {} };
}

function formatLog(line: string) {
	return `[agent:v2] ${line}`;
}

function toFailedState(state: AgentState, error: ErrorObject): AgentState {
	return {
		state: "FAILED",
		prompt: state.prompt,
		userIntent: "userIntent" in state ? state.userIntent : undefined,
		plans: "plans" in state ? state.plans : undefined,
		handoff: "handoff" in state ? state.handoff : undefined,
		error,
		iterations: state.iterations,
		replanCount: state.replanCount,
	};
}

export async function run(prompt: string, options: RunAgentV2Options = {}) {
	const sink = createLogSink(options.log);
	const logs: string[] = [];
	const modelId = options.modelId ?? DEFAULT_MODEL_ID;
	const toolsEnabled = options.tools ?? false;
	const maxToolSteps = options.maxToolSteps ?? 10;
	const pushLog = (line: string) => {
		if (!sink.enabled) return;
		const formatted = formatLog(line);
		logs.push(formatted);
		sink.write(formatted);
	};

	let state = createAgentState(prompt);
	while (true) {
		if (state.iterations >= MAX_ITERATIONS) {
			const failed = toFailedState(state, {
				code: "MAX_ITERATIONS",
				message: `Exceeded max iterations (${MAX_ITERATIONS})`,
				stage: state.state,
			});
			if (sink.enabled) failed.logs = logs;
			pushLog(`FAILED code=MAX_ITERATIONS stage=${state.state}`);
			return failed;
		}
		switch (state.state) {
			case "INIT": {
				try {
					pushLog("INIT: thinking user intent");
					const userIntent = await thinkUserIntent(state.prompt);
					state = {
						state: "PLANNING",
						prompt: state.prompt,
						userIntent,
						handoff: undefined,
						iterations: state.iterations + 1,
						replanCount: state.replanCount,
					};
					if (sink.enabled) state.logs = logs;
					pushLog(`PLANNING: userIntent=${JSON.stringify(userIntent)}`);
				} catch (error) {
					const failed = toFailedState(state, {
						code: "THINK_USER_INTENT_FAILED",
						message: String(error),
						stage: "INIT",
					});
					if (sink.enabled) failed.logs = logs;
					pushLog(
						`FAILED code=THINK_USER_INTENT_FAILED stage=INIT message=${JSON.stringify(String(error))}`,
					);
					return failed;
				}

				break;
			}
			case "PLANNING": {
				try {
					pushLog(
						`PLANNING: generating plans replanCount=${state.replanCount}${
							state.handoff ? " (handoff present)" : ""
						}`,
					);
					const plans = await thinkPlans(
						state.prompt,
						state.userIntent,
						state.handoff,
					);
					if (plans.length === 0) {
						const failed = toFailedState(state, {
							code: "EMPTY_PLAN",
							message: "No plans generated",
							stage: "PLANNING",
						});
						if (sink.enabled) failed.logs = logs;
						pushLog("FAILED code=EMPTY_PLAN stage=PLANNING");
						return failed;
					}
					state = {
						state: "EXECUTING",
						prompt: state.prompt,
						userIntent: state.userIntent,
						handoff: state.handoff,
						plans,
						iterations: state.iterations + 1,
						replanCount: state.replanCount,
					};
					if (sink.enabled) state.logs = logs;
					pushLog(
						`EXECUTING: plans=${JSON.stringify(plans.map((p) => p.objective))}`,
					);
				} catch (error) {
					const failed = toFailedState(state, {
						code: "THINK_PLANS_FAILED",
						message: String(error),
						stage: "PLANNING",
					});
					if (sink.enabled) failed.logs = logs;
					pushLog(
						`FAILED code=THINK_PLANS_FAILED stage=PLANNING message=${JSON.stringify(String(error))}`,
					);
					return failed;
				}

				break;
			}
			case "EXECUTING": {
				const waitingPlanIndex = state.plans.findIndex(
					(p) => p.state === "waiting",
				);
				const waitingPlan = state.plans[waitingPlanIndex] as WaitingPlan;
				if (waitingPlan === undefined) {
					const failed = toFailedState(state, {
						code: "NO_WAITING_PLAN",
						message: "No waiting plan found",
						stage: "EXECUTING",
					});
					if (sink.enabled) failed.logs = logs;
					pushLog("FAILED code=NO_WAITING_PLAN stage=EXECUTING");
					return failed;
				}
				let updatedPlans: Plan[];
				try {
					pushLog(
						`EXECUTING: step=${waitingPlanIndex + 1}/${
							state.plans.length
						} objective=${JSON.stringify(waitingPlan.objective)}`,
					);
					const result = await executePlan({
						plan: waitingPlan,
						overallTask: state.prompt,
						userIntent: state.userIntent,
						modelId,
						toolsEnabled,
						maxToolSteps,
						pushLog,
					});
					updatedPlans = [
						...state.plans.slice(0, waitingPlanIndex),
						{
							state: "completed",
							objective: waitingPlan.objective,
							result,
						},
						...state.plans.slice(waitingPlanIndex + 1),
					];
					pushLog(`EXECUTING: completed step=${waitingPlanIndex + 1} ok=true`);
				} catch (error) {
					updatedPlans = [
						...state.plans.slice(0, waitingPlanIndex),
						{
							state: "failed",
							objective: waitingPlan.objective,
							error: String(error),
						},
						...state.plans.slice(waitingPlanIndex + 1),
					];
					pushLog(
						`EXECUTING: completed step=${waitingPlanIndex + 1} ok=false error=${JSON.stringify(
							String(error),
						)}`,
					);
				}

				const hasWaiting = updatedPlans.some(
					(plan) => plan.state === "waiting",
				);
				state = hasWaiting
					? {
							state: "EXECUTING",
							prompt: state.prompt,
							userIntent: state.userIntent,
							handoff: state.handoff,
							plans: updatedPlans,
							iterations: state.iterations + 1,
							replanCount: state.replanCount,
						}
					: {
							state: "REVIEWING",
							prompt: state.prompt,
							userIntent: state.userIntent,
							handoff: state.handoff,
							plans: updatedPlans,
							iterations: state.iterations + 1,
							replanCount: state.replanCount,
						};
				if (sink.enabled) state.logs = logs;
				break;
			}
			case "REVIEWING": {
				const reviewingState = state as ReviewingState;
				let result: ReviewResult;
				try {
					pushLog("REVIEWING: reviewing results");
					result = await reviewingResults(reviewingState);
				} catch (error) {
					const failed = toFailedState(state, {
						code: "REVIEW_FAILED",
						message: String(error),
						stage: "REVIEWING",
					});
					if (sink.enabled) failed.logs = logs;
					pushLog(
						`FAILED code=REVIEW_FAILED stage=REVIEWING message=${JSON.stringify(String(error))}`,
					);
					return failed;
				}
				pushLog(
					result.ok
						? "REVIEWING: ok=true"
						: `REVIEWING: ok=false comment=${JSON.stringify(result.comment)}`,
				);
				if (result.ok) {
					try {
						pushLog("DONE: generating final output");
						const finalOutput = await generateFinalOutput(reviewingState);
						state = {
							state: "DONE",
							prompt: state.prompt,
							userIntent: state.userIntent,
							handoff: state.handoff,
							plans: state.plans,
							finalOutput,
							iterations: state.iterations + 1,
							replanCount: state.replanCount,
						};
						if (sink.enabled) state.logs = logs;
					} catch (error) {
						const failed = toFailedState(state, {
							code: "FINAL_OUTPUT_FAILED",
							message: String(error),
							stage: "REVIEWING",
						});
						if (sink.enabled) failed.logs = logs;
						pushLog(
							`FAILED code=FINAL_OUTPUT_FAILED stage=REVIEWING message=${JSON.stringify(String(error))}`,
						);
						return failed;
					}
				} else {
					if (state.replanCount >= MAX_REPLANS) {
						const failed = toFailedState(state, {
							code: "MAX_REPLANS",
							message: `Exceeded max replans (${MAX_REPLANS}): ${result.comment}`,
							stage: "REVIEWING",
						});
						if (sink.enabled) failed.logs = logs;
						pushLog("FAILED code=MAX_REPLANS stage=REVIEWING");
						return failed;
					}
					try {
						pushLog("REVIEWING: generating handoff for replanning");
						const handoff = await generateHandoff(
							reviewingState,
							result.comment,
						);
						state = {
							state: "PLANNING",
							prompt: state.prompt,
							userIntent: state.userIntent,
							handoff,
							iterations: state.iterations + 1,
							replanCount: state.replanCount + 1,
						};
						if (sink.enabled) state.logs = logs;
					} catch (error) {
						const failed = toFailedState(state, {
							code: "HANDOFF_FAILED",
							message: String(error),
							stage: "REVIEWING",
						});
						if (sink.enabled) failed.logs = logs;
						pushLog(
							`FAILED code=HANDOFF_FAILED stage=REVIEWING message=${JSON.stringify(String(error))}`,
						);
						return failed;
					}
				}
				break;
			}
			case "DONE": {
				if (sink.enabled) state.logs = logs;
				pushLog("DONE: returning state");
				return state;
			}
			case "FAILED": {
				if (sink.enabled) state.logs = logs;
				pushLog("FAILED: returning state");
				return state;
			}
			default: {
				const _exhaustiveCheck: never = state;
				throw new Error(`Unknown state: ${_exhaustiveCheck}`);
			}
		}
	}
}
