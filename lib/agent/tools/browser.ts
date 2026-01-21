import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { jsonSchema, tool } from "ai";

const execFileAsync = promisify(execFile);

const JSON_CAPABLE_COMMANDS = new Set([
	"snapshot",
	"get",
	"is",
	"tab",
	"cookies",
	"storage",
	"network",
	"console",
	"errors",
]);

const ALLOWED_COMMANDS = new Set([
	"open",
	"snapshot",
	"click",
	"dblclick",
	"focus",
	"type",
	"fill",
	"press",
	"hover",
	"select",
	"check",
	"uncheck",
	"scroll",
	"scrollintoview",
	"drag",
	"upload",
	"get",
	"wait",
	"tab",
	"close",
	"back",
	"forward",
	"reload",
	"screenshot",
]);

const DEFAULT_SNAPSHOT_ARGS = ["-i", "-c", "-d", "5"];

const TOOL_INPUT_SCHEMA = jsonSchema({
	type: "object",
	properties: {
		command: {
			type: "string",
			description: "agent-browser command, e.g. snapshot, open, click",
		},
		args: {
			type: "array",
			items: { type: "string" },
			description: "arguments for the command",
		},
		json: {
			type: "boolean",
			description: "request JSON output when supported",
			default: true,
		},
	},
	required: ["command"],
});

function truncateOutput(value: string, max = 4000) {
	if (value.length <= max) return value;
	return `${value.slice(0, max)}... [truncated]`;
}

function buildArgs(command: string, args?: string[], json?: boolean) {
	const nextArgs: string[] = [];
	if (command === "snapshot" && (!args || args.length === 0)) {
		nextArgs.push(...DEFAULT_SNAPSHOT_ARGS);
	}
	if (args) {
		nextArgs.push(...args);
	}
	if (json && JSON_CAPABLE_COMMANDS.has(command)) {
		nextArgs.push("--json");
	}
	return nextArgs;
}

export const browserTool = tool({
	description:
		"Run agent-browser CLI commands. Prefer snapshot -> refs -> actions. Use JSON output when supported.",
	inputSchema: TOOL_INPUT_SCHEMA,
	execute: async ({
		command,
		args,
		json,
	}: {
		command: string;
		args?: string[];
		json?: boolean;
	}) => {
		if (!ALLOWED_COMMANDS.has(command)) {
			return {
				ok: false,
				exitCode: 1,
				error: `Unsupported command: ${command}`,
			};
		}

		const finalArgs = [command, ...buildArgs(command, args, json ?? true)];

		try {
			const { stdout, stderr } = await execFileAsync(
				"agent-browser",
				finalArgs,
				{
					timeout: 30_000,
					maxBuffer: 1024 * 1024 * 2,
				},
			);

			const trimmedStdout = truncateOutput(stdout.trim());
			const trimmedStderr = truncateOutput(stderr.trim());
			let data: unknown;

			if ((json ?? true) && JSON_CAPABLE_COMMANDS.has(command)) {
				try {
					data = trimmedStdout ? JSON.parse(trimmedStdout) : undefined;
				} catch {
					data = undefined;
				}
			}

			return {
				ok: true,
				exitCode: 0,
				stdout: trimmedStdout || undefined,
				stderr: trimmedStderr || undefined,
				data,
			};
		} catch (error) {
			const err = error as {
				message?: string;
				stdout?: string;
				stderr?: string;
			};
			const message = err?.message ?? "agent-browser failed";
			const stdout = err?.stdout
				? truncateOutput(String(err.stdout).trim())
				: undefined;
			const stderr = err?.stderr
				? truncateOutput(String(err.stderr).trim())
				: undefined;
			return {
				ok: false,
				exitCode: 1,
				error: message,
				stdout,
				stderr,
			};
		}
	},
});
