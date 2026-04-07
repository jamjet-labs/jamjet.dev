---
title: "The State of Memory in Java AI Agents (April 2026)"
date: 2026-04-07
description: "A tour of every option Java developers have for adding persistent memory to AI agents — and why most of them stop at chat history."
author: "Sunil Prakash"
category: "Architecture & Deep Dives"
---

# The State of Memory in Java AI Agents (April 2026)

## TL;DR

If you're building AI agents in Java today, your options for persistent memory range from "store the last 20 chat messages in Postgres" to "run a Python service in a sidecar container and call it over HTTP." There is no Java-native equivalent to Mem0, Zep, or Letta — the libraries Python developers reach for when they need real memory.

This post is a tour of every option a Java developer has in April 2026, why most of them stop at chat history, what "real memory" should actually mean, and one library we shipped to fill the gap.

## The scenario every Java AI developer recognises

You're building an AI agent in Spring Boot. Maybe it's a customer support copilot, maybe it's a coding assistant, maybe it's a research agent. You wire up Spring AI or LangChain4j, write a few tools, and the first conversation works.

Then your user comes back the next day. The agent doesn't remember them. It doesn't remember they're allergic to peanuts. It doesn't remember they're working on the Acme migration. It doesn't remember they prefer verbose explanations. Every conversation starts from zero.

You search for "Java AI agent memory" and end up with three kinds of results:

1. Tutorials on how to store chat messages in Postgres
2. Marketing pages for Mem0 and Zep — Python only
3. GitHub issues asking why there's no Java SDK

This is the gap.

## "Memory" means three different things

Before we tour the libraries, we need to be precise. There are at least three different things people mean when they say "agent memory," and most discussion conflates them:

**1. Conversation history.** The last N messages of the current session, kept around so the model has context within a single conversation. Solved problem — every framework ships this.

**2. State checkpointing.** Snapshots of agent execution state for resume and replay. Solved by LangGraph, Koog persistence, Temporal-style runtimes. Different problem from knowledge memory entirely.

**3. Long-term knowledge memory.** Facts about the user, their preferences, their projects, their history — extracted from conversations, stored durably, retrievable across sessions, and de-conflicted when they change. This is what Mem0 and Zep do. This is what Letta calls "persistent memory." **It is not solved on the JVM.**

The rest of this post is about the third one.

## What real memory needs

A production memory layer needs at least these capabilities:

- **Fact extraction.** An LLM reads a conversation and pulls out discrete, atomic facts. "User is allergic to peanuts" — not "we discussed dietary restrictions."
- **Conflict detection.** When a new fact contradicts an old one ("I moved from Austin to NYC"), the system invalidates the old fact and stores the new one with a supersession link.
- **Hybrid retrieval.** Vector search alone misses things. Keyword search alone misses things. Graph traversal alone misses things. Real memory fuses all three.
- **Temporal reasoning.** Facts have validity windows. "User worked at Acme from 2024 to 2026" should not be retrieved as a current fact in 2027.
- **Token-budgeted context assembly.** Your model has a context window. Your memory has thousands of facts. Something has to pick which facts go in the prompt and respect the budget.
- **Decay and consolidation.** Stale facts should fade. Frequently-accessed facts should get promoted. Duplicates should be merged. This needs to happen automatically — manual curation does not scale.

These are the features that matter when you're building something a real user will rely on. Now let's see what Java has.

## Tour: every option Java developers have today

### LangChain4j ChatMemory

LangChain4j is the most popular AI framework on the JVM, with around 9,000 GitHub stars and a strong community. Its memory story is straightforward: a `ChatMemory` interface, two implementations (`MessageWindowChatMemory` and `TokenWindowChatMemory`), and a `ChatMemoryStore` interface for persistence.

```java
ChatMemory chatMemory = MessageWindowChatMemory.withMaxMessages(20);
chatMemory.add(UserMessage.from("I'm allergic to peanuts"));
chatMemory.add(AiMessage.from("Got it, I'll remember that."));
// Next session: chatMemory is empty unless you implemented ChatMemoryStore.
```

