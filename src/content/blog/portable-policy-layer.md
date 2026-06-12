---
title: "Every AI toolchain is inventing its own safety layer. We shipped one that works across all of them."
date: 2026-05-11
description: "JamJet shipped a portable policy layer that runs the same safety rules across Claude Code hooks, OpenAI Agents SDK guardrails, MCP stdio traffic, and the JamJet Python/TS SDKs. One policy file. One audit trail."
author: "Sunil Prakash"
draft: false
category: "Build log"
---

## Same policy. Three runtimes.

```text
# Claude Code, with @jamjet/claude-code-hook installed as a PreToolUse hook:
> Delete the old customer records from the staging DB.

  Tool request: bash.shell_exec
  Args: psql -c "DELETE FROM customers WHERE created_at < '2024-01-01'"

  JamJet policy: BLOCKED (rule: shell.exec)
  Audit: ~/.jamjet/audit/2026-05-11/claude-code-hook.jsonl
```

```text
# OpenAI Agents SDK (TS), with @jamjet/openai-guardrail wired into a refund tool:
JamjetPolicyBlocked: JamJet policy: BLOCKED
  (tool: payments.refund, rule: payments.*)

  Audit: ~/.jamjet/audit/2026-05-11/openai-guardrail.jsonl
```

```text
# Claude Desktop talking to a Postgres MCP server, fronted by @jamjet/mcp-shim:
{"jsonrpc":"2.0","id":7,"error":{
  "code": -32000,
  "message": "JamJet policy: BLOCKED (rule: *delete*)",
  "data": {"tool": "postgres.delete_all_rows", "audit": "mcp-shim.jsonl"}
}}
```

Same `policy.yaml`. Three runtimes. One audit log.

*The models are real. The tool calls came from real agent loops. The destructive payloads never reached the tool function.*

## The fragmentation problem

The market is converging on "control AI agent actions." But the primitives are not portable.

