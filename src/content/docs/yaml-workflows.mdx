---
title: Workflow Authoring (YAML)
description: All node types, retry policies, conditions, and parallel branches for YAML workflows.
sidebar:
  order: 3
---

import { Aside, Code, Tabs, TabItem } from '@astrojs/starlight/components';

# Workflow Authoring (YAML)

YAML is the primary authoring format for JamJet workflows. This page covers every node type, control flow option, and configuration knob.

## Workflow header

```yaml
workflow:
  id: my-workflow          # unique identifier (slug format)
  version: 0.1.0           # semver
  state_schema:            # typed state (all keys optional at start)
    query: str
    results: list[str]
    answer: str
    score: float
  start: first-node        # entry node id
```

## Model node

Calls an LLM and writes the response to a state key.

```yaml
nodes:
  think:
    type: model
    model: claude-haiku-4-5-20251001       # or gpt-4o, gemini-2.0-flash, etc.
    prompt: |
      You are a helpful assistant.
      Answer this question: {{ state.query }}
    output_key: answer          # writes model response here
    next: end

    # Optional
    system: "You are concise and precise."
    temperature: 0.3
    max_tokens: 1024
    retry:
      max_attempts: 3
      backoff: exponential      # or linear, constant
      delay_ms: 500
```

**Supported models:**

| Provider | Model IDs |
|----------|-----------|
| Anthropic | `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-6` |
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o3-mini` |
| Google | `gemini-2.0-flash`, `gemini-2.5-pro` |

## Tool node (MCP)

Calls a tool from a connected MCP server.

```yaml
nodes:
  search:
    type: tool
    server: brave-search        # MCP server name (from jamjet.toml)
    tool: web_search
    arguments:
      query: "{{ state.query }}"
      count: 5
    output_key: search_results
    next: summarize
```

MCP servers are configured in `jamjet.toml`:

```toml
[[mcp.servers]]
name = "brave-search"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-brave-search"]
env = { BRAVE_API_KEY = "${BRAVE_API_KEY}" }
```

## HTTP node

Makes an HTTP request and writes the response body to state.

```yaml
nodes:
  fetch-data:
    type: http
    method: GET
    url: "https://api.example.com/data/{{ state.item_id }}"
    headers:
      Authorization: "Bearer {{ env.API_KEY }}"
    output_key: raw_data
    next: process
```

For `POST`/`PUT`, add a `body` field:

```yaml
    method: POST
    body:
      query: "{{ state.query }}"
      format: json
```

## Branch node

Routes execution based on a condition.

```yaml
nodes:
  route:
    type: branch
    conditions:
      - if: "state.confidence >= 0.9"
        next: done
      - if: "state.confidence >= 0.5"
        next: refine
    default: escalate        # fallback if no condition matches
```

Conditions are evaluated in order — first match wins. Expressions use a simple subset of Python syntax with `state.*` and `env.*` available.

## Parallel node

Fans out to multiple branches, waits for all to complete, then continues.

```yaml
nodes:
  gather:
    type: parallel
    branches:
      - search
      - fetch-docs
      - check-cache
    join: synthesize         # node to run after all branches complete
```

Each branch runs concurrently. State writes from parallel branches are merged; if two branches write the same key, the last writer wins.

## Wait node

Pauses execution until an external event is received.

```yaml
nodes:
  await-approval:
    type: wait
    event: human_approved    # event name to wait for
    timeout_hours: 24
    on_timeout: escalate     # node to run if timeout fires
    next: continue
```

Resume a waiting execution with:

```bash
jamjet resume exec_01JM4X8NKWP2 --event human_approved --data '{"approved": true}'
```

## Eval node

Scores output quality inline. Useful for self-healing loops.

```yaml
nodes:
  check-quality:
    type: eval
    scorers:
      - type: llm_judge
        rubric: "Is the answer accurate, complete, and under 200 words?"
        min_score: 4          # 1-5 scale
        model: claude-haiku-4-5-20251001
      - type: assertion
        check: "len(output.answer) > 0"
      - type: latency
        max_ms: 5000
    on_fail: retry_with_feedback   # or escalate, halt, log_and_continue
    max_retries: 2
    next: end
```

`on_fail` options:
- `retry_with_feedback` — re-runs the previous model node with scorer feedback injected into the prompt
- `escalate` — routes to an escalation node (define `escalate:` in the workflow header)
- `halt` — stops the execution with an error
- `log_and_continue` — records the failure but continues anyway

## End node

Terminates the execution. Every workflow needs at least one.

```yaml
nodes:
  end:
    type: end
```

You can have multiple named end nodes (e.g., `success`, `failure`, `escalated`) — they all terminate execution cleanly.

## Retry policies

Any node can have a retry policy:

```yaml
    retry:
      max_attempts: 3
      backoff: exponential    # linear | constant | exponential
      delay_ms: 200           # initial delay
      max_delay_ms: 10000     # cap for exponential backoff
      retry_on:               # optional: only retry on these errors
        - model_overloaded
        - rate_limited
        - timeout
```

## Template expressions

Prompts, URLs, headers, and arguments support `{{ }}` template expressions:

| Expression | Value |
|-----------|-------|
| `{{ state.key }}` | A state value |
| `{{ env.KEY }}` | An environment variable |
| `{{ execution.id }}` | Current execution ID |
| `{{ execution.workflow_id }}` | Workflow ID |
| `{{ node.id }}` | Current node ID |

## Full example

```yaml
workflow:
  id: research-agent
  version: 0.2.0
  state_schema:
    query: str
    search_results: list[str]
    draft: str
    answer: str
  start: search

nodes:
  search:
    type: tool
    server: brave-search
    tool: web_search
    arguments:
      query: "{{ state.query }}"
      count: 10
    output_key: search_results
    next: draft

  draft:
    type: model
    model: claude-sonnet-4-6
    prompt: |
      Based on these search results:
      {{ state.search_results | join('\n') }}

      Write a comprehensive answer to: {{ state.query }}
    output_key: draft
    next: evaluate

  evaluate:
    type: eval
    scorers:
      - type: llm_judge
        rubric: "Is this answer factually grounded in the search results, complete, and well-structured?"
        min_score: 4
        model: claude-haiku-4-5-20251001
      - type: assertion
        check: "len(output.draft) >= 100"
    on_fail: retry_with_feedback
    max_retries: 2
    next: done

  done:
    type: end
```
