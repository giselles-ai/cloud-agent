"use client";

import { useEffect, useMemo, useState } from "react";

type Agent = {
	id: string;
	name: string;
	description?: string | null;
};

type Conversation = {
	id: string;
	agentId: string;
	status: string;
	updatedAt: number;
};

type Message = {
	id: string;
	role: string;
	content: string;
	createdAt: number;
};

async function fetchJson<T>(
	input: RequestInfo,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(input, init);
	const data = await response.json();
	if (!response.ok) {
		throw new Error(data?.error ?? "Request failed");
	}
	return data as T;
}

export default function AppPage() {
	const [agents, setAgents] = useState<Agent[]>([]);
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [messages, setMessages] = useState<Message[]>([]);
	const [selectedConversationId, setSelectedConversationId] = useState<
		string | null
	>(null);

	const [newAgentName, setNewAgentName] = useState("");
	const [newAgentDescription, setNewAgentDescription] = useState("");
	const [messageInput, setMessageInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const selectedConversation = useMemo(
		() => conversations.find((c) => c.id === selectedConversationId) ?? null,
		[conversations, selectedConversationId],
	);

	useEffect(() => {
		const loadInitial = async () => {
			try {
				const [agentRes, convoRes] = await Promise.all([
					fetchJson<{ agents: Agent[] }>("/api/agents"),
					fetchJson<{ conversations: Conversation[] }>("/api/conversations"),
				]);
				setAgents(agentRes.agents);
				setConversations(convoRes.conversations);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		};
		void loadInitial();
	}, []);

	const refreshConversations = async () => {
		const convoRes = await fetchJson<{ conversations: Conversation[] }>(
			"/api/conversations",
		);
		setConversations(convoRes.conversations);
	};

	const handleCreateAgent = async () => {
		setError(null);
		if (!newAgentName.trim()) {
			setError("Agent name is required.");
			return;
		}
		setIsLoading(true);
		try {
			const res = await fetchJson<{ agent: Agent }>("/api/agents", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: newAgentName.trim(),
					description: newAgentDescription.trim() || null,
				}),
			});
			setAgents((prev) => [res.agent, ...prev]);
			setNewAgentName("");
			setNewAgentDescription("");
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsLoading(false);
		}
	};

	const handleStartConversation = async (agentId: string) => {
		setError(null);
		setIsLoading(true);
		try {
			const res = await fetchJson<{ conversation: Conversation }>(
				"/api/conversations",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ agentId }),
				},
			);
			setConversations((prev) => [res.conversation, ...prev]);
			setSelectedConversationId(res.conversation.id);
			setMessages([]);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsLoading(false);
		}
	};

	const handleSelectConversation = async (conversationId: string) => {
		setSelectedConversationId(conversationId);
		try {
			const res = await fetchJson<{ messages: Message[] }>(
				`/api/conversations/${conversationId}/messages`,
			);
			setMessages(res.messages);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	const handleSendMessage = async () => {
		if (!selectedConversationId || !messageInput.trim()) {
			return;
		}
		setError(null);
		setIsLoading(true);
		const content = messageInput.trim();
		setMessageInput("");
		try {
			await fetchJson(`/api/conversations/${selectedConversationId}/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content }),
			});
			await handleSelectConversation(selectedConversationId);
			await refreshConversations();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			await refreshConversations();
		} finally {
			setIsLoading(false);
		}
	};

	const handleArchiveConversation = async (conversationId: string) => {
		setError(null);
		setIsLoading(true);
		try {
			await fetchJson(`/api/conversations/${conversationId}/archive`, {
				method: "POST",
			});
			await refreshConversations();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="grid gap-6 lg:grid-cols-[280px_1fr]">
			<section className="space-y-6 rounded border border-slate-800 bg-slate-900/40 p-4">
				<div>
					<h2 className="text-sm font-semibold text-slate-200">Agents</h2>
					<p className="text-xs text-slate-400">
						Create an agent to start a conversation.
					</p>
				</div>
				<div className="space-y-2">
					<input
						value={newAgentName}
						onChange={(event) => setNewAgentName(event.target.value)}
						placeholder="Agent name"
						className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
					/>
					<textarea
						value={newAgentDescription}
						onChange={(event) => setNewAgentDescription(event.target.value)}
						placeholder="Description (optional)"
						className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
						rows={3}
					/>
					<button
						type="button"
						onClick={handleCreateAgent}
						disabled={isLoading}
						className="w-full rounded bg-indigo-500 px-2 py-1 text-xs font-medium text-white disabled:opacity-70"
					>
						Create agent
					</button>
				</div>
				<div className="space-y-2">
					{agents.length === 0 ? (
						<p className="text-xs text-slate-500">No agents yet.</p>
					) : (
						agents.map((agent) => (
							<div
								key={agent.id}
								className="rounded border border-slate-800 bg-slate-950 p-2 text-xs"
							>
								<div className="font-medium text-slate-100">{agent.name}</div>
								{agent.description ? (
									<p className="text-[11px] text-slate-400">
										{agent.description}
									</p>
								) : null}
								<button
									type="button"
									onClick={() => handleStartConversation(agent.id)}
									disabled={isLoading}
									className="mt-2 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-70"
								>
									Start conversation
								</button>
							</div>
						))
					)}
				</div>
			</section>

			<section className="space-y-6">
				<div className="rounded border border-slate-800 bg-slate-900/40 p-4">
					<h2 className="text-sm font-semibold text-slate-200">
						Conversations
					</h2>
					<div className="mt-3 grid gap-2 md:grid-cols-2">
						{conversations.length === 0 ? (
							<p className="text-xs text-slate-500">No conversations yet.</p>
						) : (
							conversations.map((conversation) => (
								<button
									type="button"
									key={conversation.id}
									onClick={() => handleSelectConversation(conversation.id)}
									className={`rounded border px-3 py-2 text-left text-xs ${
										conversation.id === selectedConversationId
											? "border-indigo-500 bg-indigo-500/10"
											: "border-slate-800 bg-slate-950"
									}`}
								>
									<div className="font-medium text-slate-100">
										Conversation {conversation.id.slice(0, 6)}
									</div>
									<div className="text-[11px] text-slate-400">
										Status: {conversation.status}
									</div>
								</button>
							))
						)}
					</div>
				</div>

				<div className="rounded border border-slate-800 bg-slate-900/40 p-4">
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-semibold text-slate-200">Chat</h2>
						{selectedConversation &&
						selectedConversation.status === "active" ? (
							<button
								type="button"
								onClick={() =>
									handleArchiveConversation(selectedConversation.id)
								}
								disabled={isLoading}
								className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-70"
							>
								Archive
							</button>
						) : null}
					</div>

					{selectedConversation ? (
						<>
							<p className="mt-1 text-xs text-slate-400">
								Commands you enter run in the sandbox.
							</p>
							<div className="mt-4 space-y-3 rounded border border-slate-800 bg-slate-950 p-3 text-xs">
								{messages.length === 0 ? (
									<p className="text-slate-500">No messages yet.</p>
								) : (
									messages.map((message) => (
										<div key={message.id} className="space-y-1">
											<div className="text-[11px] uppercase tracking-wide text-slate-500">
												{message.role}
											</div>
											<pre className="whitespace-pre-wrap text-slate-200">
												{message.content}
											</pre>
										</div>
									))
								)}
							</div>

							{selectedConversation.status === "active" ? (
								<div className="mt-4 flex gap-2">
									<input
										value={messageInput}
										onChange={(event) => setMessageInput(event.target.value)}
										placeholder="Run a command (e.g. ls, node -v)"
										className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
										onKeyDown={(event) => {
											if (event.key === "Enter" && !event.shiftKey) {
												event.preventDefault();
												void handleSendMessage();
											}
										}}
									/>
									<button
										type="button"
										onClick={handleSendMessage}
										disabled={isLoading}
										className="rounded bg-indigo-500 px-3 py-2 text-sm text-white disabled:opacity-70"
									>
										Send
									</button>
								</div>
							) : (
								<p className="mt-4 text-xs text-slate-500">
									Archived: sending is disabled.
								</p>
							)}
						</>
					) : (
						<p className="mt-2 text-xs text-slate-500">
							Select a conversation.
						</p>
					)}

					{error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
				</div>
			</section>
		</div>
	);
}
