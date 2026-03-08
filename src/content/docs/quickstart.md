---
title: Quickstart
description: Get a JamJet workflow running in 60 seconds — no server, no config, just Python.
sidebar:
  order: 1
---

import { Aside, Steps, Tabs, TabItem } from '@astrojs/starlight/components';

# Quickstart

## 60-second start

No server. No config. No Pydantic. Just Python.

```bash
pip install jamjet
```

```python
# agent.py
from jamjet import task, tool

@tool
async def web_search(query: str) -> str:
    """Search the web for current information."""
    # plug in your actual search implementation
    return f"Results for: {query}"

@task(model="claude-sonnet-4-6", tools=[web_search])
async def research(question: str) -> str:
    """You are a research assistant. Search first, then summarize clearly."""

import asyncio
result = asyncio.run(research("What is JamJet?"))
print(result)
```

```bash
ANTHROPIC_API_KEY=sk-ant-... python agent.py
```

That's it. The `@tool` decorator exposes any Python function to the agent. The `@task` docstring becomes the agent's instructions. Works with OpenAI, Anthropic, Ollama, Groq — any model.

<Aside type="tip">
**Using Ollama locally? No API key needed:**
```bash
OPENAI_API_KEY=ollama OPENAI_BASE_URL=http://localhost:11434/v1 python agent.py
```
Change `model=` to any Ollama model (e.g. `"llama3.2"`).
</Aside>

---

## What you get

- **`@tool`** — turns any async Python function into an agent tool, with automatic schema generation
- **`@task`** — docstring = agent instructions, function signature = input contract
- **Durable execution** — crash and resume from where it stopped (with `jamjet dev`)
- **Enforced limits** — `max_iterations`, `max_cost_usd`, `timeout_seconds` are first-class params

No boilerplate. No state classes. No dependency injection.

<Aside type="note">
Need full graph control — multi-step pipelines, conditional routing, human-in-the-loop?
Use the [`Workflow` API](/python-sdk) or [YAML workflows](/yaml-workflows) for complex orchestration.
</Aside>

---

## Try the examples

Four self-contained examples in the [jamjet-benchmarks repo](https://github.com/jamjet-labs/jamjet-benchmarks/tree/main/examples) — each runs locally with Ollama:

| Example | What it shows |
|---------|--------------|
| [01 — Pipeline with timeline](https://github.com/jamjet-labs/jamjet-benchmarks/tree/main/examples/01_pipeline_with_timeline) | Per-step execution timeline, automatic |
| [02 — Conditional routing](https://github.com/jamjet-labs/jamjet-benchmarks/tree/main/examples/02_conditional_routing) | Routing as plain Python predicates |
| [03 — Eval harness](https://github.com/jamjet-labs/jamjet-benchmarks/tree/main/examples/03_eval_harness) | Built-in scoring, LLM-as-judge |
| [04 — Self-evaluating workflow](https://github.com/jamjet-labs/jamjet-benchmarks/tree/main/examples/04_self_evaluating_workflow) | Draft → judge → retry loop |

```bash
git clone https://github.com/jamjet-labs/jamjet-benchmarks
cd jamjet-benchmarks/examples/01_pipeline_with_timeline
pip install -r requirements.txt
OPENAI_API_KEY=ollama OPENAI_BASE_URL=http://localhost:11434/v1 MODEL_NAME=llama3.2 python main.py
```

---

## Scaffold a full project

Use templates to start a more complete project:

```bash
jamjet init my-agent --template hello-agent
cd my-agent
```

Available templates:

```bash
jamjet init my-agent --list-templates
# hello-agent           Minimal Q&A workflow
# research-agent        Web search + synthesis (Brave Search MCP)
# rag-assistant         RAG with filesystem MCP
# mcp-tool-consumer     Connect to any MCP tool server
# mcp-tool-provider     Expose Python functions as MCP tools
# code-reviewer         GitHub PR review with quality scoring
# hitl-approval         Human-in-the-loop approval gate
# multi-agent-review    Writer + critic review loop
# a2a-delegator         Delegate tasks via A2A protocol
# a2a-server            Serve A2A requests from external agents
# approval-workflow     Durable approval with 24h timeout
```

---

## Add the durable runtime (production)

The in-process executor (`wf.run_sync`) is great for development. For production — crash recovery, multi-instance scheduling, durable state — start the runtime server:

```bash
jamjet dev
```

```
▶ JamJet Dev Runtime
  Port:  7700
  Mode:  local (SQLite)
  API:   http://localhost:7700
```

Then run workflows through it:

```bash
jamjet run workflow.yaml --input '{"query": "What is JamJet?"}'
```

```
✓ node_completed   think   gpt-4o-mini  512ms
✓ Execution completed.
```

Crash mid-execution? Resume from exactly where it stopped — no re-running earlier steps, no wasted API calls.

---

## Set your API key

<Tabs>
<TabItem label="OpenAI">
```bash
export OPENAI_API_KEY=sk-...
```
</TabItem>
<TabItem label="Anthropic">
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```
</TabItem>
<TabItem label="Ollama (free, local)">
```bash
export OPENAI_API_KEY=ollama
export OPENAI_BASE_URL=http://localhost:11434/v1
# ollama pull llama3.2
```
</TabItem>
<TabItem label="Groq">
```bash
export OPENAI_API_KEY=gsk_...
export OPENAI_BASE_URL=https://api.groq.com/openai/v1
```
</TabItem>
</Tabs>

---

## Next steps

<Steps>
1. [Core Concepts](/concepts) — agents, nodes, state, and durability
2. [Python SDK](/python-sdk) — decorators, routing, parallel steps
3. [Workflow Authoring](/yaml-workflows) — all node types, retry policies, conditions
4. [MCP Integration](/mcp) — connect to external tool servers in one line
5. [Eval Harness](/eval) — test your agents like software
</Steps>

---

## Troubleshooting

**`jamjet` not found after install?**
Make sure your Python scripts directory is in your PATH. Try `python -m jamjet`.

**Connection refused at port 7700?**
`jamjet dev` must be running before you use `jamjet run`. The in-process `wf.run_sync()` path needs no server.

**Need help?** Open a [GitHub Discussion](https://github.com/jamjet-labs/jamjet/discussions) or [file an issue](https://github.com/jamjet-labs/jamjet/issues).
