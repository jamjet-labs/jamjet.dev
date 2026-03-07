---
title: Quickstart
description: Get a durable JamJet workflow running in under 10 minutes.
sidebar:
  order: 1
---

import { Aside, Steps, Code, Tabs, TabItem } from '@astrojs/starlight/components';

# Quickstart

Get JamJet running locally in under 10 minutes. You'll install the CLI, start the local dev runtime, write a workflow, and run it.

<Aside type="tip">
  **Prerequisites:** Python 3.11+ and pip. That's it — no Docker, no database setup needed for local development.
</Aside>

## Install

```bash
pip install jamjet
```

Verify the install:

```bash
jamjet --version
# JamJet CLI 0.1.0
```

## Create a project

Scaffold a new project:

```bash
jamjet init my-first-agent
cd my-first-agent
```

Or add JamJet to an existing project (like `git init`):

```bash
cd my-existing-project
jamjet init
```

You'll get a `workflow.yaml` to edit and a `README.md` to get started.

## Start the local runtime

```bash
jamjet dev
```

This starts the JamJet runtime locally using SQLite for storage. No external database required.

```
▶ JamJet Dev Runtime
  Port:  7700
  Mode:  local (SQLite)
  API:   http://localhost:7700

Press Ctrl+C to stop.
```

Keep this terminal running.

## Write a workflow

Open `workflow.yaml` in your editor and replace it with:

```yaml
# workflow.yaml
workflow:
  id: hello-agent
  version: 0.1.0
  state_schema:
    query: str
    answer: str
  start: think

nodes:
  think:
    type: model
    model: claude-haiku-4-5-20251001
    prompt: "Answer this question clearly and concisely: {{ state.query }}"
    output_key: answer
    next: end

  end:
    type: end
```

## Validate the workflow

```bash
jamjet validate workflow.yaml
```

```
Valid. workflow_id=hello-agent version=0.1.0
  Nodes: 2  Edges: 1
```

## Run it

In a new terminal (keep `jamjet dev` running):

```bash
jamjet run workflow.yaml --input '{"query": "What is JamJet?"}'
```

```
✓ Execution started: exec_01JM4X8NKWP2
  Status: running
✓ node_completed   think   claude-haiku  512ms
✓ Execution completed.
```

## Inspect the result

```bash
jamjet inspect exec_01JM4X8NKWP2
```

You'll see the full execution state including the model's answer, token usage, and event timeline.

## Stream output in real time

Add `--stream` to see events as they happen:

```bash
jamjet run workflow.yaml --input '{"query": "Explain event sourcing"}' --stream
```

```
✓ exec_01JM5Y9... started
 → node_started    think
✓ node_completed   think   claude-haiku  489ms  (64→312 tokens)
✓ Stream complete
```

## What just happened?

1. `jamjet dev` started a **durable runtime** backed by SQLite — your executions survive restarts
2. Your YAML was validated and compiled to an **IR graph**
3. The **Rust scheduler** picked up your execution and dispatched `think` to a worker
4. The worker made the **model call** (via your `ANTHROPIC_API_KEY` env var)
5. The result was **checkpointed** — if the runtime had crashed mid-execution, it would resume exactly here

## Next steps

<Steps>
1. [Core Concepts](/docs/concepts) — understand agents, nodes, state, and durability
2. [Workflow Authoring](/docs/yaml-workflows) — all node types, retry policies, conditions, parallel branches
3. [Python SDK](/docs/python-sdk) — write workflows in Python instead of YAML
4. [MCP Integration](/docs/mcp) — connect to external tool servers
5. [A2A Integration](/docs/a2a) — delegate to or serve other agents
</Steps>

## Set your API key

JamJet uses the model you specify. To use Claude:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

To use OpenAI GPT:

```bash
export OPENAI_API_KEY=sk-...
```

Then use `model: gpt-4o` in your workflow.

## Troubleshooting

**`jamjet dev` not found?**
Make sure your Python scripts directory is in your PATH. Try `python -m jamjet dev`.

**Connection refused at port 7700?**
`jamjet dev` must be running in another terminal before you run workflows.

**Model call fails?**
Check that your `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set in the environment where `jamjet dev` is running.

**Need help?** Join [Discord](https://discord.gg/jamjet) or open a [GitHub Discussion](https://github.com/jamjet-labs/jamjet/discussions).
