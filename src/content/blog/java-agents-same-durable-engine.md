---
title: "Java Agents on the Same Durable Engine"
date: 2026-06-29
description: "How we gave Java first-class agent authoring without re-porting the runtime: a Java agent compiles to the same IR a Python agent does, runs on the same Rust engine, and inherits the same governance. Proven with a golden-file parity test."
author: "Sunil Prakash"
category: "Build log"
---

A Java AI agent that crashes at step 7 of 12 loses its state and skips its approvals, exactly like a Python one. The model is the same model. The failure mode is the same failure mode. The difference is that the JVM ecosystem spent the last year getting very good at *watching* agents and barely moved on *governing* them.

I wrote about that gap in [What's Missing in JVM AI](/blog/whats-missing-jvm-ai-governance/). Short version: Spring AI emits OpenTelemetry GenAI metrics out of the box, Quarkus LangChain4j wires up tracing with no config, and almost nothing on the JVM ships budget enforcement, audit trails, PII redaction, or a first-class human-in-the-loop gate. You can build a beautiful dashboard of exactly how much an agent spent overrunning its limit last night. Stopping it is still your code.

So when we set out to give Java a real agent-authoring surface, the question was not "can we write a fluent builder." It was "can a Java team get the same durability and the same enforcement a Python team gets, without us maintaining two runtimes that drift apart."

## The option we did not take

The obvious move is to re-port the runtime to the JVM: reimplement the event sourcing, the durable scheduler, replay, budget metering, policy evaluation, and approval gates, all in Java.

We have seen where that road goes. Two runtimes means two implementations of "what does fail-closed mean," two replay algorithms that have to agree byte-for-byte, two places to fix every governance bug. The durability and governance guarantees are the whole product. Proving them once is hard. Proving them twice, and keeping the two proofs in sync forever, is a tax you pay on every release.

We did not re-port the runtime. We gave Java a real authoring surface and pointed it at the engine we already trust.

## The design

A Java `Agent.builder(...)` compiles to the same agent-loop IR a Python `Agent` compiles to. The same Rust engine runs that IR. Three pieces make this work.

**The IR is the contract.** Both SDKs target one intermediate representation: a statically unrolled `model -> tools -> model` loop, with a gate node after each model turn that branches on whether the model asked for tools. The engine only ever sees IR. It does not know or care which language emitted it.

**Model calls route through the governed model seam.** A Java agent emits only `Model` nodes; it carries no model-provider code. The engine routes every governed model call through the model-seam sidecar, the same seam the Python path uses. That is where the model allowlist is checked, where the budget is metered, and where PII is redacted on the way out. Java inherits all of it for free because it runs through the same seam, not a reimplementation of it.

**Tools run on a new durable worker tier.** A `@Tool` method has to execute somewhere, durably and exactly-once. So the tool nodes a Java agent emits are `java_fn` nodes (where Python emits `python_fn`), and a new Java tool-worker tier drains a dedicated `java_tool` queue over the engine's HTTP claim/complete API. The engine enqueues the call, a `JavaToolWorker` claims it, invokes your method reflectively, and completes the work item back to the engine. It is the Java mirror of the hardened Python worker, framework-free Java 21, each tool dispatched on its own virtual thread.

### The lease fence, because zombies happen

Exactly-once is the hard part. A worker can stall (a long GC pause, a network partition) long enough for the engine to decide its lease expired and hand the same item to a fresh claimant. Now two workers think they own one tool call. If both complete it, the side effect fires twice. For a refund or a wire transfer that is the entire problem you came to solve, made worse.

Two independent guards prevent the double-complete:

1. **Heartbeat abort.** While a tool runs, the worker renews its lease with the claim's `lease_fence`. If the engine rejects a heartbeat (the lease is gone), the worker cancels the in-flight dispatch and does not complete.
2. **Complete-time fence.** The completion echoes the same `lease_fence`. The engine fences on it and rejects a stale lease with HTTP 409, emitting no `NodeCompleted`. The worker treats that 409 as a lost-lease no-op. It does not fail the item, because failing would clobber the work the new claimant is now doing.

The second guard is the authoritative backstop: even if the heartbeat abort has not fired yet, a reclaimed worker physically cannot record a completion the engine will accept.

There is a quieter security property in the same worker: it never reflects on an attacker-influenceable string. The only `java_fn` coordinate the builder emits is one fixed dispatcher, so a work item naming any other class or method is rejected before any reflection happens. A forged node can never turn a payload string into `Class.forName`.

## The proof: a golden-file parity test

Claiming "the same IR" is cheap. So we pinned it.

The Python compiler emits the canonical agent-loop IR for a fixture agent (a model, two `@tool` functions, instructions, an inline policy, an approval glob, a token-and-cost budget, PII on) and we checked that JSON in as a golden file. A test then builds the structurally identical Java agent, compiles it, and asserts the Java IR matches the golden tree.

Every load-bearing field matches: the node ids, the nine edges of the loop, the gate condition (`state.last_model_finish_reason == "tool_calls"`), the governance block (policy, `cost_budget_usd`, `token_budget`, and the `data_policy` with its four PII detectors), and the `Model` nodes including the exact OpenAI-format tool schemas offered to the model. That last one matters most: it is what makes "the model sees the same thing on both runtimes" literally true.

The one structural difference is the tool node kind. Python emits `python_fn`, Java emits `java_fn` pointing at the fixed Java dispatcher. The test normalizes away the few cosmetic differences (the version string is a content hash, so it differs when the content differs; per-node descriptions are human text the engine ignores) and then asserts the entire Java IR tree deep-equals the Python tree. Node for node, the graph the engine runs is the same graph.

```text
__model_0__  ->  __tool_gate_0__  ->  __tools_0__  ->  __model_1__  ->  ...  ->  __model_2__
                        |  (no tool calls)
                        +-------------------------------------------------->  end
```

The only box that changes name is `__tools_0__`.

## What it looks like

Author tools as ordinary methods. Mark them with `@Tool`:

```java
public class BillingTools {

    @Tool(name = "issue_refund", description = "Refund an order, in USD.")
    public String issueRefund(String orderId, double amountUsd) {
        return billing.refund(orderId, amountUsd);
    }
}
```

Build the agent and run it durably:

```java
Agent agent = Agent.builder("support")
        .model("anthropic/claude-sonnet-4-6")
        .instructions("You resolve billing tickets.")
        .tools(new BillingTools())
        .budget(new Budget(100_000, 2.50))          // tokens AND dollars, fail-closed
        .policy(new PolicySetIr(
                List.of("delete_*"),                 // blocked_tools
                List.of(),                           // require_approval_for
                List.of("anthropic/claude-sonnet-4-6"))) // model allowlist
        .approvalRequired(List.of("issue_refund"))   // human gate
        .build();

AgentResult result = agent.runDurable("Refund order 8842 for $40");
```

That runs the same durable, governed loop the Python equivalent runs. Kill the worker mid-run and the agent resumes from the last committed turn. The refund parks on its approval gate and waits, and the wait survives a restart, because the parked state is the event log.

### Spring, with one dependency

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-agent-spring-boot-starter</artifactId>
    <version>0.4.0</version>
</dependency>
```

Annotate your `@Tool` holders as `@Component`s, declare an `Agent` `@Bean` built over the auto-configured `ToolRegistry` (use `.registry(registry)` so the agent offers the model exactly the tools the worker can dispatch), and the starter auto-starts a background `java_tool` worker bound to the engine for the life of the context. The auto-config deliberately wraps only framework-free types, so it puts no Spring AI or LangChain4j on your classpath and its bean types always link.

## One honest caveat

This path is not self-contained. A durable Java run needs the JamJet engine running, the model-seam sidecar running, and a Java tool worker draining the queue (the Spring starter provides that last piece). That is the cost of reusing one engine instead of shipping a second, and I will defend it: I would rather run a sidecar than maintain a divergent reimplementation of every governance guarantee on the JVM.

The JVM has a well-built observability floor and a missing governance wall. A Java agent that compiles to the same IR and runs on the same engine as its Python sibling builds that wall without asking anyone to leave the JVM, or Spring AI, or LangChain4j, to get it.

Start at [adk.jamjet.dev](https://adk.jamjet.dev). The Java module is `dev.jamjet:jamjet-agent` on Maven Central, with the Spring starter alongside it.
