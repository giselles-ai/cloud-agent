export type AgentStatus = "running" | "done";

export type AgentState = {
	goal: string;
	currentTask: string;
	plan?: string[];
	completedSteps: string[];
	filesTouched: string[];
	findings?: string;
	lastStepSummary?: string;
	status: AgentStatus;
};

export type RunAgentParams = {
	task: string;
	maxSteps?: number;
	modelId?: string;
};

export type RunAgentResult = {
	text: string;
	state: AgentState;
};
