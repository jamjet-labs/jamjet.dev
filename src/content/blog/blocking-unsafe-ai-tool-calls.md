---
title: "I tried to delete a database with an AI agent. The runtime said no."
date: 2026-05-11
description: "JamJet 0.8.1 (Python) and @jamjet/cloud 0.2.2 (TypeScript) ship a runtime safety layer that intercepts an agent's tool calls before the tool function is invoked — and the four zero-setup demos prove the path."
author: "Sunil Prakash"
draft: false
category: "Engineering"
---

## The setup

I made an AI agent try to delete a database. Here's what happened:

```text
$ pip install jamjet
$ jamjet demo unsafe-tool-call

JamJet demo: unsafe tool-call blocking

Scenario:
  An AI agent wants to clean up old customer records.

Agent (DeterministicDemoAgent (mocked -- no real model)) requested tool:
  database.delete_all_customers({'reason': 'cleanup old records'})

Policy check:
  blocked patterns: '*delete*'

Decision: BLOCKED
Reason:   tool name matches blocked pattern '*delete*'

Audit event:
  trace_id:    jj_7f21c9
  decision_id: dec_91ab2
  executed:    false
  audit_path:  ./.jamjet-demo/runs/unsafe-tool-call-001.json

The model is mocked. The enforcement path is real.
```

The model never calls the tool. The runtime intercepts the request before it leaves the agent's process. The audit JSON survives a regulator's review.

That last line is the part I want to talk about.

## Why this matters

Frameworks like [LangGraph](https://github.com/langchain-ai/langgraph), [CrewAI](https://github.com/joaomdmoura/crewAI), the [OpenAI Agents SDK](https://github.com/openai/openai-agents-python), and clients like [Claude Desktop](https://claude.ai/download) all let you give an agent real tools -- database access, payment APIs, file writes, shell exec. The model decides what to call. That is the whole point of an agent.

But "the model decides" is not a security boundary. Prompts can be manipulated by tool output. Models hallucinate function arguments. Agentic loops compound small errors. The PocketOS, Replit, and Claude Code production-database incidents [(documented in detail here)](/blog/when-ai-deletes-the-database/) all share the same shape: an agent issued a tool call that no human reviewer would have approved, and there was no runtime between the model and the tool to say *no*.

Even the model vendors agree. In Anthropic's [Claude Code auto-mode launch post](https://www.anthropic.com/engineering/claude-code-auto-mode), the engineering team documents incidents from their own internal use and states explicitly that the classifier-based safety layer is not a drop-in replacement for careful human review on high-stakes infrastructure. The model vendor, after years of safety research, says the model cannot be the safety layer.

So the safety layer has to live in the runtime. That is what JamJet is.

## How JamJet does it

JamJet ships a `PolicyEvaluator` that sits between the agent loop and tool execution. Before any tool function is invoked, the evaluator matches the requested tool name against a glob-based policy. Decisions are `ALLOWED`, `BLOCKED`, or `REQUIRES_APPROVAL`. Every decision -- inputs, matching rule, outcome -- is written to an append-only audit record.

The shape of a policy:

```text
allow:            database.read_*,  filesystem.read
require approval: database.write_*, filesystem.write,  payments.*
block:            database.delete_*, database.drop_*,  shell.exec, *truncate*
```

In Python today, rules are registered programmatically (a YAML / config loader is on the near-term roadmap):

```python
from jamjet.cloud.policy import PolicyEvaluator

policy = PolicyEvaluator()
policy.add("block",            "*delete*")
policy.add("block",            "shell.exec")
policy.add("require_approval", "payments.*")

# Before invoking any tool, ask the policy:
decision = policy.evaluate(planned_tool)
if decision.blocked:
    raise PermissionError(f"{planned_tool} blocked by rule {decision.pattern}")
```

In TypeScript (`@jamjet/cloud@0.2.2`), the same primitive is exported from the package root — `import { PolicyEvaluator } from '@jamjet/cloud'` — and the API is shape-compatible.

The runtime is the seam. The model decides; the runtime executes or refuses. The policy is the contract between the agent author and whoever has to live with the consequences.

A handful of properties fall out of this design that I think are worth naming:

- **Decisions are made before the tool function is called.** Not after. The blocked code path never runs.
- **The decision is independent of the model.** Swap GPT-4o for Claude 4.7 for a local Llama. The policy still binds.
- **The audit log is the record.** Every run produces a JSON artifact with the trace ID, the policy version, the decision, the inputs, and the outcome. Sufficient for a regulator, an incident review, or a replay.

## What's honest

A few notes that belong in the foreground:

- This release is SDK-based. You import JamJet into your agent (`pip install jamjet` for Python, `pnpm add @jamjet/cloud` for TypeScript). That works cleanly for agents whose code you control.
- The next release is **JamJet Gateway** -- an MCP proxy that applies the same policy model to MCP traffic from Claude Desktop, Cursor, and any MCP-aware agent that does not have an SDK seam. See [/gateway](/gateway) for the preview.
- The demo agent is named `DeterministicDemoAgent` for a reason. It is a mock, not a real model. The enforcement path is real; the brain isn't. The point of the demo is to prove the runtime behaviour in three minutes without an API key, not to claim model performance.

## Try the four demos

```bash
pip install jamjet
jamjet demo unsafe-tool-call    # block destructive tool calls
jamjet demo approval            # pause for human approval
jamjet demo budget-cap          # hard $0.05 cost cap
jamjet demo mcp-tool-policy     # MCP-shaped policy (Gateway preview)
```

No API key. No Docker. No cloud. Each demo runs in seconds and writes its audit JSON to `./.jamjet-demo/runs/`. Open one in your editor and see the full decision record.

## Where this is going

Phase 1 is the SDK -- a runtime safety layer for agents whose code you control.

Phase 2 is the gateway. The protocol that most desktop agents and IDE agents use to reach tools is MCP, and that protocol is increasingly exposed on the wire. In April 2026, [OX Security disclosed an MCP STDIO transport class of issue](https://www.ox.security/blog/) where malicious or compromised MCP servers can exfiltrate context from the client without the agent's knowledge. The SDK can't help here -- the agent's process is not the relevant boundary. The wire is.

JamJet Gateway is a small proxy that sits between the client (Claude Desktop, Cursor, an OpenAI Agents SDK process) and the MCP servers it talks to. It enforces the same policy model as the SDK, but at the network. Same audit format. Same approval flow. Different deployment shape.

If a Python agent and Claude Desktop in the same engineering team can be governed by one policy file, that is a real reduction in surface area for whoever has to sign off on production.

---

- Star [jamjet-labs/jamjet](https://github.com/jamjet-labs/jamjet) to follow.
- Read [When AI Deletes the Database](/blog/when-ai-deletes-the-database/) for the longer argument about why this is a runtime problem.
- See the deeper [durability demo](/demo) for what happens when an agent crashes mid-tool-call.
- Preview [JamJet Gateway](/gateway) for Phase 2.
