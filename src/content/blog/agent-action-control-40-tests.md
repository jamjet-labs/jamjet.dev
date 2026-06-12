---
title: "I ran 40 agent-action control tests against Microsoft AGT, Cloudflare HITL, LangSmith Gateway, and Anthropic permission policies"
date: 2026-05-23
description: "AgentBoundary v0.1 conformance suite, 40 deterministic tests, four vendors. Per-vendor mapping and per-scenario verdicts in the public adapters/ tree. Run it yourself in 60 seconds."
author: "Sunil Prakash"
draft: false
category: "Benchmark"
---

## Approval is not proof

Most agent governance tools can approve an action. None of them lets a third party — an auditor, a regulator, an insurer, a compliance team six months later — verify what the agent was actually allowed to do, with which arguments, by whose approval, against which policy version, with what execution outcome, without trusting the runtime, the model provider, or the storage layer.

I wrote a spec — **AgentBoundary v0.1** — and a conformance suite of 40 deterministic tests, each named for the failure it prevents. Then I ran the suite against four products that ship today: Microsoft Agent Governance Toolkit, Cloudflare HITL Agents, LangSmith Gateway, and Anthropic Managed Agents `permission_policy`.

This report walks through what each product does, what it doesn't do, and the gap an open receipt format fills.

## The matrix

