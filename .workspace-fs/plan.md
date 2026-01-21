# Implementation Brief

**ToolLoopAgent with Filesystem & Browser Tools (Vercel AI SDK)**

## Goal

Build a **local autonomous agent** using **Vercel AI SDK `ToolLoopAgent`** that:

* Accepts a user task
* Iteratively reasons and acts
* Uses tools to:

  * Operate on the local filesystem (via `bash-tool`)
  * Browse the web (via `agent-browser`)
* Executes multi-step tasks until completion
* Uses **state-based reasoning**, not chat history accumulation

This agent should feel like a **state machine driven by LLM reasoning**, not a conversational chatbot.

---

## Core Design Principle (Non-Negotiable)

> **Do not grow conversation logs.
> Grow state.**

The agent **must not** repeatedly append raw assistant messages, tool outputs, or browsing results into the prompt.
Instead, it must:

* Keep a **stable system instruction**
* Maintain a **compact, explicit state**
* Inject only the **current task + relevant state snapshot** per step

---

## Mental Model

The agent is equivalent to:

```ts
while (!done) {
  input = system + state + task
  output = LLM(input)

  if (output signals completion) break

  execute tool calls
  update state
  derive next task
}
```

This is a **runtime state machine**, where:

* State transitions are decided by **LLM reasoning**
* Execution is handled by **tools**
* Safety is enforced by **code-level guards**

---

## Required Architecture

### 1. System Instructions (Stable)

Use `instructions` in `ToolLoopAgent` to define:

* Agent role
* Tool usage rules
* Completion criteria
* Output conventions

Example:

```text
You are an autonomous task-execution agent.

You operate in a loop:
- Observe the current STATE
- Decide the next ACTION
- Use tools if needed
- Update the STATE

If the task is fully completed, output exactly: DONE

Do not repeat previous actions.
Do not explain your reasoning unless required by the task.
```

This **must not change across steps** to maximize prompt caching and stability.

---

### 2. State (Explicit, Compact, Durable)

State is **owned by code**, not the model.

Represent state as a serializable object, e.g.:

```ts
type AgentState = {
  goal: string;
  plan?: string[];
  completedSteps: string[];
  filesTouched: string[];
  findings?: string;
  status: "running" | "done";
};
```

Rules:

* State must contain **facts, decisions, and progress**
* Never store:

  * Chain-of-thought
  * Raw tool output
  * Large blobs (HTML, full files, search dumps)

---

### 3. Task (Ephemeral)

Each loop has **one task**, derived from the current state.

* Initial task: user input
* Subsequent tasks: derived by code or inferred from model output

Examples:

* `"Search for documentation about X"`
* `"Modify file foo.ts to implement Y"`
* `"Verify the result and conclude"`

---

## Tool Usage Rules

### bash-tool (filesystem)

Allowed:

* Reading files
* Editing files
* Running commands relevant to the task

Forbidden:

* Blind recursive scans
* Re-running the same command without state change
* Writing files without explicit task context

After each bash execution:

* Extract **only the meaningful result**
* Update `state` (e.g., `filesTouched`, `completedSteps`)
* Discard raw stdout unless essential

---

### agent-browser (web browsing)

Allowed:

* Searching documentation
* Reading specific pages
* Extracting factual information

Forbidden:

* Dumping full HTML into state
* Re-browsing the same page without reason

After browsing:

* Summarize findings into **1–5 bullet points**
* Store summary in `state.findings`
* Discard raw page content

---

## Tool Result Handling (Critical)

Tool results **must be returned to the agent step**, but:

* They must remain **step-local**
* They must NOT be permanently appended to future prompts

Implementation guidance:

* Let `ToolLoopAgent` handle tool execution normally
* Use `onStepFinish` to:

  * Read tool results
  * Summarize / extract
  * Update state
* Next step prompt should include **only updated state**

---

## `ToolLoopAgent` Configuration

### Required Options

```ts
const agent = new ToolLoopAgent({
  model,
  instructions,
  tools: {
    bash: bashTool,
    browser: agentBrowser,
  },
  stopWhen: [
    stepCountIs(20),
    ({ lastStep }) => lastStep.text?.includes("DONE"),
  ],
});
```

### State Injection (`prepareStep`)

Use `prepareStep` to inject the current state **fresh each step**:

```ts
prepareStep: async () => ({
  messages: [
    {
      role: "system",
      content: `STATE:\n${JSON.stringify(state, null, 2)}`
    }
  ]
})
```

This ensures:

* No hidden memory
* Deterministic context
* Cache-friendly prefix

---

## State Updates (`onStepFinish`)

```ts
onStepFinish: ({ step }) => {
  if (step.toolResults?.length) {
    // summarize results
    state.completedSteps.push("Used tool X");
  }

  if (step.text?.includes("DONE")) {
    state.status = "done";
  }
}
```

Guidelines:

* Update state **only once per step**
* Never let the model mutate state directly
* Treat state as the source of truth

---

## Completion Logic

Use **two-layer termination**:

1. **Model-driven**

   * System instruction: output `DONE`
2. **Code-driven**

   * `stopWhen` guard
   * Max step count
   * Optional invariant checks

This prevents infinite loops and hallucinated completion.

---

## What NOT to Do

❌ Do NOT:

* Accumulate chat history
* Re-feed previous assistant messages
* Store raw tool output in state
* Let the model decide state structure
* Rely on implicit memory

---

## Expected Outcome

The resulting agent should:

* Feel fast and deterministic
* Be resilient to long tasks
* Scale with prompt caching
* Behave like a **runtime state machine**, not a chatbot
* Cleanly separate:

  * Reasoning (LLM)
  * Execution (tools)
  * Memory (state)

---

## Final Guiding Principle

> **Conversation is an illusion.
> State is the reality.
> The LLM is a transition function.**

---

You can hand this document directly to Cursor and ask it to:

> “Implement this agent exactly as specified, using Vercel AI SDK ToolLoopAgent, bash-tool, and agent-browser.”

If you want, next step we can:

* Design the **exact state schema**
* Add **safety invariants**
* Or optimize for **prompt caching performance**

Good luck — this is a solid architecture.
