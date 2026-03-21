---
title: "Migrating from LangGraph to JamJet: what actually changes"
date: 2026-03-08
description: "A side-by-side walkthrough of the same workflow in LangGraph and JamJet — what maps across, what disappears, and what you gain."
author: jamjet-team
category: "Architecture & Deep Dives"
---

# Migrating from LangGraph to JamJet: what actually changes

I want to make this practical. Not a feature matrix, not marketing — a real look at the same workflow built in both frameworks, with honest commentary on what changes and why.

---

## The workflow

A 3-step research pipeline: extract keywords from a question → build an outline → write the answer. Simple enough to be readable, complex enough to show the differences that matter.

---

## LangGraph version

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict

class State(TypedDict):
    question: str
    keywords: list[str]
    outline: str
    answer: str

def extract_keywords(state: State) -> State:
    # LLM call here
    return {**state, "keywords": ["event sourcing", "distributed systems"]}

def build_outline(state: State) -> State:
    # LLM call here
    return {**state, "outline": "• Consistency\n• Availability\n• Partition tolerance"}

def write_answer(state: State) -> State:
    # LLM call here
    return {**state, "answer": "Event sourcing gives you..."}

graph = StateGraph(State)
graph.add_node("extract_keywords", extract_keywords)
graph.add_node("build_outline", build_outline)
graph.add_node("write_answer", write_answer)

graph.set_entry_point("extract_keywords")
graph.add_edge("extract_keywords", "build_outline")
graph.add_edge("build_outline", "write_answer")
graph.add_edge("write_answer", END)

app = graph.compile()
result = app.invoke({"question": "What is event sourcing?", "keywords": [], "outline": "", "answer": ""})
```

This works. I've used LangGraph. It is a solid framework. But notice a few things:

- State is a `TypedDict` — all fields must be declared upfront, including empty strings and lists you haven't filled yet
- Nodes are plain functions — which is fine, but the graph wiring (`add_node`, `add_edge`, `set_entry_point`) is separate from the functions themselves
- `END` is imported and used explicitly
- You pass the full initial state dict, including empty fields, to `invoke`

---

## JamJet version

```python
from pydantic import BaseModel
from jamjet import Workflow

wf = Workflow("research-pipeline")

@wf.state
class State(BaseModel):
    question: str
    keywords: list[str] = []
    outline: str = ""
    answer: str = ""

@wf.step
async def extract_keywords(state: State) -> State:
    # LLM call here
    return state.model_copy(update={"keywords": ["event sourcing", "distributed systems"]})

@wf.step
async def build_outline(state: State) -> State:
    # LLM call here
    return state.model_copy(update={"outline": "• Consistency\n• Availability\n• Partition tolerance"}})

@wf.step
async def write_answer(state: State) -> State:
    # LLM call here
    return state.model_copy(update={"answer": "Event sourcing gives you..."})

result = wf.run_sync(State(question="What is event sourcing?"))
```

The logic is identical. The differences:

- State is Pydantic — defaults live on the model, not in the `invoke` call
- Steps are declared *on* the workflow via decorator — the graph is implicit in declaration order
- No `END`, no `add_edge`, no `set_entry_point` — the wiring is the code structure
- Steps are `async` — which matters when you want actual concurrency later
- `run_sync` wraps the async runner so you can call it from anywhere

---

## What you get for free

After `wf.run_sync()` returns, `result` is not just the final state. It carries the full execution record:

```python
for evt in result.events:
    print(f"{evt.step}: {evt.duration_us / 1000:.0f}ms")

# extract_keywords: 1935ms
# build_outline: 1031ms
# write_answer: 1491ms

print(f"Total: {result.total_duration_us / 1000:.0f}ms")
# Total: 4458ms
```

No logging. No instrumentation. No middleware. Every step transition is an event — duration, status, state delta — recorded automatically.

In LangGraph, getting this requires LangSmith or wrapping your nodes. In JamJet, it is just there.

---

## Conditional routing

In LangGraph:

```python
def route(state: State) -> str:
    return "answer_factual" if state["question_type"] == "factual" else "answer_opinion"

graph.add_conditional_edges("classify", route, {
    "answer_factual": "answer_factual",
    "answer_opinion": "answer_opinion",
})
```

In JamJet:

```python
@wf.step(next={
    "answer_factual": lambda s: s.question_type == "factual",
    "answer_opinion": lambda s: s.question_type == "opinion",
})
async def classify(state: State) -> State:
    ...
```

The routing predicate is a plain Python lambda on the Pydantic state. You can test it without running the LLM:

```python
assert route_fn(State(question_type="factual")) == "answer_factual"
assert route_fn(State(question_type="opinion")) == "answer_opinion"
```

That testability is not incidental. It is the point.

---

## What stays the same

- Your LLM calls — exactly the same, through any OpenAI-compatible client
- Your prompts — unchanged
- Your business logic — it is just Python
- The mental model of a graph of steps with state flowing through

The migration surface is smaller than it looks. If you have a LangGraph workflow, most of the work is in the node functions. Those do not change at all.

---

## What disappears

- `TypedDict` → Pydantic `BaseModel` (same idea, better DX)
- `add_node` / `add_edge` / `set_entry_point` → decorators
- `END` → implicit (last step with no `next` routing is the end)
- `StateGraph.compile()` → handled internally
- Separate graph wiring from logic → everything co-located on the step

---

## What you gain

- Full execution timeline without any instrumentation
- Built-in eval harness — run a JSONL dataset through the workflow, score every output
- Crash recovery — if the process dies mid-run, it resumes from the last completed step
- Native MCP — connect any MCP tool server in one line
- Testable routing — predicates are plain Python, no mock graph needed

---

## Full migration guide

If you want the step-by-step: [jamjet.dev/migrate/from-langgraph](/migrate/from-langgraph)

Or just install and run one of the examples locally with Ollama — no API key needed:

```bash
pip install jamjet
git clone https://github.com/jamjet-labs/jamjet-benchmarks
cd jamjet-benchmarks/examples/01_pipeline_with_timeline
OPENAI_API_KEY=ollama OPENAI_BASE_URL=http://localhost:11434/v1 MODEL_NAME=llama3.2 python main.py
```
