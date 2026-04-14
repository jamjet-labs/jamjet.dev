---
title: "Why Your AI Agents Need Observability — and What to Measure"
date: 2026-04-15
description: "You would not deploy a microservice without metrics and tracing. Why are you deploying AI agents blind? Here is what to measure and how."
author: "Sunil Prakash"
category: "Architecture & Deep Dives"
---

# Why Your AI Agents Need Observability — and What to Measure

We solved this problem for microservices a decade ago. Distributed tracing. Structured logs. Prometheus metrics with percentile histograms. SLOs. Alert routing. The tooling is mature, the patterns are proven, and nobody ships a production service without them.

Then AI agents arrived and everyone forgot everything we learned. Most teams deploy agents with `console.log` and hope. When something goes wrong — a bad answer, a $40 runaway loop, a hallucinated action — the debugging process is "run it again and see what happens." This is how incidents happen. This is how they keep happening.

I have watched teams spend weeks building sophisticated multi-step agents and then deploy them with zero visibility into what the agent actually does at runtime. The same team that would never ship a REST API without request tracing will ship an agent that makes fifteen LLM calls, invokes three external tools, and manages complex state — with no way to see any of it after the fact.

---

## The agent observability gap

Agents are not microservices. The observability requirements overlap, but agents introduce problems that traditional APM tools were never designed to handle.

**Non-deterministic execution.** The same input produces different reasoning paths and different outputs. You cannot write a test that expects an exact response. You need to observe distributions and detect drift.

**Multi-step complexity.** A single "request" to an agent might involve 5-15 LLM calls, tool invocations, state transitions, and branching decisions. A latency spike on the outer request tells you nothing about which step caused it.

**Real cost per step.** Every LLM call burns tokens. A retry loop that fires six times is not just slow — it is six times more expensive than it should be. You need per-step cost attribution, not just a monthly bill.

**Opaque failures.** "The agent gave a bad answer" is the agent equivalent of "the server returned 500." Without a trace, you cannot distinguish between a bad prompt, a tool failure, a context overflow, and a hallucination. They all look the same from the outside.

Traditional APM tools like Datadog and New Relic track latency and error rates. They miss what matters for agents: **decision quality, reasoning paths, and cost per outcome**.

---

## The four pillars of agent observability

### 1. Execution traces

Every agent run should produce a complete trace showing exactly what happened and in what order. Not a log file you have to parse. A structured timeline:

- Steps executed and their sequence
- Time spent per step
- LLM calls with input/output token counts
- Tool invocations and their results
- State at each transition point

JamJet does this by default. Every execution produces a trace hierarchy with per-node spans, model attribution, and token accounting — no logging code required:

```
execution exec_01JM4X8NKWP2 (2.1s)
├── node:search (search) [tool] 823ms
│   └── mcp.call brave-search/web_search 820ms
├── node:draft (draft) [model] 1.1s
│   └── model.call claude-sonnet-4-6 1.09s
│       ├── input_tokens: 412
│       └── output_tokens: 891
└── node:evaluate (evaluate) [eval] 180ms
    └── eval.llm_judge claude-haiku 178ms
        └── score: 4.7
```

You get this for every run. No instrumentation. No decorators. No "add this middleware to enable tracing." It is the default.

### 2. Cost tracking

Token costs add up fast. A workflow that retries three times on failure costs four times what it should. A loop that does not terminate costs whatever your budget limit is — or whatever your credit card limit is, if you do not have a budget.

You need:

- Tokens consumed per step and per run, broken out by model
- Cost per successful outcome versus cost per failed outcome
- Budget enforcement that kills a run before it burns through your allocation

JamJet exposes `jamjet_model_tokens_total` and `jamjet_model_cost_usd_total` as Prometheus counters, broken down by model. You can alert on cost anomalies the same way you alert on latency.

### 3. Quality metrics

Latency and error rate are necessary but not sufficient. An agent that responds in 500ms with a confident, wrong answer is worse than one that takes 3 seconds and gets it right.

Quality measurement for agents means:

