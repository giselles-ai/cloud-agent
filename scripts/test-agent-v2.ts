import { runAgentV2 } from "../lib/agent/v2";

async function main() {
	const task = process.argv.slice(2).join(" ").trim() || "README を要約して";
	const result = await runAgentV2({
		task,
		log: true,
		tools: true,
		maxToolSteps: 10,
	});

	console.log("=== State ===");
	console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
	console.error("Agent v2 failed:", error);
	process.exitCode = 1;
});
