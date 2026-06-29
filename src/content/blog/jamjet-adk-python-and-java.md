---
title: "The JamJet ADK: Durable, Governed Agents in Python and Java"
date: 2026-06-29
description: "The friendly Agent, now durable and governed by default, on JamJet's event-sourced Rust engine. Same kit in Python (jamjet 0.11.0) and first-class Java and Spring authoring."
author: "Sunil Prakash"
category: "Build log"
---

Most agent SDKs hand you a clever loop and leave the hard parts to you. Kill the worker mid-run and the execution is gone. The model emits a destructive tool call and nothing stops it. There is no spend cap, no record of what the agent actually did, and no way to replay it after an incident. You add those things later, by bolting a workflow engine and a policy layer onto a loop that was never built for either.

That ordering is backwards. A durable, governed agent should be the thing you start with, not the thing you graduate to.

That is what the JamJet ADK is. The friendly `Agent` you already know, sitting on JamJet's event-sourced Rust engine, durable and governed by default. It sits under your agent framework, not in place of it. Today it ships in two languages.

## Python

```bash
pip install jamjet
```

A plain `Agent` is already durable and governed. The governance is constructor arguments, not a second system you wire up:

```python
from jamjet import Agent, tool

@tool
async def issue_refund(order_id: str, amount_usd: float) -> str:
    ...

agent = Agent(
    "support",
    model="anthropic/claude-sonnet-4-6",
    tools=[issue_refund],
    instructions="You resolve billing tickets.",
    budget=0.50,                         # fail-closed cost cap
    approval_required=["issue_refund"],  # human gate on the risky tool
)

result = await agent.run_durable("Refund order 8842 for $40")
```

The knobs, each enforced where it actually counts:

- `policy=` is a model allowlist and blocked-tool patterns.
- `approval_required=` is a human gate, enforced fail-closed inside the engine, not as a polite request to the model.
- `budget=` is a token and/or dollar cap that stops the run, not a dashboard you read after the overspend.
- `pii=` is redaction at the model seam.
- `audit=` is a signed, hash-chained record per action.
- `receipts=` is an AgentBoundary receipt per turn.

Past a single agent there is `Session` plus opt-in Engram memory for carried state, a `Team` API for multi-agent work (`Sequential`, `Parallel`, `Loop`, and a coordinator that routes the input to one specialist), and `agent.deploy(runtime="local" | "self-host" | "cloud")` to ship the same compiled agent to any of three engines that differ only by URL and token.

The devtools are one command each. `jamjet create` scaffolds a project, `jamjet dev` brings up the whole local stack (the model sidecar, the durable engine, and the tool worker) in one command, and `jamjet eval` scores agent trajectories.

## Java and Spring

Java authoring is first-class now, not a thin HTTP client over the Python SDK. Java 21, on Maven Central:

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-agent</artifactId>
    <version>0.4.0</version>
</dependency>
```

```java
Agent agent = Agent.builder("support")
        .model("anthropic/claude-sonnet-4-6")
        .tools(new BillingTools())
        .budget(new Budget(100_000, 2.50))      // cap tokens AND dollars
        .approvalRequired(List.of("issue_refund"))
        .build();

AgentResult result = agent.runDurable("Refund order 8842 for $40");
```

A `@Tool` annotation marks the methods the model may call. A Spring Boot starter (`jamjet-agent-spring-boot-starter`) takes it the rest of the way: add the dependency, annotate your `@Tool` `@Component`s, declare an `Agent` `@Bean` over the auto-built registry, and the durable tool worker is auto-configured.

The interesting part is what is *not* in that Maven dependency: a JVM reimplementation of the runtime. A Java agent compiles to the same agent-loop IR a Python agent compiles to, and runs on the same Rust engine, so it inherits the same durability and the same governance. I wrote that story up on its own in [Java agents on the same durable engine](/blog/java-agents-same-durable-engine/).

## What durable buys you

Both languages run on one engine with an event-sourced turn ledger. Kill the worker in the middle of a run and the agent finishes from the last committed turn instead of starting over and re-paying for every model call. Runs replay deterministically. The budget, the model allowlist, and the approval gates are enforced fail-closed in the engine, so a gate that says "stop and ask a human" survives a crash, a deploy, and an out-of-memory kill.

## Get started

```bash
pip install jamjet          # Python, 0.11.0
```

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-agent</artifactId>   <!-- Java, 0.4.0 -->
    <version>0.4.0</version>
</dependency>
```

The home for the kit, with quickstarts in both languages, is [adk.jamjet.dev](https://adk.jamjet.dev). Full reference lives at [docs.jamjet.dev](https://docs.jamjet.dev).
