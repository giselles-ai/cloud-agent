import { createAgent } from "./create-agent";
import { createInitialState } from "./state";
import type { RunAgentParams, RunAgentResult } from "./types";

const DEFAULT_MODEL_ID = "openai/gpt-5-nano";
const DEFAULT_MAX_STEPS = 20;

export async function runAgent({
	task,
	maxSteps = DEFAULT_MAX_STEPS,
	modelId = DEFAULT_MODEL_ID,
}: RunAgentParams): Promise<RunAgentResult> {
	const state = createInitialState(task);
	const { agent } = await createAgent({ state, maxSteps, modelId });

	const result = await agent.generate({ prompt: task });

	if (result.text.includes("DONE")) {
		state.status = "done";
	}

	return {
		text: result.text,
		state,
	};
}
