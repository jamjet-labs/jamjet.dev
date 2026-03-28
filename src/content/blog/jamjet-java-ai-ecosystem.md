---
title: "JamJet and the JVM AI Ecosystem: Where Java, Kotlin, and Scala Meet Production Agents"
date: 2026-03-28
description: "A sourced comparison of every major JVM AI framework — Spring AI, LangChain4j, LangGraph4j, Koog, Embabel, Google ADK — and where JamJet's Rust-powered runtime fills the production gap. With Java, Kotlin, and Scala perspectives."
author: "Sunil Prakash"
draft: false
category: "Technical Deep Dive"
---

# JamJet and the JVM AI Ecosystem: Where Java, Kotlin, and Scala Meet Production Agents

*The JVM AI ecosystem has matured faster than most people realize. This article maps the entire landscape — every major framework, what it optimizes for, and where the production gap remains. JamJet exists to fill that gap.*

In 2023, building AI agents on the JVM meant writing raw HTTP calls to OpenAI. By mid-2026, the ecosystem includes nine frameworks, three protocol standards, and first-class support across Java, Kotlin, and Scala. The landscape at [AI4JVM](https://ai4jvm.com/) — curated by Java Champion James Ward — lists 15 agent frameworks and libraries. Spring AI and LangChain4j both hit 1.0 GA in May 2025. MCP server downloads grew from 100K to 8M+ in six months.

The question is no longer "can I build AI agents on the JVM?" It is "which framework solves my specific problem — and what happens when I need to run it in production?"

This article answers both questions.

---

## The landscape: what exists and what each framework optimizes for

Here is every major JVM AI framework as of March 2026, what it does best, and what it trades off:

| Framework | Language | Optimized For | Key Strength | Tradeoff |
|-----------|----------|---------------|--------------|----------|
| **Spring AI** | Java | Spring ecosystem | Familiar patterns, auto-config, 20+ providers, MCP | Less specialized for complex agentic workflows |
| **LangChain4j** | Java | Breadth & flexibility | Massive provider ecosystem, RAG, tool calling, MCP | More boilerplate than Spring's auto-config |
| **LangGraph4j** | Java | Stateful multi-agent | Cyclical graphs, feedback loops, persistent checkpoints | Newer, inspired by Python LangGraph |
| **Google ADK** | Java | Gemini-native, A2A | Agent-to-agent protocol, code-first | Java binding still maturing (v0.1.0) |
| **Koog** | Kotlin | Multiplatform | Type-safe DSL, coroutines, iOS/Android/JVM/WASM | Smaller community than Spring/LangChain4j |
| **Embabel** | Kotlin/Java | Deterministic planning | GOAP — LLM-independent planning, explainable | Requires thinking in GOAP terms |
| **Quarkus LangChain4j** | Java | Cloud-native | GraalVM native image, fast startup, MCP | Kubernetes-centric |
| **Semantic Kernel** | Java | Azure integration | Microsoft's orchestration SDK, prompt chaining | Azure-centric |
| **JamJet** | Java/Kotlin | Production durability | Rust runtime, event-sourced state, crash recovery, audit trails, MCP + A2A | Newer ecosystem, requires runtime server |

Each of these frameworks solves a real problem. The question is which layer of the stack you need.

---

## The three layers of the AI agent stack

Most confusion about JVM AI frameworks comes from conflating three distinct layers:

### Layer 1: Model abstraction

**What it solves:** Calling different LLM providers without rewriting your code.

**Who does this well:** Spring AI (20+ providers, auto-config), LangChain4j (20+ providers, unified API), OmniHai (lightweight, zero dependencies).

This is the layer where the JVM ecosystem is most mature. If you just need to call Claude, GPT-4, or Gemini from Java and handle responses, Spring AI or LangChain4j will get you there in minutes.

### Layer 2: Agent orchestration

**What it solves:** Coordinating multi-step, multi-agent workflows — planning, tool use, feedback loops, state management.

**Who does this well:** LangGraph4j (cyclical graphs with checkpoints), Embabel (GOAP planning), Koog (coroutine-based coordination, fault tolerance), Google ADK (A2A protocol).

This is where the ecosystem gets interesting. LangGraph4j introduced cycles — feedback loops where agents can re-evaluate and adjust — which is essential for real-world workflows. Embabel took a different approach: instead of asking the LLM to plan everything, it uses Goal-Oriented Action Planning (GOAP) to generate deterministic, explainable action sequences. The LLM decides *what* to do; the planner decides *how*.

### Layer 3: Production runtime

**What it solves:** Running agent workflows durably in production — crash recovery, state persistence, audit trails, human-in-the-loop, observability.

**This is the gap.** Most JVM frameworks operate at Layers 1 and 2. They help you build and orchestrate agents. But when the process crashes at step 7 of 10, when you need a complete audit trail for compliance, when a human needs to approve a decision mid-workflow — the framework hands you back to "build it yourself."

This is where JamJet operates.

---

## Where JamJet fits

JamJet is not a model abstraction layer. It is not a replacement for Spring AI or LangChain4j. It is a **production runtime** — a Rust-powered execution engine that provides the infrastructure layer beneath your agent frameworks.

Here is what that means concretely:

| Capability | Framework Layer (Spring AI, LangChain4j, etc.) | JamJet Runtime |
|-----------|-----------------------------------------------|----------------|
| Call an LLM | ✅ Built-in | Uses your existing provider |
| Tool calling / MCP | ✅ Built-in | ✅ Native MCP client + server |
| Multi-agent orchestration | ✅ Via LangGraph4j, Embabel, etc. | ✅ Graph-based workflow engine |
| Crash recovery (mid-workflow) | ❌ Build it yourself | ✅ Event-sourced, automatic resume |
| Complete audit trail | ❌ Build it yourself | ✅ Every step logged automatically |
| Human-in-the-loop (mid-workflow) | ❌ Build it yourself | ✅ First-class approval nodes |
| Agent-to-agent protocol (A2A) | Partial (Google ADK) | ✅ Native A2A support |
| Model-agnostic execution | Varies | ✅ Any provider via MCP |
| Replay and fork workflows | ❌ Not available | ✅ Built-in replay/fork |

The key insight: **JamJet is complementary to existing frameworks, not competitive.** You can use Spring AI for model abstraction, LangGraph4j for orchestration patterns, and JamJet as the runtime that makes it all durable and auditable.

---

## Java: the enterprise workhorse

Java remains the dominant JVM language for enterprise AI agents. The ecosystem is deepest here — Spring AI, LangChain4j, and Quarkus LangChain4j all target Java first.

JamJet's Java SDK uses modern Java patterns — records, sealed interfaces, virtual threads (Project Loom), and a fluent builder API:

```java
// Define a tool as a Java record
@Tool(description = "Search the web for information")
record WebSearch(String query) implements ToolCall<String> {
    public String execute() {
        return searchApi.search(query);
    }
}

// Build an agent with the fluent API
var agent = Agent.builder("researcher")
        .model("claude-haiku-4-5-20251001")
        .tools(WebSearch.class)
        .instructions("Search first, then summarize thoroughly.")
        .strategy("react")
        .maxIterations(5)
        .build();

// Compile to IR and submit to the durable runtime
var ir = agent.compile();
var result = agent.run("What is the state of AI on the JVM?");
```

The `compile()` step is what makes JamJet different. Your agent definition compiles to an intermediate representation (IR) — a serializable graph of nodes and edges — that the Rust runtime executes with full durability. If the process crashes between steps, execution resumes from the last completed step. Every tool call, every LLM response, every decision is logged automatically.

For plan-and-execute workflows with cost controls:

```java
var analyst = Agent.builder("investment-researcher")
        .model("gpt-4o")
        .tools(WebSearch.class, FetchUrl.class, StoreNote.class)
        .instructions("""
            You are a professional investment research analyst.
            Search for recent news, financials, and competitive landscape.
            Produce a memo with: Executive Summary, Key Financials, Risks.
            """)
        .strategy("plan-and-execute")
        .maxIterations(6)
        .maxCostUsd(0.50)       // Hard cost ceiling
        .timeoutSeconds(120)    // Hard time ceiling
        .build();
```

And for structured, multi-step workflows using the lower-level Workflow API:

```java
// RAG pipeline with typed state
record RagState(String query, List<String> docs, String answer) {}

var workflow = Workflow.<RagState>builder("rag-assistant")
        .version("1.0.0")
        .state(RagState.class)
        .step("retrieve", state -> {
            var docs = vectorStore.search(state.query());
            return new RagState(state.query(), docs, null);
        })
        .step("synthesize", state -> {
            var context = String.join("\n", state.docs());
            var answer = llm.generate(state.query(), context);
            return new RagState(state.query(), state.docs(), answer);
        })
        .build();

// Every step is checkpointed — crash at "synthesize" resumes from there
var result = workflow.run(new RagState("How does JamJet handle durability?", List.of(), null));
```

The Java examples are available in the repo:
- [Basic Tool Flow](https://github.com/jamjet-labs/jamjet/tree/main/sdk/java/examples/basic-tool-flow) — single agent with ReAct strategy
- [Plan and Execute](https://github.com/jamjet-labs/jamjet/tree/main/sdk/java/examples/plan-and-execute-agent) — structured research with cost constraints
- [RAG Assistant](https://github.com/jamjet-labs/jamjet/tree/main/sdk/java/examples/rag-assistant) — workflow-based and agent-based RAG
- [Vertex AI Agent](https://github.com/jamjet-labs/jamjet/tree/main/examples/vertex-ai-agents/java) — Google Gemini integration

---

## Kotlin: the type-safe agent language

Kotlin is emerging as a serious contender for AI agent development on the JVM. JetBrains released Koog — a Kotlin-native agent framework with coroutines, type-safe DSLs, and multiplatform deployment. Rod Johnson (the creator of Spring Framework) built Embabel in Kotlin. The language's features map naturally to agent patterns:

- **Coroutines** → lightweight concurrency for multi-agent coordination without callback hell
- **Type-safe DSLs** → fluent, readable agent definitions that catch errors at compile time
- **Sealed classes** → exhaustive state machine patterns for agent workflows
- **Null safety** → prevents the NullPointerException that crashes long-running agent processes
- **Multiplatform** → deploy the same agent logic to server, Android, iOS, and browser

JamJet's Java SDK works seamlessly from Kotlin with full interop. The builder API becomes even more concise with Kotlin's named arguments and trailing lambdas:

```kotlin
// Kotlin tool definition — records become data classes
@Tool(description = "Search documents in the knowledge base")
data class SearchDocs(val query: String) : ToolCall<String> {
    override fun execute(): String =
        vectorStore.search(query).joinToString("\n")
}

@Tool(description = "Analyze sentiment of customer feedback")
data class AnalyzeSentiment(val text: String) : ToolCall<String> {
    override fun execute(): String =
        sentimentApi.analyze(text).let { "${it.label} (${it.score})" }
}

// Kotlin agent builder — concise with named parameters
val agent = Agent.builder("customer-insights")
    .model("claude-sonnet-4-6-20260327")
    .tools(SearchDocs::class.java, AnalyzeSentiment::class.java)
    .instructions("""
        You analyze customer feedback patterns.
        Search the knowledge base first, then analyze sentiment.
        Provide actionable insights with supporting data.
    """.trimIndent())
    .strategy("react")
    .maxIterations(8)
    .maxCostUsd(0.25)
    .build()

// Compile and run — same durable execution as Java
val ir = agent.compile()
val result = agent.run("What are the top complaints this quarter?")
println("Insights: ${result.output()}")
println("Tool calls: ${result.toolCalls().size}")
```

For teams already using Koog or Embabel for orchestration, JamJet can serve as the durable execution layer underneath — compiling your agent definitions to IR and running them on the Rust runtime with crash recovery and audit trails.

---

## Scala: the data pipeline perspective

Scala occupies a different niche in the AI stack. While Java and Kotlin dominate agent frameworks, Scala remains the language of choice for large-scale data and ML pipelines — Apache Spark, Kafka Streams, and distributed training.

For AI agent workflows, Scala's functional patterns offer interesting possibilities — particularly for building deterministic, reproducible transformations. JamJet's Java SDK works from Scala via standard Java interop:

```scala
import dev.jamjet.agent.Agent
import dev.jamjet.tool.{Tool, ToolCall}

// Scala tool definition
@Tool(description = "Query Spark for aggregated metrics")
case class QueryMetrics(dataset: String, metric: String) extends ToolCall[String]:
  def execute(): String =
    spark.sql(s"SELECT $metric FROM $dataset").collect().mkString("\n")

@Tool(description = "Generate a data quality report")
case class DataQualityCheck(table: String) extends ToolCall[String]:
  def execute(): String =
    qualityFramework.validate(table).summary

// Build an agent for data pipeline monitoring
val monitor = Agent.builder("data-pipeline-monitor")
  .model("gpt-4o")
  .tools(classOf[QueryMetrics], classOf[DataQualityCheck])
  .instructions(
    """You monitor data pipeline health.
      |Query metrics for anomalies, run quality checks,
      |and report issues with severity and recommended actions.""".stripMargin)
  .strategy("plan-and-execute")
  .maxIterations(4)
  .build()

val ir = monitor.compile()
// Submit to JamJet runtime — durable, auditable, recoverable
```

The Scala use case for JamJet is less about building chatbots and more about **intelligent data pipeline orchestration** — agents that monitor data quality, detect anomalies, trigger remediation, and produce audit trails. For teams with existing Spark/Kafka infrastructure, JamJet provides the durable execution layer that makes these agents production-grade.

---

## Where the JVM AI ecosystem is heading

Based on the trajectory from 2023 to mid-2026, six trends define the next phase:

### 1. MCP is the universal tool protocol

MCP server downloads grew from 100K (November 2024) to 8M+ (April 2025). Every major JVM framework supports it — Spring AI, LangChain4j, Quarkus, Koog. In December 2025, MCP was donated to the Agentic AI Foundation under the Linux Foundation, ensuring vendor neutrality.

Running an MCP server is becoming as routine as running a web server. The debate over *how* agents call tools is settled. JamJet implements MCP natively — both client and server — making it interoperable with every MCP-compatible framework from day one.

### 2. A2A is the next protocol frontier

Google released the Agent-to-Agent (A2A) protocol and Java ADK v0.1.0. A2A enables agents built in different frameworks — or different languages — to discover, negotiate with, and delegate to each other. This is still early on the JVM, but the direction is clear: agents that can only talk to agents in the same framework are agents that cannot scale.

JamJet supports A2A natively alongside MCP. Agents compiled to JamJet's IR can communicate with agents in any A2A-compatible framework — including Google ADK, Python frameworks, and other JamJet instances.

### 3. The shift from chat wrappers to agentic workflows

The 2023 pattern was "call an LLM and display the response." The 2026 pattern is multi-step, multi-agent workflows with planning, tool use, feedback loops, and human oversight. Spring AI documented five agentic design patterns. LangGraph4j introduced cycles. Embabel brought deterministic planning.

The shift is clear: **agents are becoming workflows**, and workflows need infrastructure — state management, persistence, observability, crash recovery. This is exactly the gap JamJet fills.

### 4. GraalVM native compilation changes deployment

GraalVM 25 brought production-grade native image compilation for AI workloads: 50MB executables, 20ms startup, 50MB memory footprint. Quarkus LangChain4j already supports native compilation. This enables serverless AI agents on AWS Lambda and Google Cloud Functions with sub-100ms cold starts.

JamJet's Rust core achieves similar performance characteristics without GraalVM — the runtime is natively compiled. For teams using Quarkus or GraalVM for their Java services, JamJet's runtime complements their stack with durable execution.

### 5. Virtual threads make agent code readable again

Project Loom's virtual threads (JDK 21+) fundamentally change how AI agents handle I/O. Agents make frequent external calls — LLM providers, tool APIs, databases. With virtual threads, each call can block without wasting OS threads. No async/await callbacks, no reactive streams complexity — just straightforward blocking code that scales to millions of concurrent tasks.

JamJet's Java SDK is built on virtual threads. Agent tool calls, LLM requests, and workflow steps all use virtual threads transparently.

### 6. The production gap is the defining challenge

67% of organizations are experimenting with AI agents. Only 11% have deployed them in production (KPMG, mid-2025). Gartner predicts 40%+ of agentic AI projects will be cancelled by end of 2027 due to escalating costs, unclear ROI, and inadequate risk controls.

The root cause — as we documented in [our analysis of AI agent failures](/blog/ai-agent-failures-root-cause/) — is almost always the same: prototype infrastructure in production. No crash recovery, no audit trail, no human-in-the-loop, no quality monitoring. The frameworks that help you *build* agents are mature. The infrastructure that helps you *run* them reliably is not.

This is JamJet's thesis: the model abstraction and orchestration layers are solved. The production runtime layer is the bottleneck.

---

## When to use what: a decision guide

**You need to call LLMs from Java and handle responses:**
→ Spring AI or LangChain4j. Both are mature, well-documented, and support 20+ providers.

**You need multi-agent workflows with feedback loops:**
→ LangGraph4j (cyclical graphs), Embabel (deterministic GOAP planning), or Koog (Kotlin coroutines).

**You need Kotlin-native, multiplatform agent deployment:**
→ Koog by JetBrains. Type-safe DSL, coroutines, iOS/Android/JVM/WASM.

**You need cloud-native with fast startup:**
→ Quarkus LangChain4j. GraalVM native image, sub-100ms cold starts.

**You need agents that survive crashes, produce audit trails, and support human-in-the-loop:**
→ JamJet. Event-sourced durability, automatic audit trails, first-class human oversight, native MCP + A2A.

**You need all of the above:**
→ Use Spring AI or LangChain4j for model abstraction + JamJet as the production runtime. They are complementary.

---

## Getting started

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-sdk</artifactId>
    <version>0.1.0</version>
</dependency>
```

Or with Gradle:

```kotlin
implementation("dev.jamjet:jamjet-sdk:0.1.0")
```

**Java examples:**
- [Basic Tool Flow](https://github.com/jamjet-labs/jamjet/tree/main/sdk/java/examples/basic-tool-flow) — single agent, ReAct strategy, tool calling
- [Plan and Execute](https://github.com/jamjet-labs/jamjet/tree/main/sdk/java/examples/plan-and-execute-agent) — structured research with cost/time constraints
- [RAG Assistant](https://github.com/jamjet-labs/jamjet/tree/main/sdk/java/examples/rag-assistant) — both workflow-based and agent-based RAG
- [Vertex AI Agent](https://github.com/jamjet-labs/jamjet/tree/main/examples/vertex-ai-agents/java) — Google Gemini integration via Vertex AI

**More:**
- [Full documentation →](https://docs.jamjet.dev)
- [GitHub →](https://github.com/jamjet-labs/jamjet)
- [Python SDK →](https://pypi.org/project/jamjet/)
- [Why we built JamJet →](/blog/why-we-built-jamjet/)
- [What your competitors are doing →](/blog/competitors-already-deploying-ai-agents/)
- [What happens when AI agents fail →](/blog/ai-agent-failures-root-cause/)
- [Join the community →](https://discord.gg/jamjet)
