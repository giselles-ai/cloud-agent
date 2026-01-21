import { run } from "./run";
import type { AgentState } from "./state";

export type RunAgentV2Params = {
	task: string;
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

export type RunAgentV2Result = AgentState;

export async function runAgentV2({
	task,
	modelId,
	log,
	tools,
	maxToolSteps,
}: RunAgentV2Params): Promise<RunAgentV2Result> {
	return run(task, { log, modelId, tools, maxToolSteps });
}

export type { AgentState, Plan, ReviewingState, WaitingPlan } from "./state";
