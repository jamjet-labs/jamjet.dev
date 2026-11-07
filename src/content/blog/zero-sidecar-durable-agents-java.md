---
title: "Zero-Sidecar Durable AI Agents in Java"
date: 2026-04-25
description: "The JamJet Java Runtime checkpoints agent steps inside your JVM, with no Docker, no sidecar and no REST hop. How replay-or-execute works and what it saves."
author: "Sunil Prakash"
category: "Build log"
---

> **Correction, November 2026.** An earlier version of this post said checkpoints go to an append-only event log, that a restart resumes on its own, and that the `@Checkpoint` annotations work through the Java agent. None of that matches the released code (0.4.0). Checkpoints live in an in-memory map. Resuming after a restart means saving those results and loading them into the next process. The annotation path fails for classes outside the library's own package. The sections below now describe what the code does, and the install snippets show 0.4.0.

Enterprise Java teams building multi-step AI agents face a durability problem that most frameworks do not address.

## The Problem

A multi-step agent -- search the web, call an LLM, write results to a database -- is stateful. If the JVM crashes or is killed between steps, the work in progress is lost. The next run starts from scratch, making the same LLM API calls, burning the same token budget, taking the same wall-clock time.

The existing solutions are unsatisfying:

**Option 1: Accept the loss.** Spring AI and LangChain4j are excellent libraries, but neither provides durable execution. A crash means a full retry. For a 10-step agent with an LLM call at each step, that is potentially 10x the API spend and 10x the latency.

**Option 2: Bolt on a sidecar.** The Rust-based JamJet runtime solves durability, but it runs as a separate process. Every checkpoint becomes a REST call. Your Spring service depends on Docker being up. CI needs the sidecar running before tests start. Ops complexity grows linearly with agent complexity.

Neither option is acceptable for production-grade agents.

## The Solution

```java
@DurableAgent("research-pipeline")
@Service
public class ResearchAgent {

    @Checkpoint("search")
    public String search(String topic) {
        return DurabilityContext.current().replayOrExecute("search", () ->
            searchClient.query(topic)
        );
    }

    @Checkpoint("analyze")
    public String analyze(String sources) {
        return DurabilityContext.current().replayOrExecute("analyze", () ->
            llm.chat(SYSTEM_PROMPT, sources)
        );
    }
}
```

Add one dependency, then create a `DurabilityContext` and bind it to the thread before the agent runs. `DurabilityContext.current()` returns null until you do, and the starter does not do it for you.

The runtime lives inside your JVM. No REST hops, no Docker, no sidecar. Checkpoints are kept in memory, so to continue from `analyze` after a crash you save the recorded results and load them into the next process. The crash-recovery demo below shows how.

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-runtime-spring-boot-starter</artifactId>
    <version>0.4.0</version>
</dependency>
```

## How It Works

### Replay or execute

Every `replayOrExecute` call either executes the lambda and records its return value under the checkpoint ID, or, when the context is in replay mode and already holds a result for that ID, returns the stored value without executing the lambda.

The results live in an in-memory map on the context. Nothing is written to disk. A new context starts empty, so a restarted process re-runs every step unless you load the saved results into it (`recordResult` for each one, then `setReplayMode(true)`).

```java
// On first run: executes and records
String result = ctx.replayOrExecute("search", () -> searchClient.query(topic));

// On recovery (replay mode, result loaded): returns the stored value, lambda never called
String result = ctx.replayOrExecute("search", () -> searchClient.query(topic));
```

The lambda is the unit of idempotency. The ID is the checkpoint name. Same name, same result.

### ByteBuddy Instrumentation

`@DurableAgent` and `@Checkpoint` are marker annotations. With the JamJet Java agent attached (`-javaagent`), ByteBuddy transforms classes annotated with `@DurableAgent` and wraps each `@Checkpoint` method: in replay mode, a method whose checkpoint ID already has a result returns it without running its body.

In 0.4.0 that path throws `IllegalAccessError` whenever a context is bound and the class sits outside the library's own package, which means any class you write. Use the explicit API: bind a context with `DurabilityContext.setCurrent` and call `replayOrExecute` yourself. It needs no JVM agent and works in any test runner or CI job.

### Virtual Threads

Every agent run executes on its own virtual thread (Java 21 `Thread.ofVirtual()`). There are no thread pools to tune. No `CompletableFuture` chains. No reactive operators. Write blocking code -- `Thread.sleep`, JDBC, `HttpClient.send` -- and the JVM scheduler handles concurrency.

## Benchmarks

The [examples/latency-comparison](https://github.com/jamjet-labs/jamjet-runtime-java/tree/main/examples/latency-comparison) benchmark measures embedded runtime vs REST sidecar (WireMock). Run it yourself with `mvn compile exec:java`.

```
Single Workflow Latency (1000 iterations):
                              p50      p95      p99
Embedded runtime            0.63ms   1.03ms   1.60ms
REST sidecar                1.42ms   3.06ms   3.76ms
Overhead saved                56%      66%      57%

