---
title: "Approvals That Survive kill -9"
date: 2026-06-12
description: "JamJet's human-in-the-loop approvals are event-sourced. Park a payment on a human gate, kill the runtime, restart it, and the approval is still waiting. Approve it and the workflow finishes."
author: "Sunil Prakash"
category: "Build log"
---

![A workflow parks on an approval, the server dies with kill -9, restarts, and the approval is still pending. One command approves it and the workflow completes.](/blog/approvals-demo.gif)

That GIF is not edited. A workflow hits a `payments.*` tool, parks on a human approval, the runtime gets `kill -9`, comes back, and the approval is exactly where it was. One `jamjet approve` later the workflow runs to completion.

## Why this matters

Human-in-the-loop is not a temporary crutch that better models will remove. The largest empirical study of production agent systems I know of, [Measuring Agents in Production](https://arxiv.org/pdf/2512.04123) (ICML 2026), found that 74% of practitioners rely primarily on human-in-the-loop validation, and 68% of deployed agents execute fewer than 10 steps before a human intervenes. Gates are the production pattern.

But a gate is only as good as its memory. If your approval state lives in process memory, a crash, deploy, or OOM kill silently drops the gate. The agent either re-runs the risky action without asking, or the work is gone and nobody is told. A gate that evaporates under failure is worse than no gate, because you stopped watching.

## How it works

JamJet executions are event-sourced. When policy says a node needs approval, the worker writes a `ToolApprovalRequired` event, settles its work item, and stops. Nothing holds a lock, nothing waits in memory. The parked state IS the event log, which is why `kill -9` does not touch it.

```yaml
workflow:
  id: payment-processor
  version: 0.1.0
  start: fetch_details

nodes:
  fetch_details:
    type: tool
    tool_ref: fetch_payment_details
    next: submit_payment

  submit_payment:
    type: tool
    tool_ref: payments.submit
    next: end

policy:
  require_approval_for:
    - "payments.*"
```

Any tool matching `payments.*` parks before it runs. The decision side is a small, strict API:

- Approve, and the scheduler re-dispatches the node through the normal path. No special resume machinery, no replays of work that already happened.
- Reject, and the node fails closed. The workflow fails with the decider and comment recorded in the failure reason.
- Decide something that is not pending, already decided, or on a finished execution, and you get a 409. Omit `node_id` with several approvals pending and you get a 400. With exactly one pending, the runtime infers it.

Agents can sit on the approving side too: the MCP tool `jamjet_approve` goes through the same validated path, so a supervising agent or IDE assistant follows the same rules a human does.

## The hosted side

If you run JamJet Cloud, the same gate works from TypeScript without running the OSS runtime:

```typescript
import { requireApproval } from '@jamjet/cloud'

const approvalId = await requireApproval('wire_transfer', {
  context: { amount: 50_000, currency: 'EUR' },
})
// resolves once a reviewer approves in the dashboard
// throws JamjetApprovalRejected with the reviewer's reason otherwise
```

`requireApproval()` creates a pending approval, it shows up in the dashboard's Pending tab, someone decides with a reason, and the SDK call resolves or throws. The decision lands in the audit trail either way.

## Try it in two minutes

```bash
pip install jamjet        # 0.10.2
jamjet dev &
jamjet run workflow.yaml --no-follow
jamjet approvals <execution-id>     # parked
jamjet approve <execution-id> --decision approved
```

Kill the server between any two of those commands. It does not matter. That is the point.

Released today: runtime crates 0.4.0 on crates.io, `jamjet` 0.10.2 on PyPI, `jamjetdev/jamjet:0.4.0` on Docker Hub. Full docs at [docs.jamjet.dev](https://docs.jamjet.dev/en/docs/open-source/approvals), Cloud approvals at [cloud governance docs](https://docs.jamjet.dev/en/docs/cloud/governance/approvals).

## Also shipped recently

A few things landed quietly over the past weeks and deserve a line each:

- **Multi-agent fleets and cron.** One YAML file declares N agents and workflows, each with its own tools and optional schedule. Shipped in SDK 0.9.0, runs on the same durable runtime.
- **Cloud Signals.** A live token-usage and event feed in the dashboard, with enforcement actions (blocked, held, redacted, compacted) inline as they happen.
- **OTel GenAI emission.** The Rust runtime now emits OpenTelemetry GenAI semantic-convention spans and token-usage metrics natively (runtime 0.4.0), so JamJet plugs into the observability stack you already run.

Source and issues: [github.com/jamjet-labs/jamjet](https://github.com/jamjet-labs/jamjet). If you try the approval flow and something surprises you, open an issue. The fastest fixes this month came from exactly that.
