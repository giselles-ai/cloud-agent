import { stepCountIs, ToolLoopAgent } from "ai";
import { createBashTool } from "bash-tool";

const { tools } = await createBashTool({
	uploadDirectory: {
		source: ".",
		include:
			"{README.md,package.json,app/**/*.{ts,tsx,js,mjs,cjs,json,md,mdx,css,html,txt,yml,yaml},lib/**/*.{ts,tsx,js,mjs,cjs,json,md,mdx,css,html,txt,yml,yaml},scripts/**/*.{ts,tsx,js,mjs,cjs,json,md,mdx,css,html,txt,yml,yaml}}",
	},
});

const agent = new ToolLoopAgent({
	model: "openai/gpt-5.2",
	tools,
	// Or use just the bash tool as tools: {bash: tools.bash}
	stopWhen: stepCountIs(20),
	prepareStep: (s) => {
		console.log(JSON.stringify(s.messages));
		return s;
	},
	onStepFinish: (step) => {
		console.log(`Step finished`);
	},
});

const stream = await agent.stream({
	prompt: "Analyze the project and create a summary report",
});

for await (const chunk of stream.toUIMessageStream()) {
	process.stdout.write(JSON.stringify(chunk));
}
