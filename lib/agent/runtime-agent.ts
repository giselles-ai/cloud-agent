import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { Sandbox } from "@vercel/sandbox";
import { stepCountIs, ToolLoopAgent } from "ai";
import { createBashTool } from "bash-tool";

const DEFAULT_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

const gateway = createOpenAICompatible({
	name: "openai",
	apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
	baseURL: process.env.AI_GATEWAY_BASE_URL ?? DEFAULT_BASE_URL,
});

type AgentConfig = {
	systemPrompt?: string | null;
	description?: string | null;
	tools?: string | null;
};

function resolveInstructions(agent: AgentConfig): string {
	const prompt = agent.systemPrompt?.trim() || agent.description?.trim();
	return prompt || "You are a helpful assistant.";
}

function resolveToolConfig(agent: AgentConfig): { bash: boolean } {
	if (!agent.tools) {
		return { bash: true };
	}
	try {
		const parsed = JSON.parse(agent.tools) as { bash?: boolean } | null;
		return { bash: parsed?.bash ?? true };
	} catch {
		return { bash: true };
	}
}

export async function buildConversationAgent({
	agent,
	sandbox,
}: {
	agent: AgentConfig;
	sandbox: Sandbox;
}) {
	const toolsConfig = resolveToolConfig(agent);
	const { tools } = await createBashTool({ sandbox });
	const modelName = process.env.AI_GATEWAY_MODEL ?? DEFAULT_MODEL;

	const agentInstance = new ToolLoopAgent({
		model: gateway(modelName),
		instructions: resolveInstructions(agent),
		tools,
		stopWhen: stepCountIs(20),
	});

	return {
		agent: agentInstance,
		toolsEnabled: toolsConfig,
	};
}
