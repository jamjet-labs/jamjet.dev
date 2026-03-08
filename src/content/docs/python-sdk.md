---
title: Python SDK
description: Write JamJet workflows in Python using decorators and the workflow builder.
sidebar:
  order: 4
---

import { Aside, Code, Tabs, TabItem } from '@astrojs/starlight/components';

# Python SDK

The JamJet Python SDK lets you write workflows in Python instead of YAML. Both compile to the same IR and run on the same Rust runtime.

## Installation

```bash
pip install jamjet
```

## Decorator API

The decorator API is the most concise way to write workflows. Decorate a function with `@node` and JamJet infers the node type from the function signature and return type.

```python
from jamjet import workflow, node, State

@workflow(id="hello-agent", version="0.1.0")
class HelloWorkflow:
    @node(start=True)
    async def think(self, state: State) -> State:
        response = await self.model(
            model="claude-haiku-4-5-20251001",
            prompt=f"Answer clearly: {state['query']}",
        )
        return {"answer": response.text}
```

Run it:

```python
import asyncio
from jamjet import JamJetClient

async def main():
    client = JamJetClient()  # connects to http://localhost:7700
    result = await client.run(
        HelloWorkflow,
        input={"query": "What is JamJet?"}
    )
    print(result.state["answer"])

asyncio.run(main())
```

## Workflow builder

For more control, use the builder API:

```python
from jamjet.workflows import WorkflowBuilder, ModelNode, ToolNode, BranchNode

wf = (
    WorkflowBuilder("research-agent", version="0.2.0")
    .state_schema(query=str, results=list, answer=str)
    .add_node(
        ToolNode("search")
        .server("brave-search")
        .tool("web_search")
        .arguments({"query": "{{ state.query }}", "count": 5})
        .output_key("results")
        .next("draft")
    )
    .add_node(
        ModelNode("draft")
        .model("claude-sonnet-4-6")
        .prompt("""
            Search results: {{ state.results | join('\\n') }}

            Answer: {{ state.query }}
        """)
        .output_key("answer")
        .next("end")
    )
    .start("search")
    .build()
)
```

## State access

State is a typed dict-like object. Access keys with `state["key"]` or `state.key`:

```python
@node
async def process(self, state: State) -> State:
    query = state["query"]          # raises KeyError if missing
    context = state.get("context")  # returns None if missing

    # Return a partial state patch — only keys you include are updated
    return {"answer": "...", "confidence": 0.95}
```

<Aside type="tip">
Nodes return **state patches**, not full state. You only need to return the keys you want to update. Existing keys are preserved.
</Aside>

## Model calls

Use `self.model()` inside any node to call an LLM:

```python
@node
async def think(self, state: State) -> State:
    response = await self.model(
        model="claude-sonnet-4-6",
        prompt=f"Answer: {state['query']}",
        system="You are concise and accurate.",
        temperature=0.3,
        max_tokens=512,
    )

    # response.text — full text
    # response.usage.input_tokens
    # response.usage.output_tokens
    # response.model

    return {"answer": response.text}
```

## Tool calls (MCP)

Use `self.tool()` to call a tool from a connected MCP server:

```python
@node
async def search(self, state: State) -> State:
    result = await self.tool(
        server="brave-search",
        tool="web_search",
        arguments={"query": state["query"], "count": 5},
    )
    return {"results": result.content}
```

## HTTP calls

```python
@node
async def fetch(self, state: State) -> State:
    result = await self.http(
        method="GET",
        url=f"https://api.example.com/items/{state['item_id']}",
        headers={"Authorization": f"Bearer {self.env('API_KEY')}"},
    )
    return {"raw": result.json()}
```

## Branching

```python
from jamjet import node, branch

@node
@branch(
    conditions=[
        ("state['confidence'] >= 0.9", "done"),
        ("state['confidence'] >= 0.5", "refine"),
    ],
    default="escalate",
)
async def route(self, state: State) -> State:
    return {}  # branch node reads existing state — no output needed
```

## Parallel execution

```python
from jamjet.workflows import ParallelNode

.add_node(
    ParallelNode("gather")
    .branches(["search", "fetch-docs", "check-cache"])
    .join("synthesize")
)
```

## Retry policies

```python
from jamjet.workflows import RetryPolicy

ModelNode("think")
    .model("claude-haiku-4-5-20251001")
    .prompt("...")
    .retry(RetryPolicy(
        max_attempts=3,
        backoff="exponential",
        delay_ms=500,
    ))
```

## Running workflows

```python
from jamjet import JamJetClient

client = JamJetClient(base_url="http://localhost:7700")

# Run and wait for completion
result = await client.run(wf, input={"query": "..."})
print(result.state)
print(result.execution_id)
print(result.duration_ms)

# Fire and forget — get an execution ID back immediately
exec_id = await client.submit(wf, input={"query": "..."})

# Poll for status
status = await client.get_execution(exec_id)
print(status.status)  # running | completed | failed

# Stream events as they happen
async for event in client.stream(wf, input={"query": "..."}):
    print(event.type, event.node_id)
```

## Type annotations

The SDK ships with full type stubs. In strict mode:

```python
from jamjet import State, NodeResult
from typing import TypedDict

class MyState(TypedDict):
    query: str
    answer: str
    confidence: float

@node(start=True)
async def think(self, state: MyState) -> NodeResult[MyState]:
    ...
    return NodeResult(answer="...", confidence=0.9)
```

## Configuration

```python
from jamjet import JamJetClient, JamJetConfig

client = JamJetClient(config=JamJetConfig(
    base_url="http://localhost:7700",
    api_key="YOUR_API_KEY",  # for hosted/production
    timeout_ms=30_000,
    default_model="claude-haiku-4-5-20251001",
))
```

Or via environment variables:

```bash
export JAMJET_URL=http://localhost:7700
export JAMJET_API_KEY=...
```
