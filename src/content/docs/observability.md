---
title: Observability
description: Traces, metrics, and logs for JamJet workflows in production.
sidebar:
  order: 9
---

import { Aside } from '@astrojs/starlight/components';

# Observability

JamJet emits structured traces, metrics, and logs for every execution — compatible with OpenTelemetry and the tools you already use.

## What's instrumented

Every JamJet execution automatically emits:

- **Traces** — per-execution and per-node spans with timing, model, token counts
- **Metrics** — execution duration, queue depth, node latency, token usage, error rates
- **Logs** — structured JSON logs for every state transition
- **Events** — the full execution event log (queryable via `jamjet inspect`)

## OpenTelemetry

JamJet is fully OpenTelemetry-native. Configure an OTLP exporter in `jamjet.toml`:

```toml
[telemetry]
enabled = true
service_name = "my-agent"
service_version = "0.2.0"

[telemetry.otlp]
endpoint = "http://localhost:4317"   # OTLP gRPC
# or
endpoint = "http://localhost:4318"   # OTLP HTTP
```

This works with any OTLP-compatible backend:
- [Jaeger](https://jaegertracing.io)
- [Grafana Tempo](https://grafana.com/oss/tempo/)
- [Honeycomb](https://honeycomb.io)
- [Datadog](https://datadog.com)
- [New Relic](https://newrelic.com)
- [AWS X-Ray](https://aws.amazon.com/xray/)

## Trace structure

Each execution produces a trace hierarchy:

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

## Span attributes

JamJet follows the [GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) for model spans:

| Attribute | Value |
|-----------|-------|
| `gen_ai.system` | `anthropic`, `openai`, etc. |
| `gen_ai.request.model` | Model ID |
| `gen_ai.usage.input_tokens` | Input token count |
| `gen_ai.usage.output_tokens` | Output token count |
| `jamjet.workflow.id` | Workflow ID |
| `jamjet.workflow.version` | Workflow version |
| `jamjet.execution.id` | Execution ID |
| `jamjet.node.id` | Node ID |
| `jamjet.node.kind` | Node type |

## Prometheus metrics

Enable the Prometheus scrape endpoint:

```toml
[telemetry.prometheus]
enabled = true
port = 9090
```

Available metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `jamjet_executions_total` | Counter | Total executions by workflow + status |
| `jamjet_execution_duration_ms` | Histogram | End-to-end execution time |
| `jamjet_node_duration_ms` | Histogram | Per-node execution time by node type |
| `jamjet_queue_depth` | Gauge | Pending executions in queue |
| `jamjet_model_tokens_total` | Counter | Token usage by model and direction |
| `jamjet_model_cost_usd_total` | Counter | Estimated cost by model |

Example Prometheus query for p99 execution latency:

```promql
histogram_quantile(0.99,
  rate(jamjet_execution_duration_ms_bucket[5m])
)
```

## Grafana dashboard

Import the official JamJet Grafana dashboard (ID: `jamjet-runtime`) for a pre-built overview:

- Execution throughput and error rate
- Model latency distribution
- Token usage and cost over time
- Queue depth and worker saturation

## Structured logs

JamJet emits structured JSON logs to stdout by default:

```json
{
  "timestamp": "2026-03-07T09:31:00.012Z",
  "level": "info",
  "event": "node_completed",
  "execution_id": "exec_01JM4X8NKWP2",
  "workflow_id": "research-agent",
  "node_id": "think",
  "node_kind": "model",
  "model": "claude-haiku-4-5-20251001",
  "duration_ms": 512,
  "input_tokens": 64,
  "output_tokens": 312
}
```

Configure log level and format in `jamjet.toml`:

```toml
[logging]
level = "info"       # debug | info | warn | error
format = "json"      # json | text
```

## Inspecting executions

The `jamjet inspect` command gives you the full execution trace locally without any observability backend:

```bash
jamjet inspect exec_01JM4X8NKWP2
jamjet inspect exec_01JM4X8NKWP2 --events    # full event timeline
jamjet inspect exec_01JM4X8NKWP2 --state     # just final state
```

## Alerting

With Prometheus + Alertmanager, add alerts for:

```yaml
# alerts.yml
groups:
  - name: jamjet
    rules:
      - alert: HighExecutionErrorRate
        expr: |
          rate(jamjet_executions_total{status="failed"}[5m]) /
          rate(jamjet_executions_total[5m]) > 0.05
        for: 2m
        annotations:
          summary: "JamJet error rate above 5%"

      - alert: ExecutionQueueBacklog
        expr: jamjet_queue_depth > 100
        for: 5m
        annotations:
          summary: "JamJet execution queue is backing up"
```

<Aside type="note">
All telemetry is opt-in in `jamjet dev`. In production deployments, telemetry is enabled by default to ensure you have visibility into agent behavior.
</Aside>