![AgentBoundary v0.1 conformance — cross-vendor matrix (40 scenarios × 5 columns)](https://raw.githubusercontent.com/jamjet-labs/agentboundary/main/docs/assets/comparative-matrix.svg)

| Vendor | PASS | PARTIAL | DOCS-ONLY | NOT COVERED | N/A |
|---|---:|---:|---:|---:|---:|
| **JamJet reference** | **40** | 0 | 0 | 0 | 0 |
| Microsoft AGT | 17 | 5 | 1 | 15 | 2 |
| LangSmith Gateway | 15 | 14 | 1 | 8 | 2 |
| Anthropic permission_policy | 12 | 9 | 3 | 14 | 2 |
| Cloudflare HITL Agents | 5 | 7 | 1 | 25 | 2 |

The figure and table are alphabetical, not ranked. The matrix is the visual signature; the per-vendor sections explain why each cell is what it is.

## Run it yourself

```bash
npx agentboundary run scenarios/
# or
uvx agentboundary run scenarios/
```

60 seconds on a clean machine. No signup, no Docker, no account. Source for every scenario lives at `https://github.com/jamjet-labs/agentboundary/tree/main/scenarios`. If your results disagree, [open an issue](https://github.com/jamjet-labs/agentboundary/issues) with the exact command, the receipt, and your environment.

## One real Action Receipt

This receipt was emitted in production by JamBot — a Discord agent that files GitHub issues on behalf of users, running on Fly.io. Click through to verify:

- **Receipt:** `https://app.jamjet.dev/jambot/receipts/f04df972-f9fc-4624-83cb-0ed3682297cf`
- **GitHub issue:** `https://github.com/jamjet-labs/jamjet-discord-bot/issues/1`
- **Schema:** `https://agentboundary.jamjet.dev/schemas/action-receipt-v0.2-alpha.json`

```json
{
  "version":      "agentboundary/v0.2-alpha",
  "receipt_id":   "f04df972-f9fc-4624-83cb-0ed3682297cf",
  "issued_at":    "2026-05-21T06:54:39.251Z",

  "actor": {
    "type":         "agent",
    "id":           "agent:jambot:discord:user:aa74fa40751b528f",
    "display_name": "JamBot · acting for jam"
  },

  "agent":  { "framework": "discord.js",  "framework_version": "14.16.3",  "model": "claude-haiku-4-5-20251001" },
  "tool":   { "name": "github-rest",     "version": "2022-11-28",         "capability": "github.issues.create" },
  "target": { "system": "github.com/jamjet-labs/jamjet-discord-bot", "environment": "prod", "resource_id": "jamjet-labs/jamjet-discord-bot" },

  "arguments_hash":  "2d257d4e72f62afa112766154b9b5ac0dd98ae79ee7c2758563a4363a0fb4bdf",
  "policy":          { "name": "jambot.file-issue.v1", "version": "1", "decision": "allow" },
  "execution":       { "status": "success", "completed_at": "2026-05-21T06:54:40.103Z", "result_ref": "github://issues/1" },

  "prior_receipt": {
    "receipt_id":   "cab5eff7-923e-4f51-8bd1-74875667fdf1",
    "receipt_hash": "3e7f5a9337b26c036a09530b5d38f29389481c8afd4f07b22cd76e05a9a454af"
  },

  "completeness_score": 0.913,
  "provenance":         { /* 22 entries: 20 observed, 2 inferred — see receipt URL above */ },

  "receipt_hash": "..."
}
```

A verifier with only this receipt — no access to JamBot's database, no Fly.io credentials, no GitHub token, no Discord session — can:

1. Re-canonicalise the receipt body without `receipt_hash`, take SHA-256, and confirm it matches the field. **Tamper-evidence.**
2. Re-canonicalise the action's arguments and take SHA-256, confirming it matches `arguments_hash`. **Argument binding.**
3. Fetch the v0.2-alpha JSON Schema and validate the receipt structurally. **Spec compliance.**
4. Fetch the receipt at `prior_receipt.receipt_id` and confirm its `receipt_hash` matches the link. **Chain integrity.**
5. Recompute `completeness_score` from `provenance` using the deterministic integer formula. **Emitter honesty.**
6. Follow `execution.result_ref` to a public GitHub issue and read it. **Execution proof.**

Six independent verifications from one artifact. The rest of this report is what the four vendor sections demonstrate is **missing** from each of their emitted artifacts, and the concrete attack vectors each gap leaves open.

## Methodology

### How the suite is structured

The 40 scenarios are partitioned roughly by what they test:

- **Lifecycle scenarios** (01–05, 22, 35, 36, 37, 38): basic allow/deny/escalate/require-approval paths, including non-prod environments and the honest "approved but execution failed" path.
- **Schema scenarios** (06, 07, 10, 22, 23): malformed or missing fields that the spec rejects.
- **Hashing scenarios** (08, 09, 24, 33, 34, 39, 40): argument and receipt-hash recomputation; canonical-JSON robustness across unicode, empty objects, nested structures, large payloads.
- **Adversarial Level 4** (11–16, 25, 30): stale approval, unauthorized approver, replay, completed-before-issued, policy-version downgrade, deny-with-execution-success contradictions.
- **v0.2-alpha extensions** (26–32): provenance, completeness_score, prior_receipt chain.
- **Positive boundaries** (17–18, 25, 28, 29, 31, 32): scenarios that should NOT fire failure codes; ensure the verifier doesn't false-positive.

Each scenario name describes the failure it prevents. There is no scenario `037-tests-section-43-of-spec`. Every test ties to a specific real-world attack or audit-failure mode.

### How each vendor was evaluated

For each vendor:

1. Read the vendor's public documentation cover-to-cover (URLs in each section).
2. Build a synthetic representation of what their normative artifact carries — either a schema-defined record (Microsoft AGT) or a recommended developer-implemented capture shape (Cloudflare, LangSmith, Anthropic).
3. Write a per-vendor adapter under [`jamjet-labs/agentboundary/adapters/<vendor>/`](https://github.com/jamjet-labs/agentboundary/tree/main/adapters) that translates the vendor's artifact into an AgentBoundary v0.2-alpha receipt.
4. Run all 40 conformance scenarios against adapter-translated receipts and record PASS / PARTIAL / DOCS-ONLY / NOT COVERED per scenario.
5. Write up the reasoning in `adapters/<vendor>/results.md`.

Each vendor's adapter has its own test suite (11–12 smoke tests apiece) confirming the translation produces schema-valid receipts and that conformance checks behave as the per-scenario notes claim.

### What this evaluation is *not*

- **Not a leaderboard.** The vendors target meaningfully different layers of the stack; ordering by PASS count obscures the categorical differences.
- **Not a feature audit.** Each of the four products solves problems AgentBoundary's spec deliberately doesn't address.
- **Not a recommendation against any product.** Passing fewer conformance tests does not mean the software is worse; it means the product addresses a different question.
- **Not synthetic.** Every scenario is reproducible from `agentboundary run scenarios/`. Every adapter is in the public repo.

### Right to respond

Each vendor received a right-to-respond invitation between 2026-05-21 and 2026-05-23 (see Appendix B for per-vendor links). The 7-day windows for Microsoft AGT, LangSmith Gateway, and Anthropic Claude Agent SDK are open at the time of publication; Cloudflare's was exercised the same day it was filed. Corrections received during or after the windows are folded into the report inline with date stamps and the original cell strikethrough — the per-vendor `results.md` files in the repo are the live record.

---

## 7.1 Anthropic Managed Agents `permission_policy`

**12 PASS · 9 PARTIAL · 3 DOCS-ONLY · 14 NOT COVERED · 2 N/A**

**What Anthropic does:** the Claude Agent SDK ships the richest *runtime permission primitive* in this comparison. The evaluation pipeline is hook → deny rule → permission mode → allow rule → `canUseTool` callback. Permission modes (`default`, `dontAsk`, `acceptEdits`, `bypassPermissions`, `plan`, `auto`) provide session-level posture. Scoped patterns like `Bash(rm *)` express tool-plus-argument constraints in the same vocabulary as the tool definitions. The April 2026 launch of Claude Managed Agents adds a hosted runtime with sandboxing, state persistence, and a Console-side audit log.

**Where Anthropic passes:** Level 3 hashing scenarios (33, 34, 39, 40) — the `canUseTool` callback receives the tool's `tool_input` as raw JSON, which an adapter can canonicalise and hash directly. Policy decision (allow / deny / ask) maps cleanly to AgentBoundary's enum. `matched_rule` provides a stable per-decision identifier when a declarative rule fires. Replay detection works because each decision event carries a fresh UUID.

**Where Anthropic falls short:** the 3 DOCS-ONLY rows are the load-bearing miss. Anthropic's Managed Agents Console maintains a comprehensive audit log per the April 2026 launch announcement — *"the Claude Console where compliance and engineering teams can inspect every tool call and decision."* The schema of that audit log is not publicly documented. A team using Claude Managed Agents has excellent in-product audit visibility and **no portable evidence to share with external verifiers**. Of the NOT COVERED rows: no chain primitive (29, 30, 32), no environment field (35, 36), no escalate-versus-ask distinction (05), no policy version field (15), no portable agent-identity primitive (19).

**Concrete attack vector this gap leaves open:** an audit-row exporter for Anthropic Managed Agents would need to know the Console's audit log's exact field shape — which Anthropic doesn't publish. A regulated customer can't independently extract their own audit data in a verifiable format unless Anthropic publishes the schema or builds an export pipeline.

**The honest framing:** Anthropic's permission_policy is the strongest runtime primitive in this comparison; AgentBoundary v0.2-alpha is the export format for the artifact gap. A team can wrap their `canUseTool` callback or `query()` invocation, capture the synthetic decision event documented in `adapters/anthropic-permission-policy/mapping.md`, and emit a v0.2-alpha receipt at the action boundary.

**Sources:**
- `https://code.claude.com/docs/en/agent-sdk/permissions`
- `https://platform.claude.com/docs/en/managed-agents/overview`
- [adapter + results](https://github.com/jamjet-labs/agentboundary/tree/main/adapters/anthropic-permission-policy)
- [Right-to-respond issue](https://github.com/anthropics/claude-agent-sdk-python/issues/986)

---

## 7.2 Cloudflare HITL Agents

**5 PASS · 7 PARTIAL · 1 DOCS-ONLY · 25 NOT COVERED · 2 N/A**

**What Cloudflare does:** the `@cloudflare/agents` SDK provides a `needsApproval` workflow primitive — tools marked with `needsApproval: true` pause execution and await an `addToolApprovalResponse` call from the client. Cloudflare Workflows extends this with `waitForApproval()` for durable, multi-day approval windows. Integration with Knock and similar notification systems is well-supported. The documentation recommends developers persist their own audit log via `this.sql` using a 6-column suggested schema.

**Where Cloudflare passes:** Levels 1-2 fundamentals — the recommended audit row records the decision (`approved`/`rejected`), who decided (`decided_by TEXT`), when (`decided_at INTEGER`), and an optional reason. The mutation-require-approval lifecycle is exactly what `needsApproval` is for. Timestamp encoding is type-safe (`INTEGER` millis since epoch, well-formed).

**Where Cloudflare falls short:** the 25 NOT COVERED count is the highest of any vendor in this report and reflects the depth of the artifact gap. Cloudflare's `approval_audit` table is *6 columns*. It carries the decision and the approver. It does not carry the tool, the arguments (or any hash), the policy reference, the execution outcome, an agent identity, or any tamper-evidence primitive. Each gap is a structural property the audit row cannot express because the recommended schema doesn't define a field for it.

**Concrete attack vectors:** the agent or middleware mutates the tool arguments between the `needsApproval` decision and the `execute` call — Cloudflare's audit row records the approval and the workflow continues; the mutated execution is undetectable from the audit log (NOT COVERED 08). The audit row records that a tool was approved; whether the tool actually executed, succeeded, or failed lives in a separate developer-defined system (NOT COVERED 16, 22, 37). A forger who never invokes the tool but inserts an audit row showing approval cannot be caught from the row alone.

**The honest framing:** Cloudflare's HITL is *excellent* at a problem AgentBoundary does not address — durable approval workflows with multi-day windows and external notification integration. It is deliberately not an emitted-artifact format. A team can adopt AgentBoundary on top of Cloudflare HITL by writing v0.2-alpha receipts into `this.sql` *alongside* or *instead of* the suggested `approval_audit` table. The two systems are complementary; the comparison reveals they target different layers, not that one is better than the other.

**Sources:**
- `https://developers.cloudflare.com/agents/concepts/human-in-the-loop/`
- `https://developers.cloudflare.com/agents/guides/human-in-the-loop/`
- `https://github.com/cloudflare/agents`
- [adapter + results](https://github.com/jamjet-labs/agentboundary/tree/main/adapters/cloudflare-hitl)
- [Right-to-respond issue](https://github.com/cloudflare/agents/issues/1571)

---

## 7.3 LangSmith Gateway

**15 PASS · 14 PARTIAL · 1 DOCS-ONLY · 8 NOT COVERED · 2 N/A**

**What LangSmith does:** Run objects capture rich per-call data — `inputs`, `outputs`, `start_time`, `end_time`, `status`, `tags`, `feedback_stats`, `extra`, full trace tree via `parent_run_id`. The Gateway adds spend caps and PII redaction at the LLM-request layer. LangSmith Fleet adds agent identity, RBAC, and (in private beta) ABAC. The platform is self-hostable on customer Kubernetes for data sovereignty.

**Where LangSmith passes:** Level 3 hashing scenarios (33, 34, 39, 40) — `Run.inputs` stores raw JSON the adapter canonicalises and hashes directly. Timeline scenarios (14, 07) — both `start_time` and `end_time` are captured; the issued-vs-completed split survives. Run-ID replay detection works because every Run carries a globally-unique UUID. Failure-with-error-code (37) maps cleanly: `Run.status: error` + `Run.error.code`.

**Where LangSmith falls short:** the 14 PARTIAL count is LangSmith's signature. The data is in the Run somewhere; the schema location varies by team convention. `Run.tags` is a free-form list — one team writes `decision:allow`, another writes `verdict-allow`, a third puts it in `feedback_stats`. A cross-team auditor cannot reliably extract the data without per-team schema understanding. LangSmith does best at scenarios that operate on the structured Run fields (inputs, timestamps, status); it does worst at scenarios that require a normative policy/identity primitive (which LangSmith deliberately leaves to convention).

**Concrete attack vectors:** two teams using LangSmith for the same workflow record approval differently. A regulator extracting audit data across multiple teams' deployments has no canonical field to query. A team updates its policy logic and existing runs are tagged with the old policy name but no version (15). The `parent_run_id` builds a tree per trace; it does NOT chain across traces, so deletion of a run between two traces is undetectable from a single trace (29).

**The honest framing:** LangSmith is the most full-featured *observability platform* in this comparison. The Run object captures everything an engineer needs to debug a multi-step agent call. What it does not have — and does not claim to have — is a normative artifact format for portable verification. A team adopting AgentBoundary on top of LangSmith gets the artifact format LangSmith deliberately leaves to the implementer. The two artifacts serve different audiences: LangSmith's run tree is for engineers debugging; the AgentBoundary receipt is for third-party verifiers.

**Sources:**
- `https://docs.langchain.com/langsmith/run-data-format`
- `https://www.langchain.com/blog/introducing-llm-gateway`
- [adapter + results](https://github.com/jamjet-labs/agentboundary/tree/main/adapters/langsmith-gateway)
- [Right-to-respond issue](https://github.com/langchain-ai/langsmith-sdk/issues/2919)

---

## 7.4 Microsoft Agent Governance Toolkit (AGT)

**17 PASS · 5 PARTIAL · 1 DOCS-ONLY · 15 NOT COVERED · 2 N/A**

**What Microsoft does:** the Agent Governance Toolkit, released April 2026 as `microsoft/agent-governance-toolkit` (MIT-licensed, OWASP Agentic Top 10 coverage claimed), ships with a normative `AuditEntry` schema, a Merkle-chained tamper-evidence model, and the `DecisionBOM` reconstruction format with a self-reported `completeness_score` field. The toolkit supports YAML, OPA/Rego, and Cedar for policy expression. CloudEvents export is documented for SIEM integration. Approval workflows include quorum logic.

**Where AGT passes:** Levels 1-2 are largely covered — `decision`, `agent_id`, `matched_rule`, `timestamp` are all in the normative `AuditEntry`. The chain (13, 25, 29, 30, 32) is *structurally stronger* than AgentBoundary v0.2-alpha's singly-linked design: AGT's Merkle chain commits every entry to every preceding entry, making entry-reordering attacks detectable that AgentBoundary v0.2-alpha would miss. The L3 hash-recompute scenario (09) passes because AGT's `entry_hash` is SHA-256 of a canonicalised dict. AGT's outcome enum (`success` / `failure` / `denied` / `error`) carries the failure-with-error-code distinction via metadata (37).

**Where AGT falls short:** the 15 NOT COVERED rows reflect AGT-side schema gaps that AgentBoundary cannot retrofit because they require AGT-side data the `AuditEntry` doesn't carry. The four big ones:

1. **No normative `arguments_hash`.** Tool arguments live in `AuditEntry.data` or `metadata`; canonicalisation is implementation-defined. The spec Appendix shows `tool_args_hash` as a *sample* metadata key, not required. A verifier cannot recompute a hash from the entry alone to detect post-policy argument mutation (08, 20, 21, 33, 34, 39, 40).
2. **No approver identity.** Approvals surface as `decision: escalate` in the audit log. The actual approver, approval timestamp, and approval context live in workflow systems external to AGT's audit schema (11, 12, 24, 38).
3. **No policy version.** AGT records `matched_rule` (a rule ID) but no policy version string (15).
4. **Single timestamp per entry.** AGT has one `timestamp`; there is no separate issued-vs-completed split, so the timeline-consistency check (14) doesn't apply.

Additionally, AGT has no `target.environment` field (35, 36), no `actor.type` enum distinguishing agent vs human (19, 36), and no claim of conformance to a specific AgentBoundary level (10).

**Where AGT does something better than v0.2-alpha:**

- **Merkle chain.** AGT's audit log commits every entry to every preceding one; reordering or selectively deleting entries is detectable. AgentBoundary v0.2-alpha's `prior_receipt` is singly-linked — strong for detecting deletion of the *next* receipt, weaker for detecting deletion of *arbitrary* prior receipts. v0.3 candidate.
- **`DecisionBOM.completeness_score`.** AGT's `BOMField` carries a per-field reconstruction confidence. AgentBoundary v0.2-alpha has a coarser three-tier provenance enum (observed/inferred/synthesized). v0.3 candidate to add a numeric confidence per field if practitioner feedback warrants it.

**Engagement note (2026-05-22 → 23):** the AGT team's first reply on the right-to-respond issue agreed that several of the gap fields are worth closing. PR [`microsoft/agent-governance-toolkit#2473`](https://github.com/microsoft/agent-governance-toolkit/pull/2473) (merged) adds `arguments_hash`, `approver_did`, and `policy_version` to `AuditEntry`. PR [`#2532`](https://github.com/microsoft/agent-governance-toolkit/pull/2532) (open) adds optional `issued_at` and `completed_at`. The `environment` field was added by an unrelated AGT PR (`#2527`). When these land, AGT's NOT COVERED count drops materially — the report will be re-graded against the post-merge schema and updated inline.

**The honest framing:** Microsoft AGT is the closest peer to AgentBoundary in this comparison — it's also an *artifact format* designed for verifiable evidence, and several of its design choices (Merkle chain, decision-lineage reconstruction) are improvements AgentBoundary v0.2-alpha should adopt for v0.3. The 15 NOT COVERED rows reflect that AGT's design centre is *runtime enforcement* and policy authorship; AgentBoundary's design centre is *portable third-party verification of artifacts after the fact*. The two specs could reasonably converge — AGT could adopt arguments-hash and policy-version primitives; AgentBoundary could adopt Merkle chains. The path forward is *more standardisation, not less.*

**Sources:**
- `https://github.com/microsoft/agent-governance-toolkit`
- `https://opensource.microsoft.com/blog/2026/04/02/introducing-the-agent-governance-toolkit-open-source-runtime-security-for-ai-agents/`
- `https://github.com/microsoft/agent-governance-toolkit/blob/main/docs/specs/AUDIT-COMPLIANCE-1.0.md`
- [adapter + results](https://github.com/jamjet-labs/agentboundary/tree/main/adapters/microsoft-agt)
- [Right-to-respond issue](https://github.com/microsoft/agent-governance-toolkit/issues/2449)

---

## 8. Where JamJet's own reference implementation passes — and where it fails

The matrix shows JamJet's reference implementation passing all 40 scenarios. That's the implementation grading itself against its own spec; meaningful but not sufficient. The credibility-earning section is where JamJet does **not** yet hold up.

### Where JamJet currently falls short

**1. JamJet's emitter mutates receipts on approval-finalize.** The JamBot live demo has a documented quirk: when a maintainer ✅ a require-approval receipt, the existing row's `execution.status` is updated from `blocked` to `success` and the `receipt_hash` is recomputed in place. Any *later* receipt whose `prior_receipt.receipt_hash` was captured before the mutation will show a broken chain on verifier check.

   **Status:** documented in `jamjet-discord-bot/src/storage/supabase.ts`. Phase 2 fix is to emit a new receipt for the approval finalization rather than mutating in place. Not done; expected before v0.2-alpha graduates to v0.2.

**2. JamJet has no AGT-style Merkle chain across all receipts.** AgentBoundary v0.2-alpha's `prior_receipt` is singly-linked: receipt N commits only to receipt N-1. AGT's chain commits every entry to every preceding entry. An attacker who could insert a forged receipt between N-5 and N-4 (recomputing all subsequent `prior_receipt.receipt_hash` values) would not be detected by v0.2-alpha's chain alone.

   **Status:** known design tradeoff in favour of singly-linked simplicity for v0.2-alpha. v0.3 candidate to extend to a full Merkle commitment.

**3. JamJet has no per-field reconstruction-confidence numeric.** AgentBoundary v0.2-alpha's `provenance` enum is three values (`observed` / `inferred` / `synthesized`). AGT's `BOMField.confidence` is a float `[0.0, 1.0]`. The three-tier enum is simpler to reason about but coarser; some translations live ambiguously between `inferred` and `synthesized`.

   **Status:** intentional simplification for v0.2-alpha. v0.3 candidate.

**4. JamJet's v0.2-alpha is alpha.** The spec is not finalised. Field names, value enums, and conformance check codes may change before v0.2 stabilises. Consumers should pin to `v0.2-alpha` explicitly and expect breakage at the v0.2 release boundary.

   **Status:** the published schema's `version` field is `"agentboundary/v0.2-alpha"` to signal this.

**5. JamJet has no second non-reference implementation yet.** The reference Python implementation at `src/agentboundary/` is the only complete v0.2-alpha emitter. JamBot at `jamjet-labs/jamjet-discord-bot` is the only production deployment. A second independent implementation in a different language (Rust, Go, Java) would validate the spec is implementation-portable.

   **Status:** vendor adapters under `adapters/` produce v0.2-alpha receipts but are not full emitters; each is a translation layer over an existing vendor's audit log.

### Where JamJet passes — that the vendors don't

The features in this report that no vendor in the comparison can replicate from its current artifact alone:

- Single-receipt verification (six independent properties from one JSON document)
- Cryptographically-bound argument hash that recomputes from raw inputs
- Schema-versioned receipt format with explicit pinning per receipt
- Self-reported provenance with deterministic, integer-arithmetic completeness score
- Singly-linked chain across the emitter's stream
- Public conformance suite anyone can run in 60 seconds

These are the spec's deliberate design choices, not vendor-vs-vendor wins.

## 9. How to run the suite

```bash
npx agentboundary run scenarios/                   # full 40-scenario suite
npx agentboundary run scenarios/11-stale-approval.yaml  # one scenario
npx agentboundary run scenarios/ --json | jq      # machine-readable
```

If you produce different results, [open an issue](https://github.com/jamjet-labs/agentboundary/issues) with the exact command, your environment, and the output. The suite is reproducible; if it isn't on your machine, that's a bug.

To verify the JamBot live receipt:

```bash
curl -sf https://app.jamjet.dev/api/public/jambot/receipts/f04df972-f9fc-4624-83cb-0ed3682297cf
```

To verify the JSON Schema:

```bash
curl -sf https://agentboundary.jamjet.dev/schemas/action-receipt-v0.2-alpha.json
```

## 10. Closing

The spec is open. Implementations welcome. Open an issue if a mapping is wrong.

[Spec](https://github.com/jamjet-labs/agentboundary/blob/main/docs/spec/v0.1.md) · [v0.2-alpha draft](https://github.com/jamjet-labs/agentboundary/blob/main/docs/spec/v0.2-alpha.md) · [Conformance suite](https://github.com/jamjet-labs/agentboundary/tree/main/scenarios) · [JamBot live receipts](https://app.jamjet.dev/jambot/receipts)

*From the lab behind Engram memory benchmarks and prior AIP work.*

---

## Appendix A — Per-vendor right-to-respond log

| Vendor | Repo | Issue | Filed | Status |
|---|---|---|---|---|
| Microsoft AGT | `microsoft/agent-governance-toolkit` | [#2449](https://github.com/microsoft/agent-governance-toolkit/issues/2449) | 2026-05-21 | Engaged; PRs [#2473](https://github.com/microsoft/agent-governance-toolkit/pull/2473) merged + [#2532](https://github.com/microsoft/agent-governance-toolkit/pull/2532) open |
| LangSmith Gateway | `langchain-ai/langsmith-sdk` | [#2919](https://github.com/langchain-ai/langsmith-sdk/issues/2919) | 2026-05-21 | Acknowledged; window open until 2026-05-28 |
| Cloudflare HITL | `cloudflare/agents` | [#1571](https://github.com/cloudflare/agents/issues/1571) | 2026-05-21 | Right-to-respond exercised; issue closed without further engagement |
| Anthropic Claude Agent SDK | `anthropics/claude-agent-sdk-python` | [#986](https://github.com/anthropics/claude-agent-sdk-python/issues/986) | 2026-05-23 | Window open until 2026-05-30 |

Corrections received during or after the windows are folded into the per-vendor `adapters/<vendor>/results.md` files in the public repo. Material corrections are surfaced in this report inline with date stamps and the original cell strikethrough; the per-vendor `results.md` is the live record.
