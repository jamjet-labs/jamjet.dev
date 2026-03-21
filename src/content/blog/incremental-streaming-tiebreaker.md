---
title: "What's New: Incremental Streaming, LLM Tiebreaker, and Reasoning Modes"
date: 2026-03-20
description: "True incremental NDJSON streaming for agent tools, async LLM tiebreaker for coordinator routing, and reasoning mode scoring for Agent Cards."
author: "Sunil Prakash"
category: "Releases & Updates"
---

# What's New: Incremental Streaming, LLM Tiebreaker, and Reasoning Modes

Three features shipped today that make JamJet's agentic patterns significantly more capable. Here's what changed and why it matters.

## True Incremental Streaming

The AgentTool executor's streaming mode previously buffered the entire HTTP response before parsing NDJSON lines. That meant no mid-stream cancellation, no real-time visibility, and memory usage that scaled with response size.

Now it streams incrementally:

```python
graph.add_agent_tool("researcher",
    agent="https://research-agent.example.com",
    mode="streaming",
    budget={"max_cost_usd": 0.50},
    streaming={"idle_timeout_secs": 30},
)
```

**What changed:**
- `bytes_stream()` replaces `resp.text().await` — chunks are parsed as they arrive off the wire
- Events appear in the state backend in real-time via an `mpsc` channel, not batched at the end
- Per-chunk idle timeout (default 30s) catches stalled streams without killing active ones
- Budget guard terminates mid-stream when `max_cost_usd` is exceeded
- Best-effort A2A `tasks/cancel` notifies the remote agent on early termination
- Hard failures (timeout, network error) now return `Err` so the node fails properly

The old buffered path is preserved as a fallback when called through `execute()` directly.

## LLM Tiebreaker for Coordinator Routing

JamJet's Coordinator Node scores candidates on five dimensions — capability, cost, latency, trust, and history. When the top candidates score within a threshold, the structured scoring alone can't make a confident choice.

Now it calls an LLM to break the tie:

```python
graph.add_coordinator("route",
    task="Route ticket to best support agent",
    required_skills=["support"],
    tiebreaker={"model": "claude-sonnet-4-6", "threshold": 0.1},
)
```

When the spread between the top candidates is ≤ threshold, the coordinator formats a prompt with task context, Agent Card summaries, and numeric scores, then asks the LLM to pick the best agent with structured JSON output.

**Key details:**
- Uses async SDK clients (`AsyncAnthropic`, `AsyncOpenAI`) — no event loop blocking
- Falls back gracefully: if Anthropic fails, tries OpenAI; if both fail, returns `method="tiebreaker_failed"` with the structured pick
- Token usage tracked in `Decision.tiebreaker_tokens` for cost visibility
- Shared `jamjet.llm.client` module — reusable anywhere in the SDK

## Reasoning Modes on Agent Cards

Agent Cards now declare their reasoning capabilities:

```python
AgentCandidate(
    uri="jamjet://org/planner-agent",
    agent_card={"name": "Planner"},
    skills=["task-decomposition"],
    reasoning_modes=["plan-and-execute", "react"],
)
```

When the coordinator context includes `preferred_reasoning_modes`, agents with matching modes get a capability score boost:

```python
rankings, spread = await strategy.score(
    task="Decompose complex research task",
    candidates=candidates,
    weights={},
    context={"preferred_reasoning_modes": ["plan-and-execute"]},
)
```

The field flows through the full stack — Python `AgentCandidate`, Rust strategy bridge, REST serialization, and scoring. When no preference is set, it's neutral — no impact on existing workflows.

## What's Next

- **Phase D: Live Debugger** — WebSocket-powered real-time animation in the Web Companion, with breakpoints and step-through
- **B.3: Session Types** — Session type labels on execution metadata
- **5.14: Crates.io** — Publish Rust crates for direct embedding

Follow along on [GitHub](https://github.com/jamjet-labs/jamjet) or join us on [Discord](https://discord.gg/SAYnEj86fr).