Concurrent (100 simultaneous workflows):
Embedded:  100/100 in 7ms    (avg 0.07ms/workflow)
REST:      100/100 in 62ms   (avg 0.62ms/workflow)
Speedup:   8.9x
```

These numbers measure pure runtime overhead with stubbed responses. In production, LLM latency (200ms-5s) dominates -- but runtime overhead compounds across multi-step agents. A 20-step agent with 2ms overhead per checkpoint adds 40ms of pure scheduling noise.

The concurrent benchmark is where virtual threads shine. 100 simultaneous 3-node workflows complete in 7ms embedded vs 62ms through REST -- an 8.9x speedup driven by eliminating HTTP connection pool contention.

## Crash Recovery Demo

The [examples/crash-recovery](https://github.com/jamjet-labs/jamjet-runtime-java/tree/main/examples/crash-recovery) demo shows checkpoint recovery without requiring a real LLM.

**Phase 1 -- crash after step 2:**

```
[1/3] Executing search for "quantum computing"...        checkpointed (506ms)
[2/3] Executing analyze...                               checkpointed (505ms)
[CRASH] Process killed after checkpoint 2.
```

**Phase 2 -- recover and complete:**

```
[1/3] Replaying search from checkpoint...                skipped (0ms)
[2/3] Replaying analyze from checkpoint...               skipped (0ms)
[3/3] Executing synthesize...                            completed (507ms)

Recovery complete.
  Replayed:     2 checkpoints (saved ~1000ms)
  Re-executed:  1 step
  Total time:   508ms (vs ~1500ms without recovery)
```

Search took 0ms the second time. The work did not run: phase 1 wrote its recorded results to a file, and the recovery runner loaded them into a new context in replay mode. Saving and loading that file is the example's own code, not something the library does for you.

## Migration Guides

JamJet is not asking you to rewrite. It is asking you to wrap each step in one method call. Each example below assumes a `DurabilityContext` is already bound to the calling thread.

### From Spring AI

Your `ChatClient` stays the same. You keep your prompt templates, your tools, your advisors. Add the JamJet layer around the LLM calls that need durability.

**Before:**

```java
@Service
public class SummarizationAgent {
    private final ChatClient chat;

    public String summarize(String document) {
        return chat.prompt().user(document).call().content();
    }
}
```

**After:**

```java
@DurableAgent("summarization")
@Service
public class SummarizationAgent {
    private final ChatClient chat;

    @Checkpoint("summarize")
    public String summarize(String document) {
        return DurabilityContext.current().replayOrExecute("summarize", () ->
            chat.prompt().user(document).call().content()
        );
    }
}
```

### From LangChain4j

Keep the `@AiService` interface. Wrap it in a durable orchestrator class.

**Before:**

```java
@Service
public class ResearchOrchestrator {
    @Autowired private ResearchAssistant assistant;

    public String run(String topic) {
        String sources = assistant.search(topic);
        return assistant.analyze(sources);
    }
}
```

**After:**

```java
@DurableAgent("research")
@Service
public class ResearchOrchestrator {
    @Autowired private ResearchAssistant assistant;

    public String run(String topic) {
        String sources = checkpoint("search", () -> assistant.search(topic));
        return checkpoint("analyze", () -> assistant.analyze(sources));
    }

    private <T> T checkpoint(String id, Supplier<T> fn) {
        return DurabilityContext.current().replayOrExecute(id, fn);
    }
}
```

### From Google ADK Java

Your Gemini client calls are unchanged. Wrap the individual LLM calls with `replayOrExecute`.

**Before:**

```java
public class GeminiPipelineAgent {
    private final GenerativeModel model;

    public String analyze(String document) {
        GenerateContentResponse r = model.generateContent(document);
        return r.getCandidates(0).getContent().getParts(0).getText();
    }
}
```

**After:**

```java
@DurableAgent("gemini-pipeline")
public class GeminiPipelineAgent {
    private final GenerativeModel model;

    @Checkpoint("analyze")
    public String analyze(String document) {
        return DurabilityContext.current().replayOrExecute("analyze", () -> {
            GenerateContentResponse r = model.generateContent(document);
            return r.getCandidates(0).getContent().getParts(0).getText();
        });
    }
}
```

## Comparison

| Feature | JamJet | Spring AI | LangChain4j | Koog | Google ADK |
|---------|--------|-----------|-------------|------|------------|
| Step checkpoints | Yes (in memory) | No | No | No | No |
| Resume after a crash | Load saved checkpoints into a new context | No | No | No | No |
| Virtual threads | Native | No | No | Coroutines | No |
| Plugin hot-reload | ClassLoader isolated | No | No | No | No |
| MCP native | Client + Server | Client only | Client only | No | Client only |
| Bytecode instrumentation | @DurableAgent (fails outside its own package in 0.4.0) | No | No | No | No |
| Sidecar required | No | N/A | N/A | N/A | N/A |

## Getting Started

Add the dependency:

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-runtime-spring-boot-starter</artifactId>
    <version>0.4.0</version>
</dependency>
```

Or without Spring:

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-runtime-instrument</artifactId>
    <version>0.4.0</version>
</dependency>
```

No additional infrastructure required. The only backend is in-memory: `jamjet.storage` accepts `in-memory`, and any other value logs a warning and falls back to it.

Start with the [real-agent example](https://github.com/jamjet-labs/jamjet-runtime-java/tree/main/examples/real-agent) -- it runs with one environment variable (`OPENAI_API_KEY`) and no other infrastructure.

For a side-by-side comparison of the old sidecar pattern vs the new embedded pattern, see [spring-boot-comparison](https://github.com/jamjet-labs/jamjet-runtime-java/tree/main/examples/spring-boot-comparison).

Full documentation: [docs.jamjet.dev](https://docs.jamjet.dev)

Source code: [github.com/jamjet-labs/jamjet-runtime-java](https://github.com/jamjet-labs/jamjet-runtime-java)
