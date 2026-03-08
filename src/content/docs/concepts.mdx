---
title: Core Concepts
description: Understand agents, nodes, state, and durability in JamJet.
sidebar:
  order: 2
---

import { Aside, Card, CardGrid } from '@astrojs/starlight/components';

# Core Concepts

JamJet is an **agent-native runtime** — purpose-built for AI workflows that need to survive failures, scale across workers, and compose with other agents. This page covers the key primitives.

## Workflows

A **workflow** is a directed graph of nodes. It has:

- A unique `id` and `version`
- A `state_schema` — the typed shape of data flowing through the graph
- A `start` node where execution begins
- One or more `end` nodes

```yaml
workflow:
  id: my-agent
  version: 0.1.0
  state_schema:
    query: str
    answer: str
    confidence: float
  start: think
```

Workflows are compiled to an **IR (Intermediate Representation)** graph before execution. The IR is what the Rust scheduler actually runs — YAML and Python are just authoring surfaces.

## Nodes

Nodes are the units of computation in a workflow. Each node has a `type` that determines what it does:

| Node type | What it does |
|-----------|-------------|
| `model`   | Calls an LLM (Claude, GPT-4, Gemini, etc.) |
| `tool`    | Calls an external tool via MCP |
| `http`    | Makes an HTTP request |
| `branch`  | Routes execution based on a condition |
| `parallel` | Fans out to multiple branches simultaneously |
| `wait`    | Pauses until an external event |
| `eval`    | Scores output quality (rubric, assertion, latency) |
| `end`     | Terminates the workflow |

Every node reads from and writes to **state**.

## State

State is the shared data store for a workflow execution. It persists across nodes and across restarts.

```yaml
state_schema:
  query: str        # input from the user
  search_results: list[str]  # intermediate data
  answer: str       # final output
```

State is **typed** — the schema is validated at compile time. At runtime, each node can read any state key and write to its `output_key`.

<Aside type="tip">
State is stored in the database, not in memory. If the runtime crashes mid-execution, the state is fully recovered and execution resumes from the last checkpoint.
</Aside>

## Executions

An **execution** is a single run of a workflow with a specific input. Each execution gets a unique ID (e.g., `exec_01JM4X8NKWP2`).

Executions are:
- **Durable** — stored in the database, survive restarts
- **Observable** — every state transition is recorded as an event
- **Inspectable** — view full state, event timeline, and token usage with `jamjet inspect`

## Durability

Durability is JamJet's core guarantee: **executions always complete, even if the runtime crashes**.

This works through **event sourcing**:
1. Before each node runs, a `node_started` event is written to the database
2. After each node completes, a `node_completed` event is written with the state patch
3. On restart, the scheduler replays the event log to reconstruct exactly where execution stopped
4. Execution resumes from the first incomplete node

No work is lost. No node runs twice.

<Aside type="note">
This is different from "at-least-once" delivery. JamJet's scheduler uses distributed locks to ensure each node runs **exactly once**, even with multiple worker processes.
</Aside>

## Agents

An **agent** is a workflow that can:
- Be discovered and called by other agents (via Agent Cards)
- Delegate tasks to other agents (via A2A protocol)
- Maintain long-running state across multiple user interactions

Every agent has an **Agent Card** — a machine-readable description of its capabilities, endpoints, and input/output schema. This is the foundation for the [A2A protocol](/a2a).

## The Scheduler

The JamJet scheduler is written in Rust and runs as part of `jamjet dev` (locally) or the hosted runtime (in production).

It:
1. Polls the execution queue for pending work
2. Acquires a lock on the execution to prevent duplicate runs
3. Dispatches nodes to worker threads
4. Writes checkpoints after each node

The scheduler is the reason JamJet workflows are durable by default — it never forgets an execution.

## Local vs. Production

| Feature | `jamjet dev` (local) | Hosted / self-hosted |
|---------|---------------------|---------------------|
| Storage | SQLite | PostgreSQL |
| Workers | Single process | Distributed |
| MCP servers | Local stdio | Remote SSE/HTTP |
| Auth | None | mTLS / API keys |

The programming model is identical — the same YAML or Python code runs unchanged in both environments.
