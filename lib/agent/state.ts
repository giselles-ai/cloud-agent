import type { AgentState } from "./types";

const MAX_LIST_SIZE = 50;

export function createInitialState(task: string): AgentState {
	return {
		goal: task,
		currentTask: task,
		completedSteps: [],
		filesTouched: [],
		status: "running",
	};
}

export function appendLimited(
	list: string[],
	value: string,
	max = MAX_LIST_SIZE,
) {
	if (!value) return;
	if (list.includes(value)) return;
	list.push(value);
	if (list.length > max) {
		list.splice(0, list.length - max);
	}
}

export function truncateText(value: string, max = 200): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max)}…`;
}
