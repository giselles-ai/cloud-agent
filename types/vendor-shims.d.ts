declare module "ai" {
	export const gateway: (...args: unknown[]) => unknown;
	export const stepCountIs: (...args: unknown[]) => unknown;
	export const jsonSchema: (...args: unknown[]) => unknown;
	export const tool: (...args: unknown[]) => unknown;
	export class ToolLoopAgent {
		constructor(...args: unknown[]);
		generate: (params: { prompt: string }) => Promise<{ text: string }>;
	}
}

declare module "bash-tool" {
	export const createBashTool: (...args: unknown[]) => unknown;
}
