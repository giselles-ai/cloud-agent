import {
	createAgentState,
	type Plan,
	type ReviewingState,
	type WaitingPlan,
} from "./state";

const pseudoLLMTask = new Promise((resolve) => {
	setTimeout(resolve, 1000);
});

async function thinkUserIntent(prompt: string) {
	await pseudoLLMTask;
	return "todo: user intent";
}

async function thinkPlans(
	prompt: string,
	userIntent: string,
	handoff: string | undefined,
) {
	await pseudoLLMTask;
	return [] as Plan[];
}

async function executePlan(plan: WaitingPlan) {
	await pseudoLLMTask;
	return "todo: result";
}

type ReviewResult = { ok: true } | { ok: false; comment: string };
async function reviewingResults(
	reviewingState: ReviewingState,
): Promise<ReviewResult> {
	await pseudoLLMTask;
	return { ok: true };
}

async function generateHandoff(
	reviewingState: ReviewingState,
	reviewComment: string,
): Promise<string | undefined> {
	await pseudoLLMTask;
	return "todo: handoff";
}

async function generateFinalOutput(reviewingState: ReviewingState) {
	await pseudoLLMTask;
	return "todo: final output";
}

async function run(prompt: string) {
	let state = createAgentState(prompt);
	while (true) {
		switch (state.state) {
			case "INIT": {
				const userIntent = await thinkUserIntent(state.prompt);
				state = {
					state: "PLANNING",
					prompt: state.prompt,
					userIntent,
				};

				break;
			}
			case "PLANNING": {
				const plans = await thinkPlans(
					state.prompt,
					state.userIntent,
					state.handoff,
				);
				state = {
					state: "EXECUTING",
					prompt: state.prompt,
					userIntent: state.userIntent,
					plans,
				};

				break;
			}
			case "EXECUTING": {
				const waitingPlanIndex = state.plans.findIndex(
					(p) => p.state === "waiting",
				);
				const waitingPlan = state.plans[waitingPlanIndex] as WaitingPlan;
				if (waitingPlan === undefined) {
					throw new Error("No waiting plan found");
				}
				try {
					const result = await executePlan(waitingPlan);
					state = {
						state: "EXECUTING",
						prompt: state.prompt,
						userIntent: state.userIntent,
						handoff: state.handoff,
						plans: [
							...state.plans.slice(0, waitingPlanIndex),
							{
								state: "completed",
								objective: waitingPlan.objective,
								result,
							},
							...state.plans.slice(waitingPlanIndex + 1),
						],
					};
				} catch (error) {
					state = {
						state: "EXECUTING",
						prompt: state.prompt,
						userIntent: state.userIntent,
						handoff: state.handoff,
						plans: [
							...state.plans.slice(0, waitingPlanIndex),
							{
								state: "failed",
								objective: waitingPlan.objective,
								error: String(error),
							},
							...state.plans.slice(waitingPlanIndex + 1),
						],
					};
				}
				if (waitingPlanIndex === state.plans.length - 1) {
					state = {
						state: "REVIEWING",
						prompt: state.prompt,
						userIntent: state.userIntent,
						handoff: state.handoff,
						plans: state.plans,
					};
				}
				break;
			}
			case "REVIEWING": {
				const reviewingState = state as ReviewingState;
				const result = await reviewingResults(reviewingState);
				if (result.ok) {
					const finalOutput = await generateFinalOutput(reviewingState);
					state = {
						state: "DONE",
						prompt: state.prompt,
						userIntent: state.userIntent,
						handoff: state.handoff,
						plans: state.plans,
						finalOutput,
					};
				} else {
					const handoff = await generateHandoff(reviewingState, result.comment);
					state = {
						state: "PLANNING",
						prompt: state.prompt,
						userIntent: state.userIntent,
						handoff,
					};
				}
				break;
			}
			case "DONE": {
				return state;
			}
			default: {
				const _exhaustiveCheck: never = state;
				throw new Error(`Unknown state: ${_exhaustiveCheck}`);
			}
		}
	}
}