Anthropic shipped [Claude Code hooks](https://code.claude.com/docs/en/hooks) — `PreToolUse`, `PostToolUse`, `Notification`, and friends. They run as subprocesses, get JSON on stdin, and decide whether the tool call proceeds. OpenAI ships [tool guardrails](https://openai.github.io/openai-agents-python/guardrails/) in the Agents SDK — Python (and now TS) callables you attach to a tool, with tripwire booleans that abort the run. The MCP ecosystem is sprouting gateways and proxies for the same purpose: [MCPX](https://mcpx.dev), [IBM ContextForge](https://github.com/IBM/mcp-context-forge), [Microsoft's MCP Gateway](https://github.com/microsoft/mcp-gateway), [Lasso Security's MCP Gateway](https://www.lasso.security/) — all reasonable answers to the same wire-level question.

Each one is competently designed for its own context. None of them speak the same policy.

A real team I talked to last month runs Claude Code for engineering workflows, OpenAI Agents SDK for a customer-facing copilot, and two MCP servers wired into Cursor for ad-hoc database work. Their security review asked one question: *what can the agents do?*

The honest answer required reading a `settings.json`, a Python guardrail file, two MCP gateway configs in different YAML dialects, and an internal Confluence page describing the production `if`-statements. Three audit trails in three formats. Three approval flows — one Slack bot, one PagerDuty escalation, and one human paging through the OpenAI trace viewer.

![Today: every toolchain invents its own safety layer](/blog/portable-policy-fragmentation.svg)

The platforms are not the problem. The hook API is good. The guardrail API is good. The MCP proxy pattern is good. The problem is the seam between them — every team writes their own.

## The thesis

JamJet is the action-control plane for AI agents. One policy file. One audit trail. Across hooks, guardrails, MCP gateways, SDKs, and custom runtimes.

The portable layer underneath all of them is a single `policy.yaml` schema and a single audit JSONL schema. Every adapter reads the same YAML, writes the same JSONL. `jamjet audit show` tails the lot in one chronological view.

![JamJet: one policy file, every adapter, one audit log](/blog/portable-policy-one-policy-every-adapter.svg)

Phase 2 shipped five packages today: [`@jamjet/cloud@0.3.0`](https://www.npmjs.com/package/@jamjet/cloud), [`@jamjet/claude-code-hook@0.1.0`](https://www.npmjs.com/package/@jamjet/claude-code-hook), [`@jamjet/mcp-shim@0.1.0`](https://www.npmjs.com/package/@jamjet/mcp-shim), [`@jamjet/openai-guardrail@0.1.0`](https://www.npmjs.com/package/@jamjet/openai-guardrail), and [`@jamjet/cli@0.1.0`](https://www.npmjs.com/package/@jamjet/cli) on npm; plus `jamjet 0.8.3` on PyPI with `jamjet.integrations.openai_guardrail` as the Python sister. Source at [jamjet-labs/jamjet-policy](https://github.com/jamjet-labs/jamjet-policy).

## Three adapters in one paragraph each

**`@jamjet/claude-code-hook`** wires into Claude Code's `PreToolUse` hook. One line in `~/.config/claude-code/settings.json`:

```jsonc
{ "hooks": { "PreToolUse": [
    { "command": "jamjet-hook --policy ~/.jamjet/policy.yaml" }
] } }
```

Every tool call — native or MCP — runs through the policy before Claude Code invokes it. What it does: enforce, audit, and surface approval prompts as blocks in v0.1. What it does *not* do: replace Claude Code's own hook system. It is the hook.

**`@jamjet/mcp-shim`** sits between an MCP client (Claude Desktop, Cursor, an OpenAI Agents SDK MCP client) and any MCP server. You swap the server's `command` for the shim, pass the policy path, and put the real server after `--`:

```jsonc
{ "mcpServers": { "postgres": {
  "command": "npx",
  "args": [
    "-y", "@jamjet/mcp-shim", "--policy", "~/.jamjet/policy.yaml",
    "--server", "postgres", "--",
    "postgres-mcp", "--db", "postgresql://localhost/mydb"
  ]
} } }
```

The shim relays MCP traffic transparently. On a blocked `tools/call`, it returns a JSON-RPC error to the client — and the real MCP server never sees the request. What it does *not* do: replace the MCP protocol. It speaks MCP on both ends.

**`@jamjet/openai-guardrail`** (and its Python sister, `jamjet.integrations.openai_guardrail`) plugs into the OpenAI Agents SDK's `inputGuardrails` API. One line on a tool definition:

```ts
import { tool } from 'openai-agents'
import { jamjetGuardrail } from '@jamjet/openai-guardrail'

const refund = tool({
  name: 'payments.refund',
  inputGuardrails: [jamjetGuardrail({ policy: '~/.jamjet/policy.yaml' })],
  execute: refundCustomer,
})
```

Blocks throw `JamjetPolicyBlocked`. Approval-required calls throw `JamjetApprovalRequired` in v0.1 — the SDK aborts the run, audit gets written, and the run id is recoverable. What it does *not* do: replace the SDK's tripwire pattern. It is a tripwire.

![JamJet plugs into the extension points your tools already give you](/blog/portable-policy-respect-the-platforms.svg)

## The unified policy and audit

The policy file every adapter reads:

```yaml
version: 1
rules:
  - { match: "*delete*",   action: block }
  - { match: "shell.exec",  action: block }
  - { match: "payments.*",  action: require_approval }
  - { match: "database.read_*", action: allow }
audit:
  destination: ~/.jamjet/audit
```

Glob match. Four actions: `allow`, `block`, `require_approval`, `audit`. Same shape in every adapter.

The audit log every adapter writes:

```text
$ jamjet audit show
v 2026-05-11T10:14:02Z  claude-code-hook    fs.read_file           ALLOWED
x 2026-05-11T10:14:18Z  claude-code-hook    bash.shell_exec        BLOCKED               shell.exec
x 2026-05-11T10:21:47Z  mcp-shim            postgres.delete_rows   BLOCKED               *delete*
~ 2026-05-11T10:33:11Z  openai-guardrail    payments.refund        WAITING_FOR_APPROVAL  payments.*
v 2026-05-11T10:41:55Z  python-sdk          customers.search       ALLOWED
x 2026-05-11T10:52:09Z  openai-guardrail    db.drop_table          BLOCKED               *delete*
v 2026-05-11T11:07:33Z  mcp-shim            github.list_issues     ALLOWED
```

![Audit unification: one CLI tails every adapter](/blog/portable-policy-audit-unification.svg)

Four files in `~/.jamjet/audit/2026-05-11/`, one row per decision, sorted by timestamp. Pending approvals live in `~/.jamjet/pending/<run-id>.json` and clear via `jamjet approve <run-id>` or `jamjet reject <run-id>`. The audit format is documented in the [conformance spec](https://github.com/jamjet-labs/jamjet-policy/tree/main/conformance), and the v1 schema is what each adapter is tested against in CI.

This is the part of the launch we are most willing to defend. *That* answer to "what can the agents do?" — read it once, in one place.

## What's honest

- Each adapter is at **v0.1**. The policy YAML and audit JSONL shapes are committed to v1 and covered by conformance tests across all four adapters. Adapter-specific options will evolve in minor versions.
- **Approval surfaces as exceptions or blocks in v0.1** for hook, guardrail, and Python adapters. The filesystem flow works end-to-end today — `jamjet approve <run-id>` flips a pending file and the next run unblocks. SDK-integrated approval (the OpenAI Agents SDK approval API, Claude Code's native settings surface) and a web UI both land with JamJet Cloud sync in v0.2.
- **MCP shim is stdio only in v0.1.** HTTP/SSE MCP transports land in Phase 3 alongside the Java/Spring adapter.
- **JamJet Cloud sync** — shared team policies, cloud audit retention, signed approvals — is the v0.2 milestone. Today's flow is local-only by design, so nothing leaves the developer's machine unless you opt into Cloud.
- One Phase 1 line still applies: the demo agent prompts are real, the enforcement path is real, the audit is real. Pre-baked deterministic agents are clearly labelled as such.

## Try it

```bash
# Claude Code hook:
npm i -g @jamjet/claude-code-hook

# MCP shim (zero-install):
npx -y @jamjet/mcp-shim --help

# OpenAI Agents SDK guardrail (TS):
pnpm add @jamjet/openai-guardrail
# or Python:
pip install jamjet  # includes jamjet.integrations.openai_guardrail

# Unified CLI:
npm i -g @jamjet/cli
jamjet audit show
```

- Star [jamjet-labs/jamjet-policy](https://github.com/jamjet-labs/jamjet-policy) — the Phase 2 monorepo.
- Read the [Phase 1 launch post](/blog/blocking-unsafe-ai-tool-calls/) for the deeper argument about why the runtime, not the model, is the safety boundary.
- Join the [JamJet Discord](https://discord.gg/SAYnEj86fr) to talk through your toolchain — we want to know which extension points to plug into next.

Phase 3 is the Java/Spring adapter, MCP HTTP/SSE transport, and JamJet Cloud sync. Same policy. More surfaces.
