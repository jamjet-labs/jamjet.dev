---
title: "Why I built JamJet's runtime in Rust"
date: 2026-03-08
description: "Not a trendy choice. A conviction-based one. Here is what it cost, what it taught me, and why I would do it again."
author: jamjet-team
category: "Strategy & Vision"
---

# Why I built JamJet's runtime in Rust

I want to be honest about this upfront: Rust was not the obvious choice. It was not the fast choice. And it was not the easy choice. But it was the right one — and I want to explain why, because I think the reasoning matters more than the decision itself.

---

## The wall

Before JamJet, I was building agentic AI workflows from a practitioner's angle. Multi-step orchestration, local model execution, RAG-style flows, code and task automation — the kind of stuff that is actually useful in real engineering environments, not just demo videos.

For a while, the demos looked good. But there is a specific moment I kept hitting, over and over: the point where a workflow became longer-running, stateful, concurrent, or needed to recover cleanly from a failure. That was the moment where everything started feeling fragile.

What looked elegant in Python or a high-level orchestration framework became messy the moment I wanted something reliable. Glue code everywhere. Hidden performance costs. Weak concurrency guarantees. Workflows that worked *most of the time* — which is another way of saying they did not work reliably enough to trust.

The painful realisation was this: I did not need a better wrapper. I needed a better runtime underneath.

---

## The decision

Python is obviously the fastest way to build and iterate in AI. I still think it is the right language for SDKs, experimentation, and adoption. But for the runtime layer — the thing responsible for scheduling, state, durability, and concurrency — I wanted something that could handle those concerns seriously.

I did think through the alternatives. Go was a genuine contender. Simpler operationally, great concurrency story, smaller learning curve. But I kept coming back to Rust for a few reasons:

- **Ownership semantics** force you to think clearly about who holds state and when it moves. That turns out to be exactly the right mental model for durable workflow execution.
- **No runtime surprises.** No GC pauses, no hidden allocations, predictable latency. When you are building something that sits between LLM calls and user-facing systems, predictability matters.
- **Tokio's async model** gave me exactly the kind of structured concurrency I needed for a scheduler that dispatches workflow nodes without double-execution.

If the goal was to ship something fast, I would not have picked Rust. But the goal was to build a core that does not collapse as complexity grows. That changed the calculus.

---

## What it cost

I will not pretend the Rust decision was free.

The learning curve is real — especially coming from an environment where Python lets you move fast and clean things up later. Rust does not let you do that. The compiler forces you to think carefully *before* things compile, not after. In the early weeks, that felt like friction. It took time before it started feeling like power.

Iteration speed is slower. You cannot throw things together carelessly. Compile times, ownership rules, async patterns, lifetime annotations — all of it adds overhead in the early stages. And from a hiring perspective, the Rust talent pool is narrower than Python. I accepted that tradeoff consciously. Not everyone will.

So no, this was not the easiest path. It was a conviction-based choice that the foundation matters more than the pace of the first few months.

---

## What surprised me

Once the mental model clicked, Rust did not just feel like a systems language. It started feeling like a design discipline.

It forced better boundaries. Clearer state handling. More honesty about how workflow steps, failures, retries, and concurrency should actually be modeled. That was unexpectedly valuable for AI workflows, where people consistently underestimate how quickly complexity explodes. A workflow that "just calls an LLM a few times" turns into a scheduling problem, a durability problem, a state management problem, and a concurrency problem faster than most people expect.

The other surprise was more of a philosophical shift. Building a Rust runtime for AI workflows made me think less about "agents" as magic and more about execution as infrastructure. Once you get past the hype, most of this space is really about scheduling, state transitions, recovery, typed interfaces, and predictable behavior. Rust pulled my thinking in that direction — and that made the JamJet vision stronger, not weaker.

---

## What this means for you

You do not need to know Rust to use JamJet. The Python SDK is the authoring surface — `@wf.step`, `@wf.state`, `wf.run_sync()`. It feels like Python because it is Python.

But underneath, the scheduler runs in a Tokio worker pool. State transitions are event-sourced. The executor uses distributed leases to prevent double-execution across multiple instances. Crash the process mid-workflow — it resumes exactly where it stopped.

That is what the Rust core buys you. You just do not have to pay for it directly.

```python
from pydantic import BaseModel
from jamjet import Workflow

wf = Workflow("research-agent")

@wf.state
class State(BaseModel):
    query: str
    answer: str = ""

@wf.step
async def think(state: State) -> State:
    # your LLM call here
    return state.model_copy(update={"answer": "..."})

result = wf.run_sync(State(query="What is JamJet?"))
print(result.events)  # full per-step timeline, free
```

---

Would I make the same choice again? Yes. Not because Rust is trendy — it is having a moment, but that is not why I picked it. Because the problems that matter in production AI systems are runtime problems. And runtime problems deserve runtime-level solutions.

If you want to try it: `pip install jamjet` and the [quickstart](/quickstart) takes about five minutes with a local Ollama model. No API key needed.

Questions or pushback welcome — open a [GitHub Discussion](https://github.com/jamjet-labs/jamjet/discussions) or find me on [X](https://x.com/jamjetdev).
