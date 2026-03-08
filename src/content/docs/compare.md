---
title: Framework Comparison
description: JamJet vs LangGraph vs CrewAI vs AutoGen — feature matrix across execution, durability, observability, eval, and scale.
sidebar:
  order: 10
  label: vs LangGraph / CrewAI
---

import { Aside } from '@astrojs/starlight/components';

> Last updated: 2026-03-08 · JamJet v0.1.1 · [Corrections welcome](https://github.com/jamjet-labs/jamjet-benchmarks/issues)

Legend: ✅ Built-in · 🔧 Via plugin/extension · ⚠️ Partial · ❌ Not supported · 🚧 In progress

## Core execution

| Feature | JamJet | LangGraph | CrewAI | AutoGen |
|---|---|---|---|---|
| Graph-based workflow | ✅ | ✅ | ⚠️ Sequential/hierarchical | ✅ |
| Async execution | ✅ | ✅ | ✅ | ✅ |
| Local in-process runner | ✅ | ✅ | ✅ | ✅ |
| Typed state | ✅ Pydantic | ⚠️ TypedDict | ❌ Dict | ⚠️ Dict |
| State validation at every step | ✅ | ❌ | ❌ | ❌ |
| Conditional routing | ✅ Inline predicates | ✅ Edge functions | ⚠️ Process type | ✅ |
| Parallel branches | ✅ `type: parallel` | ✅ | ❌ | ✅ |
| Cycle / loop support | ✅ | ✅ | ⚠️ | ✅ |

## Durability & reliability

| Feature | JamJet | LangGraph | CrewAI | AutoGen |
|---|---|---|---|---|
| Durable execution (crash recovery) | ✅ Rust runtime | 🔧 Checkpointers | ❌ | ❌ |
| Event sourcing | ✅ Native | ❌ | ❌ | ❌ |
| Automatic retry with backoff | ✅ YAML config | 🔧 Manual | 🔧 Manual | 🔧 Manual |
| Human-in-the-loop / pause | ✅ `type: wait` | ✅ `interrupt_before` | ❌ | ⚠️ |
| Resume from any checkpoint | ✅ | 🔧 Requires saver | ❌ | ❌ |
| Timeout per step | ✅ | ⚠️ | ❌ | ⚠️ |

## Observability

| Feature | JamJet | LangGraph | CrewAI | AutoGen |
|---|---|---|---|---|
| Structured event log | ✅ Per-step events | ⚠️ Callbacks | ⚠️ verbose text | ⚠️ |
| Execution inspection CLI | ✅ `jamjet inspect` | ❌ | ❌ | ❌ |
| Event timeline | ✅ | ❌ | ❌ | ❌ |
| OpenTelemetry tracing | 🚧 | 🔧 LangSmith | 🔧 | ❌ |
| Time-travel debugging | 🚧 | ❌ | ❌ | ❌ |

## Tool & protocol integration

| Feature | JamJet | LangGraph | CrewAI | AutoGen |
|---|---|---|---|---|
| MCP client (use any MCP server) | ✅ Native | 🔧 Via adapter | 🔧 Via adapter | 🔧 Via adapter |
| MCP server (expose your tools) | 🚧 | ❌ | ❌ | ❌ |
| A2A cross-agent calls | ✅ Client + server | ❌ | ❌ | ❌ |
| OpenAI function calling | ✅ | ✅ | ✅ | ✅ |
| Custom Python tools | ✅ `@tool` decorator | ✅ | ✅ | ✅ |
| Tool retry on error | ✅ Node-level config | 🔧 Manual | 🔧 Manual | 🔧 Manual |

## Eval & testing

| Feature | JamJet | LangGraph | CrewAI | AutoGen |
|---|---|---|---|---|
| Built-in eval harness | ✅ | ❌ | ❌ | ❌ |
| LLM-as-judge scoring | ✅ `LlmJudgeScorer` | ❌ | ❌ | ❌ |
| Assertion scoring | ✅ `AssertionScorer` | ❌ | ❌ | ❌ |
| Latency budgets | ✅ `LatencyScorer` | ❌ | ❌ | ❌ |
| Cost budgets | ✅ `CostScorer` | ❌ | ❌ | ❌ |
| Dataset format (JSONL) | ✅ | ❌ | ❌ | ❌ |
| CI exit code on regression | ✅ `--fail-under` | ❌ | ❌ | ❌ |
| Eval as a workflow node | ✅ `type: eval` | ❌ | ❌ | ❌ |

## Developer experience

| Feature | JamJet | LangGraph | CrewAI | AutoGen |
|---|---|---|---|---|
| YAML workflow authoring | ✅ | ❌ | ❌ | ❌ |
| Python decorator API | ✅ `@wf.step` | ✅ | ✅ | ✅ |
| Project templates | ✅ `jamjet init --template` | ❌ | ❌ | ❌ |
| Local dev server | ✅ `jamjet dev` | ❌ | ❌ | ❌ |
| Workflow validation CLI | ✅ `jamjet validate` | ❌ | ❌ | ❌ |
| Multi-model support | ✅ Any OpenAI-compat | ✅ | ✅ | ✅ |
| Local models (Ollama, etc.) | ✅ | ✅ | ✅ | ✅ |

## Production & scale

| Feature | JamJet | LangGraph | CrewAI | AutoGen |
|---|---|---|---|---|
| Runtime language | **Rust** | Python | Python | Python |
| Polyglot SDK | Python (TS 🚧) | Python, JS | Python | Python, .NET |
| Kubernetes-ready | ✅ Stateless binary | 🔧 | 🔧 | 🔧 |
| Managed cloud offering | 🚧 | ✅ LangGraph Cloud | ❌ | ❌ |
| Open source | ✅ Apache-2.0 | ✅ MIT | ✅ MIT | ✅ CC-BY-4 |

---

<Aside type="note">
See [Benchmarks](/benchmarks) for measured latency comparisons with methodology and raw results. Migration guides: [from LangGraph](/migrate/from-langgraph), [from CrewAI](/migrate/from-crewai), [from OpenAI SDK](/migrate/from-openai-direct).
</Aside>
