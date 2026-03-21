---
title: "Why We Built JamJet"
date: 2026-03-15
description: "The demo-to-production gap in AI agents is real. Here is why we built a new runtime instead of reaching for another framework."
author: jamjet-team
category: "Strategy & Vision"
---

Everyone can build an AI agent demo in an afternoon. Getting that same agent to run reliably in production — handling failures, maintaining state across restarts, collaborating with other agents, and producing results you can actually trust — that is a fundamentally different problem. JamJet exists because we got tired of pretending these were the same problem.

This post explains the gap we kept hitting, why the existing tools did not close it, and what we decided to build instead.

---

## The demo-to-production gap

Here is a pattern we have seen dozens of times, and lived through ourselves:

**Day 1.** You wire up a few LLM calls, chain them together, add a tool or two. The demo works. Everyone is excited. Ship it.

**Week 2.** The API times out at step 4 of 7. The entire run is lost. You add retry logic. The retry causes a duplicate action because the first call actually succeeded — it just timed out on the response. Now you need idempotency. You write more glue code.

**Month 2.** You are running agents that take 10-15 minutes. They touch external systems. They make decisions. And when something goes wrong, you have no visibility into what happened, no way to replay the execution, and no way to resume from where it failed. You are debugging by reading logs and guessing.

**Month 4.** You realize you have spent more time building reliability infrastructure around your agent than building the agent itself. The orchestration framework you picked in week one is now the bottleneck. It does not have durability. It does not have structured state. It was built for prototyping, and you are trying to run it in production.

This is the demo-to-production gap. It is not a skill problem. It is an infrastructure problem.

---

## Why existing tools fall short

We tried everything before building JamJet. Every option had real strengths and a hard ceiling.

### Prototyping frameworks

LangChain, CrewAI, LangGraph — these tools are excellent for getting started. They give you abstractions for chains, agents, tools, and multi-agent coordination. You can build a working prototype in a few hours.

But they are Python-native runtimes with no durable execution. If your process crashes, your state is gone. If your agent run takes 20 minutes and fails at minute 18, you start over. There is no event sourcing, no checkpointing, no crash recovery. The concurrency model is Python's concurrency model, which means GIL contention and limited parallelism.

These are prototyping tools being asked to do production work. That is not a criticism — it is a category observation. They solve the "build a demo" problem well. They do not solve the "run it reliably" problem at all.

### Durable workflow engines

Temporal and Durable Functions solve the reliability side. They have event sourcing, replay, crash recovery, distributed scheduling. These are proven systems used in production at serious scale.

But they are not agent-native. They do not understand LLM calls, tool invocations, model routing, or evaluation loops. You end up wrapping every model call in an activity, manually serializing prompts and responses, building your own retry-with-feedback logic, and bolting on observability. You get durability, but you build everything agent-specific from scratch.

It works. But it is like using a general-purpose database as a message queue — technically possible, architecturally awkward, and you spend your time fighting the abstraction instead of building your product.

### Vendor SDKs

The OpenAI Agents SDK, Google ADK, and similar tools are well-designed for their respective ecosystems. If you are building exclusively on one provider's models, they offer tight integration and fast iteration.

The problem is lock-in. Your workflow definition, tool integration layer, and execution model are all coupled to a single vendor. Switching models means rewriting your orchestration. Multi-model workflows — using Claude for reasoning and Gemini for code generation in the same pipeline — become integration projects. And you are dependent on the vendor's roadmap for features like durability, evaluation, and multi-agent coordination.

We wanted model-agnostic orchestration that treats models as interchangeable resources, not as the foundation of the platform.

---

## What JamJet does differently

JamJet is a durable, graph-based workflow runtime built specifically for AI agents. The core is Rust. The authoring surface is Python (and Java, with Go coming). The key design decisions:

### Durability is not optional

Every workflow execution in JamJet is event-sourced. Before each node runs, we write a checkpoint. If the runtime crashes, the machine reboots, or you deploy a new version mid-execution — it resumes from exactly where it stopped.

This is not a feature you enable. It is the execution model. Every state transition, every tool call result, every model response is persisted as an event. You get full auditability and deterministic replay for free.

If the process crashes after step 3 completes but before step 4 starts, the runtime replays the first three results from the event log and continues. No re-execution. No lost work.

### Native protocol support

