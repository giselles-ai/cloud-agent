import { runAgent } from "../lib/agent";

async function main() {
	const task = process.argv.slice(2).join(" ").trim() || "README を要約して";
	const result = await runAgent({ task });

	console.log("=== Text ===");
	console.log(result.text);
	console.log("");
	console.log("=== State ===");
	console.log(JSON.stringify(result.state, null, 2));
}

main().catch((error) => {
	console.error("Agent failed:", error);
	process.exitCode = 1;
});
