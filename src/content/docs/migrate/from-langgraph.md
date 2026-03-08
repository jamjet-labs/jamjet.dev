---
title: Migrating from LangGraph
description: Side-by-side code comparison and concept mapping for developers moving from LangGraph to JamJet.
sidebar:
  label: From LangGraph
  order: 1
---

import { Aside, Tabs, TabItem } from '@astrojs/starlight/components';

## Concept mapping

| LangGraph | JamJet |
|---|---|
| `TypedDict` state | `pydantic.BaseModel` state — validated at every step |
| `StateGraph` | `Workflow` |
| `graph.add_node("name", fn)` | `@workflow.step` decorator |
| `graph.add_conditional_edges(node, router_fn)` | `@workflow.step(next={"target": predicate})` |
| `graph.add_edge(A, B)` | Sequential by default; `next=` for branches |
| `graph.compile()` | `workflow.compile()` → IR for the Rust runtime |
| `app.invoke(state)` | `workflow.run_sync(state)` (local) |
| `app.astream(state)` | `workflow.run(state)` (async, local) |
| `MemorySaver` / `PostgresSaver` | Built into the Rust runtime — automatic |
| `interrupt_before` (human-in-the-loop) | `type: wait` node or `human_approval=True` on step |

## Side-by-side example

A multi-step agent with conditional routing — decide whether to search, then synthesize an answer.

<Tabs>
<TabItem label="LangGraph">

```python
from typing import Literal, TypedDict
from langgraph.graph import END, START, StateGraph

class State(TypedDict):
    question: str
    needs_search: bool
    search_results: list[str]
    answer: str

def route(state: State) -> State:
    q = state["question"].lower()
    needs = any(w in q for w in ["latest", "current", "today"])
    return {**state, "needs_search": needs}

def search(state: State) -> State:
    return {**state, "search_results": [f"[result for: {state['question']}]"]}

def answer(state: State) -> State:
    ctx = "\n".join(state.get("search_results", []))
    return {**state, "answer": f"Answer: {state['question']}\n{ctx}"}

def should_search(state: State) -> Literal["search", "answer"]:
    return "search" if state["needs_search"] else "answer"

graph = StateGraph(State)
graph.add_node("route", route)
graph.add_node("search", search)
graph.add_node("answer", answer)
graph.add_edge(START, "route")
graph.add_conditional_edges("route", should_search)
graph.add_edge("search", "answer")
graph.add_edge("answer", END)

app = graph.compile()
result = app.invoke({"question": "...", "needs_search": False, "search_results": [], "answer": ""})
print(result["answer"])
```

</TabItem>
<TabItem label="JamJet">

```python
from pydantic import BaseModel
from jamjet import Workflow

class State(BaseModel):
    question: str
    needs_search: bool = False
    search_results: list[str] = []
    answer: str = ""

wf = Workflow("research-agent")

@wf.state
class AgentState(State):
    pass

@wf.step
async def route(state: AgentState) -> AgentState:
    q = state.question.lower()
    needs = any(w in q for w in ["latest", "current", "today"])
    return state.model_copy(update={"needs_search": needs})

@wf.step(next={"search": lambda s: s.needs_search})
async def check_route(state: AgentState) -> AgentState:
    return state  # pure routing step

@wf.step
async def search(state: AgentState) -> AgentState:
    results = [f"[result for: {state.question}]"]
    return state.model_copy(update={"search_results": results})

@wf.step
async def answer(state: AgentState) -> AgentState:
    ctx = "\n".join(state.search_results)
    return state.model_copy(update={"answer": f"Answer: {state.question}\n{ctx}"})

# Local execution — no server needed
result = wf.run_sync(AgentState(question="..."))
print(result.state.answer)

# Production: wf.compile() + jamjet dev
```

</TabItem>
</Tabs>

## Key differences

### State validation

LangGraph uses `TypedDict` — dict access with no validation. JamJet uses Pydantic — fields are validated at every step transition. If a step returns the wrong shape, you get an error immediately rather than silent data corruption downstream.

### Routing syntax

LangGraph requires a separate routing function passed to `add_conditional_edges`. JamJet routing is inline on the step:

```python
@wf.step(next={"branch_a": lambda s: s.flag, "branch_b": lambda s: not s.flag})
async def my_step(state: State) -> State: ...
```

For simple linear workflows, you write nothing — steps execute in declaration order.

### Durability

LangGraph's checkpointing is opt-in and in-process (SQLite, Redis, Postgres adapters you configure and manage). JamJet's Rust runtime is durable by default — every step transition is an event-sourced write. Crash at step 7 of 12? Resume from step 7, not step 1.

### Local vs production

Both modes use the same API:

```python
# Development (in-process, no server)
result = wf.run_sync(State(question="..."))

# Production (durable Rust runtime)
ir = wf.compile()
# jamjet dev  ← start runtime in another terminal
# jamjet run workflow.yaml --input '{"question": "..."}'
```

## Quick-start migration

```bash
pip install jamjet
```

1. Replace `TypedDict` with `pydantic.BaseModel`
2. Replace `StateGraph` + `add_node` + `add_edge` with `@wf.step`
3. For conditional routing: `@wf.step(next={"target": lambda s: s.flag})`
4. Replace `app.invoke(state)` with `wf.run_sync(State(...))`
5. When ready for production: `wf.compile()` → `jamjet dev`

<Aside type="tip">
Full working examples in [jamjet-labs/jamjet-benchmarks](https://github.com/jamjet-labs/jamjet-benchmarks/tree/main/migrate/from-langgraph).
</Aside>