What it does: stores message objects, respects token or count limits, handles system and tool messages correctly. What it does not do: extract facts, deduplicate, retrieve semantically, reason about time, summarize, or anything else on our list. The [LangChain4j docs](https://docs.langchain4j.dev/tutorials/chat-memory/) are explicit — `ChatMemory` is a container abstraction.

This isn't a criticism. LangChain4j made a deliberate scoping choice: leave higher-order memory to the user. But that means every team builds it themselves.

### Spring AI ChatMemory

Spring AI's chat memory shipped GA in 2025 with broad backend support: `JdbcChatMemoryRepository` for Postgres/MySQL/SQL Server/Oracle, plus separate repositories for Cassandra (with TTL), Mongo, Neo4j, and Cosmos DB. Three advisors plug it into `ChatClient`: `MessageChatMemoryAdvisor`, `PromptChatMemoryAdvisor`, and `VectorStoreChatMemoryAdvisor`.

```java
ChatMemory chatMemory = MessageWindowChatMemory.builder()
    .chatMemoryRepository(new JdbcChatMemoryRepository(jdbcTemplate))
    .maxMessages(20)
    .build();

ChatClient client = ChatClient.builder(chatModel)
    .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
    .build();
```

The `VectorStoreChatMemoryAdvisor` is the closest thing to "semantic memory" in Spring AI — it indexes raw messages in your `VectorStore` and retrieves them by similarity at query time. But it indexes raw messages, not extracted facts. There's no entity model, no relationship graph, no conflict detection, no consolidation.

Spring AI's [own documentation](https://docs.spring.io/spring-ai/reference/api/chat-memory.html) and community blog posts all describe the same pattern when you want real memory: write a "recorder advisor" that calls an LLM after each turn to extract facts and write them to a vector store yourself. It's a build-your-own situation, well documented but not pre-built.

### Google ADK for Java

Google's ADK shipped 1.0.0 for Java in 2025 with a `BaseMemoryService` interface and two implementations:

- `InMemoryMemoryService` — keyword matching only, intended for development
- `VertexAiMemoryBankService` — fully managed semantic memory, Vertex AI only

Memory Bank is genuinely interesting: it does fact extraction, semantic search, and topic organization. But it's a Google Cloud service, not a library. You don't run it yourself, you call it. Pricing is per-API-call, and you're locked into Vertex AI. For teams that need self-hosted, multi-cloud, or air-gapped deployments, it's not an option.

The OSS Java path with ADK gives you `InMemoryMemoryService`, which is keyword matching over a `HashMap`.

### Koog (JetBrains)

Koog is the most ambitious JVM agent framework with real memory ambitions. Its `AgentMemory` feature stores facts organized by `Concept`, `Subject` (user, product, organization), and `Scope`. There's a `nodeSaveToMemoryAutoDetectFacts` node that uses an LLM to extract facts automatically.

```kotlin
agent {
    memory {
        scope = MemoryScope.User("user_123")
    }
    nodeSaveToMemoryAutoDetectFacts {
        subjects = listOf(Subject.User, Subject.Product)
    }
}
```

This is the closest competitor on the "facts about subjects" axis. Two important caveats:

1. **It's Kotlin-first.** Java consumption works but the idioms are awkward.
2. **GitHub issue [JetBrains/koog#1001](https://github.com/JetBrains/koog/issues/1001)** documents that `AgentMemory` floods prompts as facts accumulate — there's no token budgeting or smart retrieval. The maintainers acknowledge this.

Koog also has separate `PersistenceStorageProvider` implementations (in-memory, file, no-op, Postgres) for *state checkpoints*. That solves the second kind of memory — execution snapshots — not the third.

If you're a Kotlin team and you can live with the retrieval limitations, Koog is the closest thing to a JVM-native fact store today. If you're a Java team or you need scaled retrieval, it's not yet enough.

### Embabel

Embabel is Rod Johnson's (creator of Spring) JVM agent framework, written in Kotlin with Java-friendly APIs. It uses a blackboard pattern — a shared state container holding domain objects passed between actions during a single agent run.

In a public discussion thread about memory, the maintainers wrote: *"in Embabel it's not about conversational memory so much as domain objects that are stored in the blackboard during the flow."*

Long-term knowledge memory is an explicit non-goal. Embabel solves agent orchestration with goal-oriented planning, and it does that well. It assumes you'll bring memory separately. That's a respectable scoping decision — it just means Embabel doesn't fill the gap.

### Mem0 Java SDK (the one that doesn't exist)

If you Google "Mem0 Java SDK," the top result is `me.pgthinker:mem0-client-java`, a community wrapper at version 0.1.3, last updated nine months ago, with 9 GitHub stars and 13 commits total. It is not an SDK in the meaningful sense — it is a thin REST client that requires you to run a Python Mem0 server alongside your JVM application.

There is no official Mem0 Java client. Mem0's first-party SDKs are Python and Node.js only. To use Mem0 from Java today, you either run their managed cloud and call it over HTTPS, or you operate a Python sidecar with Qdrant and a graph database in your own infrastructure. Either way, you're not getting an idiomatic Java library.

### Zep Java SDK (also doesn't exist)

Zep's official clients are Python, TypeScript, and Go. There is no Java SDK at any state of completeness. Java teams who want Zep's temporal knowledge graph have to either consume Zep Cloud over HTTP or hand-roll an HTTP client against the REST API.

Zep's underlying engine, Graphiti, is excellent — it scored 63.8% on LongMemEval-S in published results, fifteen points above Mem0. (Note: Zep's earlier 84% LoCoMo claim was [disputed and re-evaluated to 58.44%](https://github.com/getzep/zep-papers/issues/5) by independent testing — be careful which numbers you cite.) But none of this is reachable from Java without a sidecar.

### DIY (what most teams actually do)

When Java teams need real memory today, they end up assembling something like this:

1. PostgreSQL with pgvector, or Qdrant via the official Java client, for embeddings
2. `JdbcChatMemoryRepository` for raw messages
3. A custom advisor that calls an LLM after each turn to extract facts
4. A custom retrieval layer that combines vector similarity with keyword search
5. A nightly cron job that decays old facts, merges duplicates, and re-indexes
6. A custom token-budgeting layer in the prompt builder

This is roughly 1,500–3,000 lines of bespoke Java per team. It quietly diverges between projects. It rarely gets the temporal reasoning right. It almost never gets the consolidation right. Half the teams I've talked to have a half-finished version of this in `src/main/java/com/example/memory/` and a comment that says `// TODO: handle conflicts`.

I have built versions of this twice myself. Both times I wished there was a library.

## The pattern

Here's what's striking about the tour: every Java memory option lives in one of two boxes.

- **Chat history persistence** — LangChain4j, Spring AI core, Embabel
- **State checkpointing** — LangGraph4j, Koog persistence, Spring AI session services

Nothing in between. No JVM-native library that does fact extraction + conflict resolution + temporal graph + hybrid retrieval + consolidation in one dependency. Koog gets closest on the fact extraction side but doesn't have the rest. Google ADK gets there with Memory Bank but locks you into Vertex AI.

The Python ecosystem has had Mem0 since 2024 and Zep/Graphiti since early 2025. The Java ecosystem is roughly 18 months behind on this specific layer.

That's not a criticism of LangChain4j or Spring AI — they're solving different problems well. LangChain4j is the best chat history container on the JVM. Spring AI has the broadest backend support. Both make explicit, defensible scoping decisions. The gap exists because no one has decided to fill it for Java yet. Until now.

## What we built

I run [JamJet](https://jamjet.dev). We've been building a runtime for AI agents since early 2026 — durable execution, multi-agent coordination, MCP integration. As we built it, the memory gap kept showing up in user conversations. So we built a memory layer.

**Engram** is a durable memory system for AI agents. It does the things on the list:

- Fact extraction from conversation messages via LLM
- Conflict detection — vector similarity threshold plus LLM resolution for ambiguous cases
- Hybrid retrieval — vector + SQLite FTS5 keyword + graph walk, with configurable weights
- Temporal knowledge graph with entity types, relationships, and validity windows
- Token-budgeted context assembly with three output formats (XML system prompt, Markdown, raw JSON)
- A 5-operation consolidation engine: **decay**, **promote**, **dedup**, **summarize**, **reflect**
- An MCP server option, so the same store is reachable from non-JVM agents

It runs against SQLite by default. No Postgres, no Qdrant, no Neo4j, no Python sidecar. The default embedding provider is Ollama (free, local) but anything implementing the `EmbeddingProvider` trait works — bring your own.

Here's what using it from Java looks like:

```java
import dev.jamjet.engram.EngramClient;
import dev.jamjet.engram.EngramConfig;

import java.util.List;
import java.util.Map;

try (var memory = new EngramClient(EngramConfig.defaults())) {

    // Ingest a conversation
    memory.add(
        List.of(
            Map.of("role", "user",      "content", "I'm allergic to peanuts and live in Austin"),
            Map.of("role", "assistant", "content", "Got it, I'll remember that.")
        ),
        "alice", null, null   // user_id, org_id, session_id
    );

    // Later, in a different request — get a token-budgeted context block
    var context = memory.context(
        "what should I cook for dinner",
        "alice",            // user_id
        null,               // org_id
        1000,               // token budget
        "system_prompt"     // format
    );

    // context.get("text") is XML-tagged, ready to inject:
    // <memory>
    // <conversation>
    // - User is allergic to peanuts
    // - User lives in Austin
    // </conversation>
    // </memory>

    System.out.println(context.get("text"));
    System.out.println("Tokens used: " + context.get("token_count"));
}
```

The dependency is on Maven Central:

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-sdk</artifactId>
    <version>0.4.3</version>
</dependency>
```

Apache 2.0. The Rust runtime is published as `jamjet-engram` on crates.io for users who want to embed it directly, and `jamjet-engram-server` for users who want a standalone MCP / REST server.

## The consolidation engine

Most teams underestimate this part. Memory that only ever grows becomes useless. Memory that gets pruned by hand doesn't scale. You need a background process that keeps the store healthy.

Engram's consolidation engine has five operations, each independently enable-able:

| Op | What it does | LLM required |
|---|---|:---:|
| **Decay** | Exponentially reduces confidence on stale facts. Default 30-day half-life. Below threshold (0.3) the fact is archived. | No |
| **Promote** | Conversation-tier facts accessed 3+ times graduate to the knowledge tier. | No |
| **Dedup** | Vector similarity scan across the scope. > 0.99 similarity auto-merges. 0.95–0.99 invokes the LLM as a tiebreaker. | Sometimes |
| **Summarize** | When conversation facts exceed a threshold, an LLM condenses topic clusters into knowledge-tier summaries. | Yes |
| **Reflect** | An LLM reads the top facts for a user and generates higher-order insights. ("User is health-conscious" inferred from food + fitness facts.) | Yes |

You configure thresholds, which ops to run, and how many LLM calls to allow per cycle. You can run it on a schedule, on demand via the MCP `memory_consolidate` tool, or via the REST endpoint. The decay and promote operations require no LLM calls, so they're effectively free to run hourly.

## What it doesn't do (yet)

I want to be honest about the gaps. This is version 0.4.3, not 1.0:

- **No Spring Boot auto-configuration yet.** You wire `EngramClient` as a `@Bean` manually. A starter is on the roadmap.
- **No JDBC backend.** It's SQLite-first. Postgres support is planned for 0.5.x via a feature flag.
- **No managed cloud option.** This is a self-hosted library. If you want a hosted memory service with SLAs, Mem0 Cloud or Zep Cloud are mature.
- **The default fact extractor is naive.** It uses a simple JSON-mode prompt. Mem0's extractor has had more iterations and is better at edge cases.
- **No published LongMemEval / DMR scores yet.** We're running benchmarks now. I'd rather wait and publish honest numbers than cherry-pick favorable results.

If any of those are dealbreakers, you should probably wait, use Mem0 with a Python sidecar, or pay for Mem0 Cloud. If you want a self-hosted, zero-infrastructure Java memory layer that exists today and is on Maven Central, this is the option.

## Where this fits

JamJet's broader bet is that Java and Spring teams shouldn't have to give up their toolchain to build production AI agents. We've shipped:

- A [Spring Boot starter](https://github.com/jamjet-labs/jamjet-spring) for durable agent execution
- A LangChain4j integration as a community module
- A Java SDK for the JamJet runtime
- SkillsJars — pre-built skill JARs for common agent patterns
- Now, Engram — the memory layer

The pattern across all of these: meet Java developers where they already are. Maven Central, idiomatic APIs, Spring-friendly, no Python required.

Engram is the part that lets your agent remember the user across sessions without rolling your own pipeline.

## Try it

Add the dependency to your Spring Boot or LangChain4j project:

```xml
<dependency>
    <groupId>dev.jamjet</groupId>
    <artifactId>jamjet-sdk</artifactId>
    <version>0.4.3</version>
</dependency>
```

Start the Engram server (one binary, no infrastructure):

```bash
cargo install jamjet-engram-server
engram serve --db memory.db
```

Or run it as an MCP server for Claude Code, Cursor, and any MCP-compatible client:

```json
{
  "mcpServers": {
    "memory": {
      "command": "engram",
      "args": ["serve", "--db", "memory.db"]
    }
  }
}
```

GitHub: [github.com/jamjet-labs/jamjet](https://github.com/jamjet-labs/jamjet)

Maven Central: [dev.jamjet:jamjet-sdk](https://central.sonatype.com/artifact/dev.jamjet/jamjet-sdk)

---

If you've been quietly rolling your own memory layer in Java, I'd love to hear what you ended up with. We're in the early innings here and there's a lot to learn from teams who have already built versions of this in production. Reach out via GitHub issues or [discord.gg/jamjet](https://discord.gg/jamjet).
