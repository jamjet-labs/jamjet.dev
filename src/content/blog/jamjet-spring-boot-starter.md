---
title: "JamJet Spring Boot Starter — Production-Grade Agent Runtime for Spring AI"
date: 2026-03-29
description: "Add one dependency to your Spring Boot application. Get crash recovery, audit trails, replay testing, and human-in-the-loop for every Spring AI agent call. JamJet brings its full agent runtime — strategies, multi-agent coordination, MCP, A2A, eval harness — to the Spring ecosystem."
author: "Sunil Prakash"
draft: false
category: "Releases & Updates"
---

# JamJet Spring Boot Starter — Production-Grade Agent Runtime for Spring AI

*You built a Spring AI agent. It works in dev. Then production happens: the process crashes at step 7, there is no audit trail, you cannot replay a failed execution, and nobody approved the $400 LLM call that went sideways. The gap between demo and production is not just durability — it is everything.*

---

## The problem is bigger than crash recovery

Most discussions about "production-readiness" for AI agents focus on one thing: what happens when the process dies mid-execution? That matters. But it is the smallest part of the problem.

Here is what is actually missing when you ship a Spring AI agent to production:

- **No agent strategies.** Your agent calls the LLM once and returns. Real production agents need ReAct loops, plan-and-execute pipelines, and critic chains that re-evaluate outputs.
- **No multi-agent coordination.** You have one agent. Production needs a coordinator that routes to the right specialist, scores candidates, and breaks ties.
- **No protocol interoperability.** Your agent talks to your tools. It cannot discover or communicate with agents in other frameworks, other languages, or other organizations.
- **No eval harness.** You have no systematic way to measure whether your agent is getting better or worse across deployments.
- **No cost controls.** A runaway ReAct loop can burn through your LLM budget in minutes. There is no runtime-level circuit breaker.
- **No crash recovery.** The process dies, and the entire multi-step workflow restarts from scratch.
- **No audit trail.** Compliance asks what the agent did, what it saw, and why. You have logs.
- **No replay testing.** You cannot take a production execution and replay it deterministically in CI.
- **No human-in-the-loop.** The agent makes a high-stakes decision, and there is no mechanism to pause and wait for approval.

Spring AI solves model abstraction. LangChain4j solves provider breadth. Neither was designed to solve the nine problems above. That is a runtime problem.

---

## JamJet: a full agent runtime, not a durability add-on

JamJet is a production-grade agent runtime built on Rust (Tokio). It is not a wrapper around your existing framework. It is the execution engine underneath it.

Here is what the runtime provides natively:

| Capability | What it does |
|-----------|-------------|
| **Agent strategies** | ReAct, plan-and-execute, critic — built-in, not bolted on |
| **Graph-based workflows** | Typed state, conditional edges, cycles, checkpoints |
| **Coordinator Node** | Multi-agent routing with structured scoring + LLM tiebreaker |
| **Agent-as-Tool** | Invoke agents as tools — sync, streaming (early termination), conversational (turn limits) |
| **MCP + A2A** | Native Model Context Protocol client/server + Agent-to-Agent protocol |
| **Polyglot IR** | Python and Java compile to the same intermediate representation, executed by the same Rust runtime |
| **Eval harness** | Pluggable scorers, experiment grids, statistical comparison across runs |
| **Cost/budget limits** | Hard ceilings on USD spend and wall-clock time, enforced at the runtime level |
| **Durable execution** | Event-sourced state, crash recovery, automatic resume from last checkpoint |
| **Audit trails** | Every prompt, response, tool call, and state transition recorded as immutable events |
| **Human-in-the-loop** | First-class approval nodes — pause execution, wait for human decision, resume or reject |
| **Replay/fork** | Replay any execution deterministically; fork from any node to explore alternatives |

Durability is one row in that table. The Spring Boot starter brings all of it to Spring developers.

---

## One dependency, zero code changes

The `jamjet-spring-boot-starter` auto-configures three Spring AI `BaseAdvisor` implementations that intercept every `ChatClient` call:

| Advisor | What it does | Order |
|---------|-------------|-------|
| `JamjetDurabilityAdvisor` | Compiles each interaction to workflow IR, starts/resumes executions on the runtime, checkpoints every step | `LOWEST_PRECEDENCE - 100` |
| `JamjetAuditAdvisor` | Logs prompts, responses, tool calls, and token usage as immutable audit entries | `LOWEST_PRECEDENCE - 50` |
| `JamjetApprovalAdvisor` | Pauses execution for human approval when flagged, with configurable timeout and default decision | `LOWEST_PRECEDENCE - 30` |

