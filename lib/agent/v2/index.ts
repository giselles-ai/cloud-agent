import { run } from "./run";
import type { AgentState } from "./state";

export type RunAgentV2Params = {
	task: string;
};

export type RunAgentV2Result = AgentState;

export async function runAgentV2({
	task,
}: RunAgentV2Params): Promise<RunAgentV2Result> {
	return run(task);
}

export type { AgentState, Plan, ReviewingState, WaitingPlan } from "./state";
