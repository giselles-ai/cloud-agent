"use client";

import type { UIDataTypes, UIMessagePart, UITools } from "ai";
import { useMemo, useState } from "react";

import { ModalDialog } from "./ModalDialog";

type MessagePartProps = {
	part: UIMessagePart<UIDataTypes, UITools>;
};

type ToolPart = UIMessagePart<UIDataTypes, UITools> & {
	type: string;
	state?: string;
	input?: Record<string, unknown>;
	output?: Record<string, unknown>;
	errorText?: string;
	toolCallId?: string;
	toolName?: string;
};

function getToolName(part: ToolPart): string {
	if (part.type === "dynamic-tool") {
		return part.toolName ?? "tool";
	}
	return part.type.replace(/^tool-/, "");
}

function renderJson(value: unknown) {
	return JSON.stringify(value, null, 2);
}

function JsonBlock({ value }: { value: unknown }) {
	if (value === undefined) {
		return <span className="text-slate-500">None</span>;
	}
	return (
		<pre className="whitespace-pre-wrap text-[11px] text-slate-200">
			{renderJson(value)}
		</pre>
	);
}

function ToolCard({
	part,
	children,
}: {
	part: ToolPart;
	children: React.ReactNode;
}) {
	const toolName = getToolName(part);
	const stateLabel = part.state ?? "unknown";
	return (
		<div className="rounded border border-slate-800 bg-slate-900/70 p-3">
			<div className="flex items-center justify-between text-[11px] text-slate-400">
				<div className="font-medium text-slate-200">{toolName}</div>
				<div className="rounded border border-slate-700 px-2 py-0.5">
					{stateLabel}
				</div>
			</div>
			<div className="mt-3 space-y-2 text-xs">{children}</div>
		</div>
	);
}