Add the dependency:

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-spring-boot-starter</artifactId>
    <version>0.1.0</version>
</dependency>
```

Start the runtime:

```bash
docker run -p 7700:7700 ghcr.io/jamjet-labs/jamjet:latest
```

Configure:

```properties
spring.jamjet.runtime-url=http://localhost:7700
```

Your existing Spring AI code does not change:

```java
@SpringBootApplication
public class MyApp {

    @Bean
    ChatClient chatClient(ChatClient.Builder builder) {
        return builder.build(); // JamJet advisors auto-injected
    }

    @Bean
    CommandLineRunner demo(ChatClient chatClient) {
        return args -> {
            String result = chatClient.prompt("Summarize AI trends")
                    .call()
                    .content();
            System.out.println(result);
            // This call is now durable, audited, and approval-ready
        };
    }
}
```

No annotations. No wrapper classes. No code changes. The advisors intercept the Spring AI advisor chain automatically.

---

## How crash recovery works

The `JamjetDurabilityAdvisor` uses event sourcing. Every interaction compiles to a workflow IR — a serializable graph — that the Rust runtime executes with full checkpoint support.

Here is the timeline for a multi-step agent interaction:

1. User sends prompt to `ChatClient`
2. `JamjetDurabilityAdvisor.before()` compiles the interaction to workflow IR
3. Runtime starts execution, assigns execution ID
4. LLM call completes — runtime records `NodeCompleted` event
5. Tool call executes — runtime records `ToolCallStarted`, `ToolCallCompleted` events
6. Second LLM call with tool results — runtime records event
7. **Process crashes**
8. Process restarts — advisor detects interrupted execution (status=`Running` with no heartbeat, or `Paused`/`Failed`)
9. Runtime replays event log, resumes from step 6
10. Execution completes — no repeated LLM calls, no lost state

The key detail: steps 1-6 are not re-executed. The runtime replays the recorded events to reconstruct state, then continues from where it left off. LLM calls that already completed are not repeated. Tool calls that already ran are not re-invoked.

Full configuration in `application.yml`:

```yaml
spring:
  jamjet:
    runtime-url: http://localhost:7700
    api-token: ${JAMJET_API_TOKEN:}
    tenant-id: default
    durability-enabled: true
    connect-timeout-seconds: 10
    read-timeout-seconds: 120
```

Graceful degradation is built in. If the runtime is unavailable, the advisor logs a warning and passes the request through unmodified. Your application never fails because JamJet is down.

---

## Audit trails for regulated industries

The `JamjetAuditAdvisor` records every interaction as an immutable event. Each audit entry includes:

```json
{
  "type": "prompt",
  "advisor": "JamjetAuditAdvisor",
  "content": "Summarize the customer's investment portfolio risk exposure",
  "timestamp": "2026-03-29T14:32:01Z",
  "execution_id": "exec-a1b2c3"
}
```

And for responses:

```json
{
  "type": "response",
  "advisor": "JamjetAuditAdvisor",
  "content": "Based on the portfolio analysis, the primary risk factors are...",
  "prompt_tokens": 1247,
  "completion_tokens": 892,
  "total_tokens": 2139,
  "timestamp": "2026-03-29T14:32:04Z",
  "execution_id": "exec-a1b2c3"
}
```

Configure what gets logged:

```yaml
spring:
  jamjet:
    audit:
      enabled: true
      include-prompts: true      # Log full prompt text
      include-responses: true    # Log full response text
```

For environments where prompt content is sensitive (PII, financial data), set `include-prompts: false` and `include-responses: false`. The audit trail still records that the interaction happened, which model was called, token counts, and duration — without storing the actual content.

This matters for financial services, healthcare, legal, and any regulated industry where "what did the AI do and why" is not optional. For a deeper treatment of data governance patterns for AI agents, see [Data Governance and PII Retention](/blog/data-governance-pii-retention/) and [Agentic AI in the Enterprise](https://sunilprakash.com/agentic-ai).

---

## Testing agents like software

The `jamjet-spring-boot-starter-test` module provides JUnit 5 integration for replay testing. The idea: capture a production execution, replay it deterministically in your test suite, and assert on behavior.

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-spring-boot-starter-test</artifactId>
    <version>0.1.0</version>
    <scope>test</scope>
</dependency>
```

Write a replay test:

