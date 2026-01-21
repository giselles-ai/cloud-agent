import { gateway, generateText, Output } from "ai";
import { z } from "zod";
import {
	type AgentState,
	createAgentState,
	type ErrorObject,
	type Plan,
	type ReviewingState,
	type WaitingPlan,
} from "./state";

const DEFAULT_MODEL_ID = "openai/gpt-5.2";

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

async function executePlan(plan: WaitingPlan) {
	const { text } = await generateText({
		model: getModel(),
		prompt: [
			"Execute the plan step WITHOUT using any tools.",
			"Return a short explanation of what would be done.",
			"",
			`Objective: ${plan.objective}`,
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
		comment: z.string().optional(),
	});
	const { output } = await generateText({
		model: getModel(),
		output: Output.object({ schema: reviewSchema }),
		prompt: [
			"Review whether the plan results satisfy the user intent.",
			"Return ok=true if satisfied. If not, set ok=false and comment with a brief reason.",
			"",
			`User prompt: ${reviewingState.prompt}`,
			`User intent: ${reviewingState.userIntent}`,
			`Plans: ${JSON.stringify(reviewingState.plans, null, 2)}`,
		].join("\n"),
	});
	if (output.ok) return { ok: true };
	return { ok: false, comment: output.comment ?? "Insufficient result" };
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

export async function run(prompt: string) {
	let state = createAgentState(prompt);
	while (true) {
		if (state.iterations >= MAX_ITERATIONS) {
			return toFailedState(state, {
				code: "MAX_ITERATIONS",
				message: `Exceeded max iterations (${MAX_ITERATIONS})`,
				stage: state.state,
			});
		}
		switch (state.state) {
			case "INIT": {
				try {
					const userIntent = await thinkUserIntent(state.prompt);
					state = {
						state: "PLANNING",
						prompt: state.prompt,
						userIntent,
						handoff: undefined,
						iterations: state.iterations + 1,
						replanCount: state.replanCount,
					};
				} catch (error) {
					return toFailedState(state, {
						code: "THINK_USER_INTENT_FAILED",
						message: String(error),
						stage: "INIT",
					});
				}

				break;
			}
			case "PLANNING": {
				try {
					const plans = await thinkPlans(
						state.prompt,
						state.userIntent,
						state.handoff,
					);
					if (plans.length === 0) {
						return toFailedState(state, {
							code: "EMPTY_PLAN",
							message: "No plans generated",
							stage: "PLANNING",
						});
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
				} catch (error) {
					return toFailedState(state, {
						code: "THINK_PLANS_FAILED",
						message: String(error),
						stage: "PLANNING",
					});
				}

				break;
			}
			case "EXECUTING": {
				const waitingPlanIndex = state.plans.findIndex(
					(p) => p.state === "waiting",
				);
				const waitingPlan = state.plans[waitingPlanIndex] as WaitingPlan;
				if (waitingPlan === undefined) {
					return toFailedState(state, {
						code: "NO_WAITING_PLAN",
						message: "No waiting plan found",
						stage: "EXECUTING",
					});
				}
				let updatedPlans: Plan[];
				try {
					const result = await executePlan(waitingPlan);
					updatedPlans = [
						...state.plans.slice(0, waitingPlanIndex),
						{
							state: "completed",
							objective: waitingPlan.objective,
							result,
						},
						...state.plans.slice(waitingPlanIndex + 1),
					];
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
				break;
			}
			case "REVIEWING": {
				const reviewingState = state as ReviewingState;
				let result: ReviewResult;
				try {
					result = await reviewingResults(reviewingState);
				} catch (error) {
					return toFailedState(state, {
						code: "REVIEW_FAILED",
						message: String(error),
						stage: "REVIEWING",
					});
				}
				if (result.ok) {
					try {
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
					} catch (error) {
						return toFailedState(state, {
							code: "FINAL_OUTPUT_FAILED",
							message: String(error),
							stage: "REVIEWING",
						});
					}
				} else {
					if (state.replanCount >= MAX_REPLANS) {
						return toFailedState(state, {
							code: "MAX_REPLANS",
							message: `Exceeded max replans (${MAX_REPLANS}): ${result.comment}`,
							stage: "REVIEWING",
						});
					}
					try {
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
					} catch (error) {
						return toFailedState(state, {
							code: "HANDOFF_FAILED",
							message: String(error),
							stage: "REVIEWING",
						});
					}
				}
				break;
			}
			case "DONE": {
				return state;
			}
			case "FAILED": {
				return state;
			}
			default: {
				const _exhaustiveCheck: never = state;
				throw new Error(`Unknown state: ${_exhaustiveCheck}`);
			}
		}
	}
}
