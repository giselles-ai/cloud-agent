import * as z from "zod";

const agentStateBase = z.object({
	state: z.string(),
});

const initialState = agentStateBase.extend({
	state: z.literal("INIT"),
	prompt: z.string(),
});

const planningState = agentStateBase.extend({
	state: z.literal("PLANNING"),
	prompt: z.string(),
	userIntent: z.string(),
	handoff: z.string().optional(),
});

const planBase = z.object({
	objective: z.string(),
	state: z.string(),
});

const WaitingPlan = planBase.extend({
	state: z.literal("waiting"),
});
export type WaitingPlan = z.infer<typeof WaitingPlan>;

const executingPlan = planBase.extend({
	state: z.literal("executing"),
});

const completedPlan = planBase.extend({
	state: z.literal("completed"),
	result: z.string(),
});

const failedPlan = planBase.extend({
	state: z.literal("failed"),
	error: z.string(),
});

const Plan = z.discriminatedUnion("state", [
	WaitingPlan,
	executingPlan,
	completedPlan,
	failedPlan,
]);
export type Plan = z.infer<typeof Plan>;

const executingState = agentStateBase.extend({
	state: z.literal("EXECUTING"),
	prompt: z.string(),
	userIntent: z.string(),
	plans: z.array(Plan),
	handoff: z.string().optional(),
});

const reviewingState = agentStateBase.extend({
	state: z.literal("REVIEWING"),
	prompt: z.string(),
	userIntent: z.string(),
	plans: z.array(Plan),
	handoff: z.string().optional(),
});
export type ReviewingState = z.infer<typeof reviewingState>;

const doneState = agentStateBase.extend({
	state: z.literal("DONE"),
	prompt: z.string(),
	userIntent: z.string(),
	plans: z.array(Plan),
	finalOutput: z.string(),
	handoff: z.string().optional(),
});

export const AgentState = z.discriminatedUnion("state", [
	initialState,
	planningState,
	executingState,
	reviewingState,
	doneState,
]);
export type AgentState = z.infer<typeof AgentState>;

export function createAgentState(prompt: string): AgentState {
	return {
		state: "INIT",
		prompt,
	};
}