export function MessagePart({ part }: MessagePartProps) {
	// Hooks must be called at the top level, unconditionally
	const [isOpen, setIsOpen] = useState(false);

	const toolPart = part as ToolPart;
	const toolName = getToolName(toolPart);
	const input = toolPart.input ?? {};
	const output = toolPart.output ?? {};

	const content = useMemo(() => {
		if (typeof output.content === "string") {
			return output.content;
		}
		return "";
	}, [output.content]);

	if (part.type === "text") {
		return (
			<pre className="whitespace-pre-wrap text-slate-200">{part.text}</pre>
		);
	}

	if (part.type === "reasoning") {
		return (
			<details className="rounded border border-slate-800 bg-slate-900/50 px-3 py-2">
				<summary className="cursor-pointer text-[11px] uppercase tracking-wide text-slate-400">
					Reasoning
				</summary>
				<pre className="mt-2 whitespace-pre-wrap text-xs text-slate-200">
					{part.text}
				</pre>
			</details>
		);
	}

	if (part.type === "step-start") {
		return (
			<div className="flex items-center gap-2 text-[11px] text-slate-500">
				<span className="shrink-0 uppercase tracking-wide">Step</span>
				<span className="h-px flex-1 bg-slate-800" />
			</div>
		);
	}

	if (part.type === "source-url") {
		return (
			<div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs">
				<div className="text-[11px] uppercase tracking-wide text-slate-500">
					Source
				</div>
				<a
					href={part.url}
					target="_blank"
					rel="noreferrer"
					className="mt-1 block text-slate-200 underline"
				>
					{part.title ?? part.url}
				</a>
			</div>
		);
	}

	if (part.type === "source-document") {
		return (
			<div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-200">
				<div className="text-[11px] uppercase tracking-wide text-slate-500">
					Source document
				</div>
				<div className="mt-1 font-medium">{part.title}</div>
				<div className="text-[11px] text-slate-400">
					{part.filename ?? part.mediaType}
				</div>
			</div>
		);
	}

	if (part.type === "file") {
		return (
			<div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs">
				<div className="text-[11px] uppercase tracking-wide text-slate-500">
					File
				</div>
				<a
					href={part.url}
					target="_blank"
					rel="noreferrer"
					className="mt-1 block text-slate-200 underline"
				>
					{part.filename ?? part.url}
				</a>
				<div className="text-[11px] text-slate-400">{part.mediaType}</div>
			</div>
		);
	}

	if (part.type.startsWith("data-")) {
		return (
			<details className="rounded border border-slate-800 bg-slate-900/50 px-3 py-2">
				<summary className="cursor-pointer text-[11px] uppercase tracking-wide text-slate-400">
					{part.type}
				</summary>
				<div className="mt-2">
					<JsonBlock value={(part as any).data} />
				</div>
			</details>
		);
	}

	if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
		const isErrorState = toolPart.state === "output-error";
		const errorText = toolPart.errorText;

		if (toolName === "bash") {
			return (
				<ToolCard part={toolPart}>
					<div>
						<div className="text-[11px] uppercase tracking-wide text-slate-500">
							Command
						</div>
						<pre className="mt-1 whitespace-pre-wrap text-slate-200">
							{String(input.command ?? "")}
						</pre>
					</div>
					<div className="grid gap-2">
						<div>
							<div className="text-[11px] uppercase tracking-wide text-slate-500">
								Exit code
							</div>
							<div className="text-slate-200">
								{String(output.exitCode ?? "-")}
							</div>
						</div>
						<details className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1">
							<summary className="cursor-pointer text-[11px] uppercase tracking-wide text-slate-400">
								stdout
							</summary>
							<pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-200">
								{String(output.stdout ?? "") || " "}
							</pre>
						</details>
						<details className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1">
							<summary className="cursor-pointer text-[11px] uppercase tracking-wide text-slate-400">
								stderr
							</summary>
							<pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-200">
								{String(output.stderr ?? "") || " "}
							</pre>
						</details>
						{isErrorState && errorText ? (
							<div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
								{errorText}
							</div>
						) : null}
					</div>
				</ToolCard>
			);
		}

		if (toolName === "writeFile") {
			return (
				<ToolCard part={toolPart}>
					<div>
						<div className="text-[11px] uppercase tracking-wide text-slate-500">
							Path
						</div>
						<div className="text-slate-200">{String(input.path ?? "")}</div>
					</div>
					<div>
						<div className="text-[11px] uppercase tracking-wide text-slate-500">
							Result
						</div>
						<div className="text-slate-200">
							{output.success === true ? "success" : "pending"}
						</div>
					</div>
					<details className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1">
						<summary className="cursor-pointer text-[11px] uppercase tracking-wide text-slate-400">
							Content
						</summary>
						<pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-200">
							{String(input.content ?? "") || " "}
						</pre>
					</details>
				</ToolCard>
			);
		}

		if (toolName === "readFile") {
			return (
				<>
					<ToolCard part={toolPart}>
						<div className="flex items-center justify-between gap-2">
							<div>
								<div className="text-[11px] uppercase tracking-wide text-slate-500">
									Path
								</div>
								<div className="text-slate-200">{String(input.path ?? "")}</div>
							</div>
							<button
								type="button"
								onClick={() => setIsOpen(true)}
								className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
							>
								View
							</button>
						</div>
					</ToolCard>
					<ModalDialog
						open={isOpen}
						title={`readFile: ${String(input.path ?? "")}`}
						onClose={() => setIsOpen(false)}
					>
						<pre className="max-h-[60vh] whitespace-pre-wrap text-[11px] text-slate-200">
							{content || "No content available."}
						</pre>
					</ModalDialog>
				</>
			);
		}

		return (
			<ToolCard part={toolPart}>
				<div>
					<div className="text-[11px] uppercase tracking-wide text-slate-500">
						Input
					</div>
					<JsonBlock value={toolPart.input} />
				</div>
				<div>
					<div className="text-[11px] uppercase tracking-wide text-slate-500">
						Output
					</div>
					<JsonBlock value={toolPart.output} />
				</div>
				{isErrorState && errorText ? (
					<div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
						{errorText}
					</div>
				) : null}
			</ToolCard>
		);
	}

	return (
		<details className="rounded border border-slate-800 bg-slate-900/50 px-3 py-2">
			<summary className="cursor-pointer text-[11px] uppercase tracking-wide text-slate-400">
				Unsupported part
			</summary>
			<div className="mt-2">
				<JsonBlock value={part} />
			</div>
		</details>
	);
}