- **Assertion-based scoring** — did the output meet structural criteria? Is the required field present? Is the answer within length bounds?
- **LLM-as-judge scoring** — ask a second model to evaluate the output against a rubric. Score 1-5. Fail below 4.
- **Cost scoring** — did this run stay within its cost budget?
- **Latency gates** — is the quality/speed tradeoff acceptable?
- **Drift detection** — are scores degrading over time for the same input distribution?

JamJet's eval harness supports all of these as composable scorers — `LlmJudgeScorer`, `AssertionScorer`, `LatencyScorer`, `CostScorer` — and you can write custom scorers by subclassing `BaseScorer`. Wire them into CI and your agent quality is gated the same way your test suite gates code quality.

### 4. Failure analysis

When agents fail, you need to know *where* they fail. Not "the run failed" but "the third step timed out because the tool call returned an error and the retry policy made it worse."

Track:

- Failure distribution by step and by tool
- Retry patterns — are retries helping or just adding cost?
- Timeout frequency and which steps trigger them
- Human escalation rate — how often does the agent give up?

This is where event sourcing pays off. Every state transition, every tool call, every decision point is recorded. You do not reconstruct what happened from log files. You replay the execution.

---

## What to measure: concrete metrics

If you are setting up agent observability from scratch, here is the metric set I would start with:

| Metric | Type | What it tells you |
|--------|------|-------------------|
| `jamjet_execution_duration_ms` | Histogram | End-to-end run time. Set SLOs on p50, p95, p99. |
| `jamjet_node_duration_ms` | Histogram | Per-step latency by node type. Find bottlenecks. |
| `jamjet_executions_total` | Counter | Throughput and error rate by workflow + status. |
| `jamjet_model_tokens_total` | Counter | Token usage by model and direction. Track burn rate. |
| `jamjet_model_cost_usd_total` | Counter | Dollar cost by model. Alert on anomalies. |
| `jamjet_queue_depth` | Gauge | Pending executions. Detect backpressure. |

For quality, run your eval suite on a schedule and track the aggregate pass rate as a time series. A sudden drop in pass rate on the same dataset means something changed — a model update, a prompt regression, a tool endpoint that started returning different data. Catch it before your users do.

---

## How JamJet handles this

JamJet is OpenTelemetry-native. Configure an OTLP exporter in `jamjet.toml` and your traces, metrics, and structured logs flow to whatever backend you already use — Jaeger, Grafana Tempo, Honeycomb, Datadog:

```toml
[telemetry]
enabled = true
service_name = "my-agent"

[telemetry.otlp]
endpoint = "http://localhost:4317"
```

Every execution emits spans following the [GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, model ID, workflow ID, execution ID. Your existing dashboards work. Your existing alert rules apply.

For local development, `jamjet inspect` gives you the full execution trace without any backend:

```bash
jamjet inspect exec_01JM4X8NKWP2 --events
```

No Jaeger. No Grafana. Just the complete event timeline in your terminal.

---

## The debugging workflow

When an agent gives a bad result in production, here is what the workflow looks like with proper observability:

1. Get the execution ID from the trace (it is on every span and every log line)
2. Pull the full event timeline with `jamjet inspect`
3. Identify which step diverged — the trace shows you exactly where the reasoning went wrong
4. Replay from that checkpoint with modified state or a different prompt
5. Fix the issue and add the failing case to your eval dataset as a regression test

Without observability, step 1 is "try to reproduce it" and step 2 is "read through console output hoping for clues." I have seen teams spend days on debugging sessions that would take minutes with a trace.

With JamJet, the trace exists for every run. Replay is built in. The eval harness turns your fix into a regression test. This is not a special debugging mode you have to enable. It is the default.

---

## Start here

Observability is not optional for production agents. If you cannot trace a decision, you cannot debug it. If you cannot measure quality, you cannot improve it. If you cannot track cost, you will get surprised.

The good news: if you have operated microservices in production, you already know the playbook. The metrics are different — tokens instead of bytes, quality scores instead of status codes, cost per run instead of cost per request. But the discipline is the same. Instrument everything. Measure what matters. Alert on anomalies. Make debugging deterministic.

- [Observability docs](https://docs.jamjet.dev/en/docs/observability)
- [Eval harness docs](https://docs.jamjet.dev/en/docs/eval)
- [Try JamJet](https://github.com/jamjet-labs/jamjet)
