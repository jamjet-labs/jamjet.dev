---
title: CLI Reference
description: Full reference for the jamjet command-line interface.
sidebar:
  order: 8
---

# CLI Reference

The `jamjet` CLI is the primary interface for managing projects, running workflows, and inspecting executions.

## Installation

```bash
pip install jamjet
jamjet --version
# JamJet CLI 0.1.0
```

## Global flags

| Flag | Description |
|------|-------------|
| `--runtime URL` | Runtime URL (default: `http://localhost:7700`) |
| `--api-key KEY` | API key for hosted runtime |
| `--output json` | Output as JSON (for scripting) |
| `-v, --verbose` | Verbose output |

## `jamjet init`

Scaffold a new project or add JamJet to an existing one.

```bash
# New project in a new directory
jamjet init my-agent
cd my-agent

# Add to current directory (like git init)
jamjet init
```

Creates:
- `workflow.yaml` — starter workflow template
- `jamjet.toml` — project configuration
- `README.md` — project readme

## `jamjet dev`

Start the local development runtime.

```bash
jamjet dev
```

```
▶ JamJet Dev Runtime
  Port:  7700
  Mode:  local (SQLite)
  API:   http://localhost:7700

Press Ctrl+C to stop.
```

| Flag | Description |
|------|-------------|
| `--port N` | Listen on port N (default: 7700) |
| `--db PATH` | SQLite file path (default: `.jamjet/dev.db`) |
| `--with-mcp-server` | Also start the MCP server |
| `--with-a2a-server` | Also start the A2A agent server |
| `--reload` | Auto-reload on workflow file changes |

## `jamjet validate`

Validate a workflow file without running it.

```bash
jamjet validate workflow.yaml
```

```
Valid. workflow_id=hello-agent version=0.1.0
  Nodes: 4  Edges: 3
```

## `jamjet run`

Submit a workflow execution and wait for the result.

```bash
jamjet run workflow.yaml --input '{"query": "What is JamJet?"}'
```

```
✓ Execution started: exec_01JM4X8NKWP2
  Status: running
✓ node_completed   think   claude-haiku  512ms
✓ Execution completed.
```

| Flag | Description |
|------|-------------|
| `--input JSON` | Initial state as JSON |
| `--input-file PATH` | Read initial state from a JSON file |
| `--stream` | Stream events in real time |
| `--wait / --no-wait` | Wait for completion (default: wait) |
| `--timeout N` | Timeout in seconds (default: 300) |

With `--stream`:

```bash
jamjet run workflow.yaml --input '{"query": "Explain event sourcing"}' --stream
```

```
✓ exec_01JM5Y9... started
 → node_started    think
✓ node_completed   think   claude-haiku  489ms  (64→312 tokens)
✓ Stream complete
```

## `jamjet inspect`

View the full state and event timeline of an execution.

```bash
jamjet inspect exec_01JM4X8NKWP2
```

```
Execution: exec_01JM4X8NKWP2
  Workflow: hello-agent v0.1.0
  Status:   completed
  Duration: 512ms

State:
  query:  "What is JamJet?"
  answer: "JamJet is an agent-native runtime..."

Events:
  09:31:00.001  execution_started
  09:31:00.012  node_started      think
  09:31:00.524  node_completed    think    claude-haiku (64 in / 312 out tokens)
  09:31:00.525  execution_completed

Token usage:
  Input:  64
  Output: 312
  Cost:   ~$0.00012
```

## `jamjet ls`

List recent executions.

```bash
jamjet ls
```

```
ID                        Workflow         Status      Duration  Started
exec_01JM5Y9NKWP3        research-agent   completed   2.1s      2m ago
exec_01JM4X8NKWP2        hello-agent      completed   512ms     5m ago
exec_01JM3W7MKVM1        research-agent   failed      8.3s      12m ago
```

| Flag | Description |
|------|-------------|
| `--workflow ID` | Filter by workflow ID |
| `--status STATUS` | Filter by status (running, completed, failed) |
| `--limit N` | Show N results (default: 20) |

## `jamjet resume`

Resume a waiting or failed execution.

```bash
# Resume a waiting execution (e.g., after human approval)
jamjet resume exec_01JM4X8NKWP2 --event human_approved --data '{"approved": true}'

# Retry a failed execution from the last checkpoint
jamjet resume exec_01JM3W7MKVM1 --retry
```

## `jamjet cancel`

Cancel a running execution.

```bash
jamjet cancel exec_01JM4X8NKWP2
```

## `jamjet tools`

Inspect and test MCP tool servers.

```bash
# List all available tools
jamjet tools list

# Call a tool directly (for testing)
jamjet tools call brave-search web_search --args '{"query": "JamJet"}'
```

## `jamjet agents`

Inspect A2A agent cards.

```bash
# Inspect a remote agent
jamjet agents inspect https://agents.example.com/research-agent

# List locally exposed agents
jamjet agents list
```

## `jamjet eval run`

Run an eval dataset against a workflow.

```bash
jamjet eval run dataset.jsonl \
  --workflow workflow.yaml \
  --rubric "Is the answer accurate and complete?" \
  --min-score 4 \
  --assert "len(output.answer) > 0" \
  --fail-below 0.9
```

```
Running 50 eval rows... ████████████████████ 50/50

┌─────────┬────────────┬───────┬──────────┬────────────────────┐
│ Row     │ Status     │ Score │ Latency  │ Note               │
├─────────┼────────────┼───────┼──────────┼────────────────────┤
│ row_001 │ ✓ passed   │ 4.8   │  512ms   │                    │
│ row_002 │ ✗ failed   │ 2.1   │  891ms   │ Answer too vague   │
│ ...     │ ...        │ ...   │ ...      │ ...                │
└─────────┴────────────┴───────┴──────────┴────────────────────┘

Results: 47/50 passed (94.0%) — above threshold 90.0% ✓
```

| Flag | Description |
|------|-------------|
| `--workflow PATH` | Workflow file to run |
| `--rubric TEXT` | LLM judge rubric |
| `--model MODEL` | Model for LLM judge (default: claude-haiku-4-5-20251001) |
| `--min-score N` | Minimum score 1–5 (default: 4) |
| `--assert EXPR` | Python assertion (repeatable) |
| `--latency-ms N` | Max latency threshold |
| `--cost-usd N` | Max cost per row |
| `--concurrency N` | Parallel rows (default: 5) |
| `--fail-below N` | Exit code 1 if pass rate below N (default: 1.0) |
| `--output PATH` | Write results JSON to file |
