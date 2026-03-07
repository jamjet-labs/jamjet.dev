---
title: "Announcing JamJet: The Agent-Native Runtime"
date: 2026-03-07
description: "We built the runtime we wished existed for AI agents — durable, composable, and built for production from day one."
author: jamjet-team
---

# Announcing JamJet: The Agent-Native Runtime

Today we're open-sourcing JamJet — a performance-first runtime for AI agents built in Rust, with a Python SDK for workflow authoring.

## Why we built it

We kept hitting the same walls when building production AI agents:

**Fragility.** A model call times out at step 7 of 12. The whole execution is gone. You start over.

**Black boxes.** You can't inspect what happened inside an agent run. You can't replay it. You can't debug it.

**Protocol fragmentation.** Every tool integration is a custom adapter. Every framework is its own island.

**Performance.** Python-native runtimes don't scale. You end up fighting GIL contention and memory pressure when you need speed.

We wanted something different.

## What JamJet is

JamJet is a **durable graph-based workflow runtime** for AI agents. The key ideas:

### Durability by default

Every execution is event-sourced. Before each node runs, we write a checkpoint. If the runtime crashes, restarts, or is redeployed — execution resumes from exactly where it stopped. No retries needed. No lost work.

```
execution exec_01JM4X8NKWP2
├── node:search     ✓ completed (823ms)
├── node:draft      ✓ completed (1.1s)
└── node:evaluate   ← resumed here after crash
```

### First-class protocol support

JamJet is built around open standards:

- **MCP** (Model Context Protocol) for tool integrations — one standard, hundreds of community servers
- **A2A** (Agent-to-Agent) for multi-agent collaboration — your agents can work with agents from any framework

### Rust performance, Python ergonomics

The runtime core is Rust + Tokio: zero-cost async, no GIL, real parallelism. The authoring surface is Python (or YAML). You write workflows like this:

```python
@workflow(id="research-agent", version="0.1.0")
class ResearchAgent:
    @node(start=True)
    async def search(self, state: State) -> State:
        results = await self.tool("brave-search", "web_search",
                                  {"query": state["query"]})
        return {"results": results.content}

    @node
    async def draft(self, state: State) -> State:
        response = await self.model(
            model="claude-sonnet-4-6",
            prompt=f"Synthesize: {state['results']}"
        )
        return {"answer": response.text}
```

The Python compiles to a Rust IR graph. The Rust scheduler runs it. You get Python ergonomics at Rust throughput.

### Eval built in

Quality assurance is first-class — not an afterthought:

```yaml
nodes:
  check-quality:
    type: eval
    scorers:
      - type: llm_judge
        rubric: "Is the answer accurate and complete?"
        min_score: 4
    on_fail: retry_with_feedback
    max_retries: 2
```

When the judge scores below the threshold, the feedback is automatically injected into the next model call. Self-improving loops, built into the runtime.

## Try it now

```bash
pip install jamjet
jamjet init my-first-agent
cd my-first-agent
jamjet dev
```

Then in another terminal:

```bash
jamjet run workflow.yaml --input '{"query": "What is JamJet?"}'
```

Read the [quickstart guide](/docs/quickstart) to go from zero to a running agent in 10 minutes.

## What's next

We're just getting started. On the roadmap:

- **TypeScript SDK** — same workflows, same runtime, browser-compatible
- **Hosted plane** — zero-ops deployment, managed PostgreSQL, global workers
- **Agent marketplace** — discover, fork, and deploy community agents
- **Visual debugger** — step through executions, replay from any checkpoint

Star us on [GitHub](https://github.com/jamjet-labs/jamjet) and join [Discord](https://discord.gg/jamjet). We're building in public and would love your feedback.

---

*The JamJet team*
