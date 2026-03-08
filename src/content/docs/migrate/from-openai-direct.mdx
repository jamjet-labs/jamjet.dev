---
title: Migrating from the OpenAI SDK
description: From a hand-rolled agentic loop to a structured, durable JamJet workflow.
sidebar:
  label: From OpenAI SDK
  order: 3
---

import { Aside, Steps, Tabs, TabItem } from '@astrojs/starlight/components';

## Why migrate

The raw OpenAI SDK agentic loop works great for demos and prototypes. In production you inevitably build:

- Manual retry logic with exponential backoff
- State threading between tool calls and model calls
- Logging ("what did step 7 actually receive?")
- Restart logic when your process crashes mid-run
- Tool dispatch tables that grow as you add tools

JamJet handles all of this as infrastructure, not application code.

## Concept mapping

| Raw OpenAI SDK | JamJet |
|---|---|
| `messages` list | `State` (Pydantic model — typed, validated) |
| `while True:` agentic loop | Workflow graph — explicit, inspectable |
| Manual `tool_calls` dispatch | MCP tool nodes (`type: tool`) |
| `client.chat.completions.create(...)` | `type: model` node (or `@wf.step` calling the client) |
| Hand-rolled retry | `retry: max_attempts: 3, backoff: exponential` |
| `print()` debugging | `jamjet inspect <exec-id>` — full event timeline |
| Process restart on crash | Durable runtime — resume from last completed step |
| Nothing | `jamjet eval run` — CI regression on every commit |

## Side-by-side example

<Tabs>
<TabItem label="Raw OpenAI">

```python
import json
from openai import OpenAI

client = OpenAI()

TOOLS = [{
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the web for current information",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
}]

def web_search(query: str) -> str:
    return f"[results for: {query}]"  # replace with real call

def run_agent(question: str) -> str:
    messages = [
        {"role": "system", "content": "You are a helpful research assistant."},
        {"role": "user", "content": question},
    ]
    while True:
        resp = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )
        msg = resp.choices[0].message
        if msg.tool_calls:
            messages.append(msg)
            for tc in msg.tool_calls:
                args = json.loads(tc.function.arguments)
                result = web_search(args["query"])
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })
        else:
            return msg.content or ""

print(run_agent("Latest AI agent frameworks?"))
```

</TabItem>
<TabItem label="JamJet">

```python
from openai import OpenAI
from pydantic import BaseModel
from jamjet import Workflow

client = OpenAI()

class State(BaseModel):
    question: str
    search_results: str = ""
    answer: str = ""

wf = Workflow("research-agent")

@wf.state
class AgentState(State):
    pass

@wf.step
async def search(state: AgentState) -> AgentState:
    # In production: type: tool + MCP server (no dispatch table needed)
    results = f"[results for: {state.question}]"
    return state.model_copy(update={"search_results": results})

@wf.step
async def synthesize(state: AgentState) -> AgentState:
    resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "You are a helpful research assistant."},
            {"role": "user", "content": (
                f"Question: {state.question}\n"
                f"Search results: {state.search_results}\n"
                "Provide a comprehensive answer."
            )},
        ],
    )
    return state.model_copy(update={"answer": resp.choices[0].message.content or ""})

result = wf.run_sync(AgentState(question="Latest AI agent frameworks?"))
print(result.state.answer)
print(f"Ran {result.steps_executed} steps in {result.total_duration_us / 1000:.1f}ms")
```

</TabItem>
</Tabs>

## Migration path

<Steps>

1. **Lift your state into a Pydantic model.**

   ```python
   # Before: scattered variables
   messages = [...]
   search_results = None
   final_answer = None

   # After: explicit, validated state
   class State(BaseModel):
       question: str
       search_results: str = ""
       answer: str = ""
   ```

2. **Split your loop into named steps.**

   Each logical "phase" of your loop becomes a `@wf.step`. Tool dispatch becomes a `type: tool` node.

3. **Keep your LLM calls as-is.**

   Use the OpenAI client inside your step function exactly as before. You can swap to a YAML `type: model` node later when you want the runtime to handle retries, cost tracking, and observability.

4. **Run locally first.**

   `wf.run_sync(State(...))` works without any server — exact same behaviour as your loop.

5. **Go durable when you need it.**

   ```bash
   jamjet dev      # start the Rust runtime
   jamjet run workflow.yaml --input '{"question": "..."}'
   ```

   Your workflow is now crash-safe, observable, and testable with `jamjet eval run`.

</Steps>

## What you get for free

Once you're on JamJet, these come with no extra code:

**Retry without try/except soup:**
```yaml
nodes:
  search:
    type: tool
    server: brave-search
    tool: web_search
    arguments:
      query: "{{ state.question }}"
    retry:
      max_attempts: 3
      backoff: exponential
      delay_ms: 1000
```

**Full execution timeline:**
```bash
jamjet inspect exec-abc123
# → step: search     200ms  completed
# → step: synthesize 1840ms completed
```

**CI regression:**
```bash
jamjet eval run evals/dataset.jsonl --workflow research-agent --fail-under 0.9
```

<Aside type="tip">
Full working examples in [jamjet-labs/jamjet-benchmarks](https://github.com/jamjet-labs/jamjet-benchmarks/tree/main/migrate/from-openai-direct).
</Aside>
