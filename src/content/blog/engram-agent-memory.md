---
title: "Engram: A Memory Layer for AI Agents That Actually Works"
date: 2026-04-07
description: "One cargo install. Zero infrastructure. Your agents remember everything — with temporal knowledge graphs, semantic search, and MCP-native tools."
author: "Sunil Prakash"
category: "Releases & Updates"
---

# Engram: A Memory Layer for AI Agents That Actually Works

AI agents have a goldfish problem. Every conversation starts from zero. Your agent knows your name, your preferences, your project context — and then the session ends and it's all gone.

The existing solutions ask you to spin up vector databases, graph stores, and extraction pipelines. Mem0 needs Qdrant. Zep needs Neo4j and Docker. Letta needs PostgreSQL. By the time you've configured the infrastructure, you've forgotten what you were building.

Today we're releasing **Engram** — a durable memory layer for AI agents. One binary. Zero infrastructure. SQLite all the way down.

## Get started in 10 seconds

**Python:**
```bash
pip install jamjet
```

```python
from jamjet.engram import EngramClient

async with EngramClient() as memory:
    await memory.add(messages=[{"role": "user", "content": "I live in Austin"}], user_id="alice")
    facts = await memory.recall("where does the user live", user_id="alice")
```

**Java:**
```xml
<dependency>
  <groupId>dev.jamjet</groupId>
  <artifactId>jamjet-sdk</artifactId>
  <version>0.4.0</version>
</dependency>
```

**Standalone MCP server** (for Claude Code, Cursor, etc.):
```bash
cargo install jamjet-engram-server
engram serve --db memory.db
```

That last command gives you an MCP server with 7 memory tools that any AI agent can use.

## How it works

Engram is built around three ideas:

### 1. Memory is structured, not a bag of vectors

Most memory systems dump everything into a vector store and hope similarity search finds the right thing. Engram extracts **facts**, **entities**, and **relationships** from conversations, building a temporal knowledge graph alongside the vector index.

```
"I'm allergic to peanuts and I live in Austin"

→ Fact: "User is allergic to peanuts" (confidence: 0.95)
→ Fact: "User lives in Austin" (confidence: 0.97)
→ Entity: user_123 (person)
→ Entity: peanuts (allergen)
→ Entity: Austin (place)
→ Relationship: user_123 --allergic_to--> peanuts
→ Relationship: user_123 --lives_in--> Austin
```

### 2. Retrieval is hybrid, not single-signal

When your agent recalls memory, Engram fuses three signals:

- **Vector search** — semantic similarity via embeddings
- **Keyword search** — SQLite FTS5 for exact terms, proper nouns, IDs
- **Graph walk** — traverse entity relationships for structurally connected facts

Each signal is weighted (default: 50% vector, 30% keyword, 20% graph) and configurable. The result: higher recall than any single retrieval method alone.

### 3. Memory decays like the brain does

Engram includes a consolidation engine inspired by cognitive science:

- **Decay** — stale facts lose confidence exponentially (30-day half-life)
- **Promote** — frequently-accessed facts graduate from conversation to long-term knowledge
- **Dedup** — batch vector similarity scan merges near-identical facts
- **Summarize** — LLM condenses conversation clusters into knowledge-tier facts
- **Reflect** — LLM generates higher-order insights from patterns across facts

Run it on a schedule or trigger it manually. Your agent's memory stays clean without manual curation.

## MCP-native from day one

Engram speaks MCP (Model Context Protocol) natively. Add it to Claude Code, Cursor, or any MCP-compatible client:

```json
{
  "mcpServers": {
    "memory": {
      "command": "engram",
      "args": ["serve", "--db", "~/.engram/memory.db"]
    }
  }
}
```

Seven tools are exposed:

| Tool | What it does |
|------|-------------|
| `memory_add` | Extract facts from conversation messages |
| `memory_recall` | Semantic search over stored facts |
| `memory_context` | Token-budgeted context block for system prompts |
| `memory_search` | FTS5 keyword search |
| `memory_forget` | Soft-delete a fact (with audit trail) |
| `memory_stats` | Storage statistics |
| `memory_consolidate` | Run the consolidation engine |

## REST API too

Need HTTP instead of MCP? Same binary, different flag:

```bash
engram serve --db memory.db --mode rest --port 9090
```

Nine endpoints at `/v1/memory/*`:

```bash
# Add facts from a conversation
curl -X POST localhost:9090/v1/memory \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "I live in Austin"}], "user_id": "alice"}'

# Get a token-budgeted context block
curl -X POST localhost:9090/v1/memory/context \
  -H "Content-Type: application/json" \
  -d '{"query": "where does the user live", "user_id": "alice", "token_budget": 1000}'
```

## Context assembly that respects your token budget

The `memory_context` tool doesn't just dump all facts into your prompt. It:

1. Retrieves candidates via hybrid search
2. Ranks by tier priority: **Working** > **Conversation** > **Knowledge**
3. Greedily fills your token budget (never exceeds it)
4. Formats as XML system prompt tags, Markdown, or raw JSON

```xml
<memory>
<conversation>
- User prefers dark mode
- User is allergic to peanuts
</conversation>
<knowledge>
- User is health-conscious and actively managing diet
</knowledge>
</memory>
```

## Architecture

Engram is two Rust crates:

- **`jamjet-engram`** (library) — traits, SQLite stores, extraction pipeline, retrieval, context assembly, consolidation engine. 95 tests.
- **`jamjet-engram-server`** (binary) — MCP stdio server + Axum REST API + clap CLI. 22 tests.

Everything is trait-based and pluggable:

| Trait | Default | Can swap to |
|-------|---------|------------|
| `FactStore` | SQLite | Postgres, any SQL |
| `VectorStore` | Embedded cosine | Qdrant, Pinecone |
| `GraphStore` | SQLite triple store | Neo4j, FalkorDB |
| `EmbeddingProvider` | Ollama | OpenAI, ONNX, any API |
| `LlmClient` | Ollama | Claude, GPT, any API |
| `TokenEstimator` | char/4 heuristic | tiktoken, any tokenizer |

Zero mandatory infrastructure. Swap backends when you need scale.

## What's next

- **Pluggable backends** — Qdrant, Neo4j, Postgres adapters (feature-gated)
- **JamJet runtime integration** — memory as durable workflow nodes with event sourcing
- **Migration tools** — import from Mem0, Zep, and other memory systems
- **Spring Boot starter** — auto-configuration for Java enterprise

## Try it

```bash
# Python SDK
pip install jamjet

# Standalone MCP server (Rust)
cargo install jamjet-engram-server
engram serve --db memory.db
```

Source: [github.com/jamjet-labs/jamjet](https://github.com/jamjet-labs/jamjet) (Apache 2.0)

Crates: [jamjet-engram](https://crates.io/crates/jamjet-engram) | [jamjet-engram-server](https://crates.io/crates/jamjet-engram-server)

PyPI: [jamjet](https://pypi.org/project/jamjet/)
