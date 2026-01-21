import { createBashTool } from "bash-tool";

const DEFAULT_INCLUDE =
	"**/*.{ts,tsx,js,mjs,cjs,json,md,mdx,css,html,txt,yml,yaml}";

export async function createBashToolkit(projectRoot: string = process.cwd()) {
	return createBashTool({
		uploadDirectory: {
			source: projectRoot,
			include: DEFAULT_INCLUDE,
		},
		maxFiles: 2000,
		onBeforeBashCall: ({ command }) => {
			const blocked =
				/rm\s+-rf\b|mkfs\b|:\s*\(\)\s*{|\bdd\s+if=|shutdown\b|reboot\b/.test(
					command,
				);
			if (blocked) {
				return { command: "echo 'Blocked dangerous command'" };
			}
			return { command };
		},
	});
}