```java
@WithJamjetRuntime
class InvestmentResearchAgentTest {

    @Test
    @ReplayExecution("exec-a1b2c3")
    void agentProducesConsistentOutput(RecordedExecution execution) {
        AgentAssertions.assertThat(execution)
            .completedSuccessfully()
            .usedTool("WebSearch")
            .usedTool("FetchUrl")
            .completedWithin(30, TimeUnit.SECONDS)
            .costLessThan(0.50);
    }

    @Test
    @ReplayExecution("exec-d4e5f6")
    void agentHandlesToolFailure(RecordedExecution execution) {
        AgentAssertions.assertThat(execution)
            .failedWith("ConnectionTimeout")
            .usedToolTimes("WebSearch", 3)  // Retried 3 times
            .costLessThan(0.10);
    }
}
```

`@WithJamjetRuntime` starts a JamJet runtime container via Testcontainers. `@ReplayExecution` replays a recorded execution by ID. `AgentAssertions` provides a fluent API for asserting on status, tool usage, duration, cost, output content, node completion, and event history.

For deterministic tests without any LLM calls:

```java
var stub = DeterministicModelStub.builder()
    .onPromptContaining("weather", "Sunny, 72F")
    .onPromptContaining("portfolio", "Risk level: moderate")
    .defaultResponse("I don't know")
    .build();
```

This is what CI/CD for AI agents looks like. Not "run it and hope the LLM gives a similar answer." Deterministic replay, exact assertions, cost budgets enforced in the test suite.

---

## LangChain4j too

If you have existing LangChain4j code, the `langchain4j-jamjet` module provides a one-line integration:

```java
var client = new JamjetConfig()
    .runtimeUrl("http://localhost:7700")
    .buildClient();

// Your existing AiServices proxy
MyAssistant raw = AiServices.builder(MyAssistant.class)
    .chatLanguageModel(model)
    .tools(tools)
    .build();

// Wrap it — every call is now durable, audited, crash-recoverable
MyAssistant durable = JamjetDurableAgent.wrap(raw, MyAssistant.class, client);
```

`JamjetDurableAgent.wrap()` creates a dynamic proxy that intercepts every method call on your `AiServices` interface. Each invocation compiles to workflow IR, starts an execution on the runtime, and records completion or failure events. If the runtime is unavailable, it falls back to direct invocation.

Event-sourced chat memory is also available:

```java
var store = new JamjetChatMemoryStore(client);
var memory = MessageWindowChatMemory.builder()
    .chatMemoryStore(store)
    .id("session-1")
    .maxMessages(20)
    .build();
```

Position this as an adoption bridge. If you have LangChain4j code in production today, `JamjetDurableAgent.wrap()` gives you durability and audit trails without rewriting anything. For new projects, JamJet's native Java SDK — with built-in agent strategies, workflow orchestration, cost controls, and the full feature set — is the better starting point.

---

## What is on Maven Central

All modules are published and available today:

| Module | GroupId | ArtifactId | Version |
|--------|---------|-----------|---------|
| Spring Boot Starter | `dev.jamjet` | `jamjet-spring-boot-starter` | `0.1.0` |
| Auto-configuration | `dev.jamjet` | `jamjet-spring-boot-autoconfigure` | `0.1.0` |
| Test support | `dev.jamjet` | `jamjet-spring-boot-starter-test` | `0.1.0` |
| LangChain4j integration | `dev.jamjet` | `langchain4j-jamjet` | `0.1.0` |
| SkillsJars (durability patterns) | `dev.jamjet` | `jamjet-skillsjars` | `0.4.0` |
| Java SDK | `dev.jamjet` | `jamjet-sdk` | `0.1.0` |

Requirements: Java 21+, Spring Boot 3.4+, Spring AI 1.0+, JamJet runtime (Docker or binary).

---

## Get started

Add the dependency:

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-spring-boot-starter</artifactId>
    <version>0.1.0</version>
</dependency>
```

Start the runtime:

```bash
docker run -p 7700:7700 ghcr.io/jamjet-labs/jamjet:latest
```

That is it. Your Spring AI agents are now running on a production-grade runtime with crash recovery, audit trails, and replay testing.

**Links:**

- [Full documentation](https://docs.jamjet.dev)
- [Spring Boot Starter docs](https://docs.jamjet.dev/spring-boot-starter)
- [LangChain4j Integration docs](https://docs.jamjet.dev/langchain4j-integration)
- [Java Quickstart](https://docs.jamjet.dev/java-quickstart)
- [GitHub — jamjet-spring](https://github.com/jamjet-labs/jamjet-spring)
- [GitHub — jamjet](https://github.com/jamjet-labs/jamjet)
- [Agentic AI in the Enterprise](https://sunilprakash.com/agentic-ai)
- [Why We Built JamJet](/blog/why-we-built-jamjet/)
- [AI Agents Need Their Spring Moment](/blog/jamjet-java-ai-ecosystem/)
- [Join the community on Discord](https://discord.gg/jamjet)