JamJet has first-class support for MCP (Model Context Protocol) and A2A (Agent-to-Agent Protocol). These are not plugins or community adapters — they are built into the runtime.

**MCP** gives you a standard interface to hundreds of tool servers. Instead of writing custom integrations for every API, you connect to MCP servers that expose tools through a common protocol. One integration pattern, any tool.

**A2A** gives your agents a standard way to collaborate with agents in other frameworks, other organizations, other runtimes. Your JamJet agent can delegate work to a LangGraph agent, receive tasks from a Google ADK agent, or coordinate with agents you did not build and do not control.

The runtime handles connection management, authentication, retries, and response normalization. You write the workflow logic.

### Rust core, polyglot authoring

The runtime — scheduler, state machine, event store, protocol handlers — is Rust + Tokio. No garbage collector, no GIL, real parallelism. The Python SDK compiles your workflow definitions into a Rust IR graph that the scheduler executes natively.

This means you write Python but your workflows run at Rust throughput. State serialization, node dispatch, concurrent fan-out/fan-in, checkpoint writes — all happen in the Rust runtime.

### Progressive API

JamJet meets you where you are:

- **`@task`** — a single durable function. Simplest entry point. Your existing Python function, but with checkpointing and crash recovery.
- **`Agent`** — a stateful entity with a model, tools, and an identity. Publishes an Agent Card for discovery via A2A.
- **`Workflow`** — a full DAG of nodes with typed state, conditional routing, fan-out, eval loops, and protocol integrations.

You start simple and add structure as your use case demands it. No framework tax on day one.

### Eval as a workflow node

Most evaluation tools are external to the execution pipeline. You run your agent, export the results, run a separate eval script, read the scores, and manually decide what to do.

In JamJet, evaluation is a node type. You put it directly in your workflow graph. It runs during execution, not after. And it can route: retry with feedback if the score is low, branch to a different strategy, or halt execution if quality gates are not met.

This turns evaluation from a post-hoc measurement into a runtime control mechanism. Your agents do not just produce output — they verify it before it leaves the system.

---

## The research angle

Something we did not expect: researchers started using JamJet before production teams did.

The pattern made sense once we saw it. Researchers running multi-agent experiments need exactly the same things production systems need — reproducibility, structured state, strategy comparison, and auditability — but for different reasons. A production team wants crash recovery. A researcher wants deterministic replay so they can compare reasoning strategies across hundreds of runs with controlled variables.

That realization shaped our roadmap significantly. We built `ExperimentGrid`, which lets you define parameter sweeps across models, strategies, and seeds, then run them as durable workflows with full event traces. Every cell in the grid is a durable workflow execution. If the experiment crashes at run 147 of 270, it resumes from 147. Results include full event traces, so you can inspect exactly what happened in any individual run.

We also added publication export — LaTeX tables, statistical significance tests (Welch's t-test, Wilcoxon, Mann-Whitney), formatted comparisons — because we realized that researchers were spending hours formatting results that the runtime already had in structured form.

This is not a separate product. It is the same runtime, the same durability model, the same eval nodes. Research and production are not different problems. They are different contexts for the same infrastructure.

---

## What is next

JamJet is open source under Apache 2.0. The Rust runtime, Python SDK, Java SDK, MCP + A2A support, eval harness, and policy engine are all available today.

Here is what we are building next:

- **Community and ecosystem.** More example workflows, more integrations, better documentation. We want JamJet to be the place where people share working agent patterns, not just abstractions.
- **Go SDK.** Same runtime, same IR, different authoring language. Go's concurrency model and deployment story make it a natural fit for infrastructure-heavy teams.
- **More reasoning strategies.** ReAct, plan-and-execute, critic, reflection, consensus, and debate are built in. We are adding more based on what users are actually building.
- **Enterprise features driven by real demand.** Multi-tenant isolation, PII redaction, OAuth delegation, typed failure taxonomy — but only as users need them. We are not building enterprise features speculatively.

The goal is straightforward: close the demo-to-production gap for AI agents. Make durability, evaluation, and protocol support default infrastructure instead of things you build yourself.

If that resonates, try it: `pip install jamjet`. The [quickstart](/quickstart) gets you to a running agent in under 10 minutes. And if you have feedback or want to tell us we are wrong about something — [open a GitHub issue](https://github.com/jamjet-labs/jamjet/issues). We are building in public.
