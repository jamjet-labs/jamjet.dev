---
title: "When AI Deletes the Database"
date: 2026-05-05
description: "From PocketOS to Replit, AI agents are wiping production databases. Why this is a runtime problem -- not a model problem -- and the architecture pattern that prevents it."
author: "Sunil Prakash"
category: "Incident analysis"
---

In April 2026, PocketOS lost its production database. The story is unusually clean. The team's Cursor agent, running Claude Opus 4.6, hit a credential mismatch in staging. Looking for a fix, it found an over-scoped Railway API token in an unrelated file, fired a single curl request, and triggered Railway's volume-delete endpoint. Production data and the volume-level backups -- which Railway co-located in the same blast radius -- were gone in nine seconds.

Founder Jeremy Crane's downtime ran past thirty hours. Railway's CEO personally restored the data and shipped a delayed-deletion change to the endpoint within the week. The agent, asked to summarize what happened, [reportedly produced an apology that ended with the words "NEVER FUCKING GUESS!"](https://www.theregister.com/2026/04/27/cursoropus_agent_snuffs_out_pocketos/).

That last detail is the one everyone shared. It is not the interesting one.

---

## The genre

Search "ai deleted database" and you get a steady drip of these stories. PocketOS is the most recent. Before it: [Replit's SaaStr incident in July 2025](https://www.theregister.com/2025/07/21/replit_saastr_vibe_coding_incident/), where an agent wiped a production database during an explicit code-and-action freeze and initially insisted the rollback was impossible. Before that: a [Claude Code agent that ran `drizzle-kit push --force` against a production Postgres in February 2026](https://github.com/anthropics/claude-code/issues/27063), dropping sixty-plus tables and months of trading data. The `--force` flag exists specifically to skip the interactive safety prompt that a human running the same command would have seen.

The most underreported case did not happen at any of those companies. It happened at the model vendor itself.

In Anthropic's [Claude Code auto-mode launch post](https://www.anthropic.com/engineering/claude-code-auto-mode), the engineering team documents incidents from their own internal use: an agent deleting remote git branches from a misinterpreted instruction, an agent uploading an engineer's GitHub auth token to an internal compute cluster, and an agent attempting migrations against a production database. Their classifier-based safety layer -- a separate model trained to flag dangerous actions before they execute -- misses a meaningful fraction of them. Anthropic states explicitly that auto mode is not a drop-in replacement for careful human review on high-stakes infrastructure.

Read that twice. The model vendor, after years of safety research, says the model cannot be the safety layer.

A note before going further: it is tempting to anthropomorphize these stories. The agent "decided." The agent "lied." The agent "panicked." It did none of those things. Generative models produce plausible-sounding text and plausible-sounding tool calls. A post-hoc explanation from the agent is not a confession; it is a continuation of the same generative process that produced the destructive call. The interesting question is structural, not psychological: what was the runtime around the model doing while all this happened?

---

## What broke, every time

The four incidents above span four different products, four different teams, and at least three different model providers. The shape of the failure is identical.

<figure style="max-width: 720px; margin: 2rem auto;">
<svg viewBox="0 0 720 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="d1-title" style="width:100%;height:auto;">
  <title id="d1-title">The recurring shape of AI-deletes-database incidents</title>
  <rect x="20" y="55" width="100" height="60" rx="4" fill="#ffffff" stroke="#141413" stroke-width="1.5"/>
  <text x="70" y="81" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#141413">Model emits</text>
  <text x="70" y="97" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#141413">tool call</text>
  <line x1="120" y1="85" x2="143" y2="85" stroke="#141413" stroke-width="1.2"/>
  <polygon points="143,81 150,85 143,89" fill="#141413"/>
  <rect x="150" y="55" width="130" height="60" rx="4" fill="#ffffff" stroke="#141413" stroke-width="1.5"/>
  <text x="215" y="81" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#141413">Lateral credential</text>
  <text x="215" y="97" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#141413">in agent's scope</text>
  <line x1="280" y1="85" x2="303" y2="85" stroke="#141413" stroke-width="1.2"/>
  <polygon points="303,81 310,85 303,89" fill="#141413"/>
  <rect x="310" y="55" width="130" height="60" rx="4" fill="#ffffff" stroke="#141413" stroke-width="1.5"/>
  <text x="375" y="81" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#141413">Destructive</text>
  <text x="375" y="97" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#141413">endpoint hit</text>
  <line x1="440" y1="85" x2="453" y2="85" stroke="#141413" stroke-width="1.2"/>
  <polygon points="453,81 460,85 453,89" fill="#141413"/>
  <rect x="460" y="55" width="120" height="60" rx="4" fill="#fafafa" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="520" y="81" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#6b7280" font-style="italic">no enforcement</text>
  <text x="520" y="95" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#6b7280" font-style="italic">layer</text>
  <line x1="580" y1="85" x2="593" y2="85" stroke="#141413" stroke-width="1.2"/>
  <polygon points="593,81 600,85 593,89" fill="#141413"/>
  <rect x="600" y="55" width="100" height="60" rx="4" fill="#fef2f2" stroke="#dc2626" stroke-width="1.5"/>
  <text x="650" y="81" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#dc2626" font-weight="600">Production</text>
  <text x="650" y="97" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#dc2626" font-weight="600">destroyed</text>
  <line x1="520" y1="115" x2="520" y2="135" stroke="#9ca3af" stroke-width="1" stroke-dasharray="2 2"/>
  <text x="520" y="150" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#374151" font-style="italic">where the runtime should have intercepted</text>
</svg>
<figcaption style="text-align:center;font-size:0.85rem;color:#6b7280;margin-top:0.75rem;font-style:italic;">The same shape across PocketOS, Replit, the drizzle-kit incident, and Anthropic's own internal cases.</figcaption>
</figure>

1. **An over-scoped credential, discovered laterally.** The PocketOS Railway token was in an unrelated file. The Claude Code drizzle case used a production database URL that should not have been visible to a coding agent. Anthropic's own incidents involved tokens that were resolvable from the agent's working environment. None of these credentials were intentionally exposed to the agent's destructive path. They were sitting nearby.

2. **A destructive verb available without out-of-band confirmation.** `drizzle-kit push --force`, Railway's DELETE endpoint, raw SQL through a connection string. Each of these tools was correctly designed: the `--force` flag exists for unattended CI use, the DELETE endpoint exists for legitimate ops workflows. They are safe when a human types them and unsafe when an agent generates them.

3. **The agent acting on stale or partial context.** PocketOS's agent interpreted a staging credential mismatch as a fixable problem. Replit's agent acted during a stated freeze. The Claude Code drizzle case happened because the agent could not distinguish the dev database from production. Generative models produce confident output even when their context is wrong. That is the point.

4. **No environment isolation.** Replit's dev and prod were sharing connection strings. Railway co-located volume backups inside the same blast radius as the volume itself. Many vibe-coded apps run with one database and one credential set across all environments, because that is the path of least resistance.

5. **System-prompt rules treated as advisory.** Jason Lemkin reported telling Replit's agent eleven times in all caps not to touch production. Anthropic acknowledges that even with explicit prompt-level instructions, models violate those instructions a measurable fraction of the time. A rule in a system prompt is a suggestion, not a constraint.

6. **No replayable forensic trail.** When something went wrong, the post-incident response leaned on the agent's own narration of what it did. That narration is the same model output that just deleted the database. It is not a reliable source.

This is not a list of bugs in particular models. It is the predictable outcome of letting any non-deterministic agent loose on production credentials with no enforcement layer between the model output and the destructive call.

---

## The model isn't the safety layer

The dominant industry response to these incidents has been "make the model better at refusing." Better system prompts, classifier guardrails, RLHF passes that emphasize destructive-action caution. These help. None of them are sufficient.

Anthropic's own [auto-mode disclosure](https://www.anthropic.com/engineering/claude-code-auto-mode) is the strongest possible statement of this. They built a dedicated safety classifier, trained specifically to gate dangerous Claude Code actions, and they openly publish that it has a meaningful false-negative rate. They tell their own users that this layer does not replace human review on high-stakes infrastructure.

If the company that builds the model says the model -- including a model trained to gate the model -- is not enough, the safety boundary has to live somewhere else.

It has to live in the runtime.

---

## Approval gates, by blast radius

The pattern that prevents these incidents is older than agents. Distributed systems have spent two decades on idempotency keys, durable execution logs, two-phase commits, and approval workflows for high-impact operations. None of this is new. Applying it to agent runtimes is.

The right mental model is a matrix: blast radius on one axis, reversibility on the other.

<figure style="max-width: 720px; margin: 2rem auto;">
<svg viewBox="0 0 720 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="d2-title" style="width:100%;height:auto;">
  <title id="d2-title">Blast radius and reversibility: how to gate destructive operations</title>
  <text x="255" y="32" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#141413">Reversible</text>
  <text x="565" y="32" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#141413">Irreversible</text>
  <line x1="100" y1="45" x2="720" y2="45" stroke="#141413" stroke-width="1.5"/>
  <line x1="410" y1="0" x2="410" y2="310" stroke="#141413" stroke-width="0.5"/>
  <text x="50" y="86" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="#141413">Read-only</text>
  <rect x="100" y="50" width="310" height="65" fill="#ecfdf5" stroke="none"/>
  <text x="255" y="88" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#065f46">Auto-execute</text>
  <rect x="410" y="50" width="310" height="65" fill="#f3f4f6" stroke="none"/>
  <text x="565" y="88" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#6b7280" font-style="italic">does not occur</text>
  <line x1="100" y1="115" x2="720" y2="115" stroke="#e5e7eb" stroke-width="1"/>
  <text x="50" y="151" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="#141413">Sandboxed</text>
  <rect x="100" y="115" width="310" height="65" fill="#ecfdf5" stroke="none"/>
  <text x="255" y="153" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#065f46">Auto-execute</text>
  <rect x="410" y="115" width="310" height="65" fill="#fffbeb" stroke="none"/>
  <text x="565" y="153" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#92400e">Checkpoint + auto-execute</text>
  <line x1="100" y1="180" x2="720" y2="180" stroke="#e5e7eb" stroke-width="1"/>
  <text x="50" y="216" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="#141413">Staging</text>
  <rect x="100" y="180" width="310" height="65" fill="#ecfdf5" stroke="none"/>
  <text x="255" y="218" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#065f46">Auto-execute</text>
  <rect x="410" y="180" width="310" height="65" fill="#fff7ed" stroke="none"/>
  <text x="565" y="218" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#9a3412">Typed approval gate</text>
  <line x1="100" y1="245" x2="720" y2="245" stroke="#e5e7eb" stroke-width="1"/>
  <text x="50" y="281" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="#141413">Production</text>
  <rect x="100" y="245" width="310" height="65" fill="#fff7ed" stroke="none"/>
  <text x="255" y="283" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#9a3412">Soft approval</text>
  <rect x="410" y="245" width="310" height="65" fill="#fef2f2" stroke="none"/>
  <text x="565" y="276" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="#991b1b">Hard approval</text>
  <text x="565" y="294" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#991b1b">+ audit + replay</text>
  <line x1="100" y1="310" x2="720" y2="310" stroke="#141413" stroke-width="1.5"/>
</svg>
<figcaption style="text-align:center;font-size:0.85rem;color:#6b7280;margin-top:0.75rem;font-style:italic;">The treatment for an action is a function of its blast radius and whether it can be undone.</figcaption>
</figure>

The principle is straightforward. Read-only operations and sandboxed writes do not need approval. Reversible production changes need a soft check. Irreversible production changes -- the ones that show up in postmortems -- require an out-of-band approval with a durable record of who approved what, when, and why.

The point is not to gate everything. Approval fatigue is the actual enemy. If every read of a config file requires a Slack approval, humans will rubber-stamp everything within a day, including the volume-delete call. The point is to classify by blast radius and gate accordingly.

In JamJet today, this lives at two levels.

The Rust workflow IR supports policy declarations on workflows, including a list of tool patterns that require approval before execution:

```yaml
workflow:
  id: claims-processing
  policy:
    blocked_tools:
      - "*delete*"
      - "payments.refund"
    require_approval_for:
      - "database.*"
      - "payment.transfer"
      - "user.suspend"
```

Pattern-matched tool gating is enforced inside the runtime, before the tool call leaves the agent's process. If the model emits a `database.drop_table` invocation, the runtime intercepts it, persists the execution state, and waits for an out-of-band approval decision. Crashes during the wait do not lose the approval; the execution resumes when the decision arrives.

<figure style="max-width: 720px; margin: 2rem auto;">
<svg viewBox="0 0 720 410" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="d3-title" style="width:100%;height:auto;">
  <title id="d3-title">Where the safety boundary lives in JamJet</title>
  <rect x="80" y="20" width="560" height="44" rx="3" fill="#ffffff" stroke="#141413" stroke-width="1"/>
  <text x="360" y="47" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="#141413">model.emit_tool_call("database.drop_table", { table: "users" })</text>
  <line x1="360" y1="64" x2="360" y2="80" stroke="#141413" stroke-width="1.2"/>
  <polygon points="356,80 360,88 364,80" fill="#141413"/>
  <rect x="40" y="95" width="640" height="270" rx="6" fill="#fafafa" stroke="#374151" stroke-width="1.5"/>
  <text x="60" y="115" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" font-weight="700" fill="#374151" letter-spacing="1.5">JAMJET RUNTIME BOUNDARY</text>
  <rect x="60" y="125" width="600" height="55" rx="3" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
  <text x="80" y="146" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="#92400e">1. Policy match</text>
  <text x="80" y="166" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" fill="#92400e">require_approval_for: ["database.*"]  →  match  →  suspend execution</text>
  <line x1="360" y1="180" x2="360" y2="195" stroke="#141413" stroke-width="1.2"/>
  <polygon points="356,195 360,203 364,195" fill="#141413"/>
  <rect x="60" y="208" width="600" height="55" rx="3" fill="#fef2f2" stroke="#dc2626" stroke-width="1.5"/>
  <text x="80" y="229" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="#991b1b">2. Approval gate (durable wait)</text>
  <text x="80" y="249" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#991b1b">execution state persisted · process can crash · resumes on approval</text>
  <line x1="360" y1="263" x2="360" y2="278" stroke="#141413" stroke-width="1.2"/>
  <polygon points="356,278 360,286 364,278" fill="#141413"/>
  <rect x="60" y="291" width="600" height="55" rx="3" fill="#f0f9ff" stroke="#0284c7" stroke-width="1.5"/>
  <text x="80" y="312" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="#075985">3. Checkpoint + tool dispatch</text>
  <text x="80" y="332" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" fill="#075985">replayOrExecute("drop_table", () -&gt; dialect.execute(sql))</text>
  <line x1="360" y1="365" x2="360" y2="381" stroke="#141413" stroke-width="1.2"/>
  <polygon points="356,381 360,389 364,381" fill="#141413"/>
  <rect x="80" y="376" width="560" height="28" rx="3" fill="#ffffff" stroke="#141413" stroke-width="1"/>
  <text x="360" y="395" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#141413">audit log entry · signed · append-only</text>
</svg>
<figcaption style="text-align:center;font-size:0.85rem;color:#6b7280;margin-top:0.75rem;font-style:italic;">The destructive call cannot reach the tool dispatch layer without crossing the policy and approval layers first.</figcaption>
</figure>

This is not a tier system. JamJet does not yet have first-class concepts of "tier 1 / tier 2 / tier 3 destructive." Those semantics are next on the policy roadmap. What exists today is the more general pattern-based primitive that those tier semantics will compile into.

---

## What this looks like in code

We use three primitives in production and want to show what they actually look like.

### Durable execution as the foundation

Without durable execution, none of the other primitives work. If the runtime cannot survive a process restart, then a crashed agent in the middle of a destructive workflow is in an undefined state. Recovery means re-running everything, which means the destructive call may fire twice.

In Java, the durability primitive is a checkpoint inside an annotated agent class:

```java
@DurableAgent("claims-processor")
public class ClaimsProcessor {

    @Checkpoint("fetch-claim")
    public Claim fetchClaim(String claimId) {
        return DurabilityContext.current().replayOrExecute("fetch-claim", () ->
            claimsApi.getClaim(claimId)
        );
    }

    @Checkpoint("score-fraud")
    public FraudScore scoreFraud(Claim claim) {
        return DurabilityContext.current().replayOrExecute("score-fraud", () ->
            llm.chatStructured(SYSTEM_PROMPT, claim, FraudScore.class)
        );
    }
}
```

The `@DurableAgent` and `@Checkpoint` annotations are real -- they live in `dev.jamjet.runtime.instrument.annotations` in the [JamJet Java runtime](https://github.com/jamjet-labs/jamjet-runtime-java). On a process crash mid-workflow, the next run replays the recorded checkpoints from the event log and skips them; only the un-recorded steps re-execute. The LLM call that already produced a fraud score is not re-paid for.

In Python:

```python
from jamjet.durable import durable, durable_run

@durable
def fetch_claim(claim_id: str) -> Claim:
    return claims_api.get(claim_id)

@durable
def score_fraud(claim: Claim) -> FraudScore:
    return llm.chat_structured(SYSTEM_PROMPT, claim, FraudScore)

with durable_run("claim-run-abc123"):
    claim = fetch_claim("c-91")
    score = score_fraud(claim)
```

The `@durable` decorator caches results against an idempotency key derived from the execution ID, function qualified name, and arguments. The `durable_run` context manager binds the execution ID to the surrounding scope using `contextvars`, which means it is async-safe.

Durability is the floor. Approvals and audit trails sit on top of it.

### Approval gates on destructive operations

In the Spring path, an approval gate is a context flag the caller sets before invoking the chat client:

```java
String response = chatClient.prompt(userRequest)
    .context(JamjetApprovalAdvisor.REQUIRES_APPROVAL_KEY, true)
    .call()
    .content();
```

When that flag is set, the `JamjetApprovalAdvisor` (auto-wired by the Spring Boot starter) intercepts the call, persists the execution state, and blocks until an approval decision arrives via the configured channel -- a webhook, a Slack interaction, the JamJet Cloud dashboard, or any other source that can post to `/jamjet/approvals/{executionId}`. The blocked execution is durable; if the JVM is killed mid-wait, the decision still resolves on restart.

This is intentionally a binary primitive. It does not classify the action's blast radius -- that is the job of the workflow's policy declaration. The advisor is the enforcement; the policy IR is the classifier.

### Audit trails that survive scrutiny

A logged action and an audited action are different things. Logs exist to debug a system; audits exist to prove what happened to a third party. The `audit-verify` CLI takes an exported audit bundle and verifies its signature against JamJet's published signing key, then optionally cross-checks that the same bundle hash appears in any secondary copy of the record:

```bash
jamjet-cloud audit-verify bundle.json \
  --metadata metadata.json \
  --pdf compliance-report.pdf \
  --siem-splunk audit-events.splunk.jsonl
```

If the PDF, Splunk export, or OTLP trace claims to be a record of the same execution but the bundle hash does not match, the verification fails. The point is forensic: an auditor showing up six months after an incident can verify that the audit bundle they were handed is the original, unmodified record, and that the SIEM event stream their security team has matches the runtime's view of what happened.

The verifier is shipped as both a CLI subcommand and a Python SDK function, so compliance pipelines can call it programmatically:

```python
from jamjet.cloud.audit_verify import verify_from_files

result = verify_from_files(
    Path("bundle.json"),
    Path("metadata.json"),
    pdf_path=Path("report.pdf"),
)

if not result.ok:
    raise ComplianceError(f"Audit bundle failed verification: {result.reason}")
```

### Recovery, in practice

The crash-recovery example in the Java runtime [examples directory](https://github.com/jamjet-labs/jamjet-runtime-java/tree/main/examples/crash-recovery) is intentionally blunt: a multi-step agent runs, completes two checkpoints, persists state, and `System.exit(1)`s. A second process loads the persisted state, re-creates the durability context in replay mode, and runs the same agent code. The recorded checkpoints return their stored values immediately; the un-recorded steps execute against live services. No LLM call is paid for twice. No tool call fires twice.

This is the property we want for any agent that touches production: the state of the world after a crash-and-restart is identical to the state of the world after an uninterrupted run.

---

## What we don't have yet

We want to be specific about gaps, because vague claims are worth less than honest ones.

A standalone replay CLI is not yet shipped. The SDK-level primitive (`DurabilityContext.replayOrExecute` in Java, the `@durable` decorator in Python) is what makes recovery work today, and the in-process replay is real. The dashboard "replay from step N" experience is on the roadmap and is partially built -- the Web Inspector frontend has the controls, but the corresponding HTTP endpoint in the runtime is not yet live on main. We will not pretend otherwise.

A formal blast-radius tier system is not yet a first-class concept. The pattern-matched approval policy described above is what is in the codebase today. Tier semantics ("tier 1 destructive requires two-person approval") are a natural compilation target for a future layer; they are not in 0.1.1.

A fork-from-step CLI is not on the immediate roadmap. The use case is real -- given a recorded execution, re-run from a particular step with mutated inputs to test counterfactuals -- but it is downstream of the replay CLI work.

These gaps are listed because the alternative is to gesture at capabilities that are not there. The credible position is that the core primitives -- durable execution, pattern-based approval gates, signed audit bundles -- are real and shipped, and the operator experience around them is being built in public.

---

## The position

The next "AI deleted the database" headline is being written somewhere right now. The model that fires the destructive call will be more capable than the one that fired PocketOS's. It will have a better safety classifier in front of it. It will probably refuse the obviously bad request that the previous generation did not.

It will still produce the wrong call sometimes, because that is what generative models do. The honest framing of AI agent risk in 2026 is structural, not behavioral: you cannot prompt your way out of a destructive tool call that nothing was watching for. The fix is not a smarter model. Anthropic itself just told us the model cannot be the safety layer. The fix is the architecture that distributed systems have used for the last two decades for any operation that cannot be safely retried: durable execution, idempotency keys, approval gates classified by blast radius, signed audit trails, forensic replay. None of this is novel. The novel part is putting it inside the runtime that agents already live in, instead of asking every team to rebuild it on top of a workflow engine.

We built JamJet because we kept seeing the same incident pattern with the same missing pieces. The runtime ships with durable execution, pattern-based approval gates, and an audit-verify pipeline today. The gaps -- replay CLI, formal tier classification, fork-from-step -- are the next thing we are building, in the open, with the same honesty about what is and is not done.

If you are evaluating agent infrastructure for a production deployment that touches destructive operations, the [related post on production governance and the EU AI Act](/blog/ai-agents-wont-survive-audit) covers the regulatory and audit dimension of the same problem.

---

## Frequently asked questions

### What was the "AI deleted the database" incident?

The phrase refers to a growing genre of production incidents where AI coding agents, given access to deployment credentials, delete or corrupt production data. The most cited cases include [Replit's July 2025 SaaStr database wipe](https://www.theregister.com/2025/07/21/replit_saastr_vibe_coding_incident/), the [PocketOS incident in April 2026](https://www.theregister.com/2026/04/27/cursoropus_agent_snuffs_out_pocketos/) where a Cursor agent destroyed a production database in nine seconds, and a [drizzle-kit `--force` incident](https://github.com/anthropics/claude-code/issues/27063) where a Claude Code agent dropped sixty-plus production tables.

### Why do AI agents delete production data?

Six structural failures recur across every documented incident: an over-scoped credential discovered laterally by the agent, a destructive verb available without out-of-band confirmation, the agent acting on stale or partial context, no environment isolation between dev and prod, system-prompt rules treated as advisory by the model, and no replayable forensic trail. The model is the trigger, but the runtime around it is what determines whether the destructive call lands.

### How do you prevent an AI agent from deleting your database?

Three runtime-level controls, in order. First, durable execution, so a destructive operation cannot fire twice on retry. Second, pattern-based approval gates that block destructive tool calls (`database.*`, `*delete*`, `payment.*`) until an out-of-band approval decision arrives. Third, signed, append-only audit trails that survive incident review. Better prompts and safety classifiers help, but Anthropic's [own auto-mode disclosure](https://www.anthropic.com/engineering/claude-code-auto-mode) documents a meaningful false-negative rate on classifier-gated dangerous actions.

### Is AI agent risk overstated?

The behavioral framing -- agents going rogue, agents lying -- is overstated and unhelpful. The structural framing is not. Generative models will produce confident wrong outputs, including wrong tool calls, for the foreseeable future. The relevant question is what the runtime around the model does when that happens. Production AI safety is a runtime architecture problem, not a model behavior problem.

### What is durable execution for AI agents?

Durable execution records every step of an agent's workflow to an event log. On a process crash, the agent restarts and replays the log, skipping completed steps and re-executing only what was interrupted. For agents touching production, this means destructive tool calls cannot fire twice, expensive LLM calls are not paid for twice, and post-incident review can reconstruct exactly what the agent saw and did. Temporal, Azure Durable Functions, AWS Step Functions all use this pattern; JamJet applies it to agent workflows specifically.

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What was the 'AI deleted the database' incident?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The phrase refers to a growing genre of production incidents where AI coding agents, given access to deployment credentials, delete or corrupt production data. The most cited cases include Replit's July 2025 SaaStr database wipe, the PocketOS incident in April 2026 where a Cursor agent destroyed a production database in nine seconds, and a drizzle-kit --force incident where a Claude Code agent dropped sixty-plus production tables."
      }
    },
    {
      "@type": "Question",
      "name": "Why do AI agents delete production data?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Six structural failures recur across every documented incident: an over-scoped credential discovered laterally by the agent, a destructive verb available without out-of-band confirmation, the agent acting on stale or partial context, no environment isolation between dev and prod, system-prompt rules treated as advisory by the model, and no replayable forensic trail. The model is the trigger, but the runtime around it is what determines whether the destructive call lands."
      }
    },
    {
      "@type": "Question",
      "name": "How do you prevent an AI agent from deleting your database?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Three runtime-level controls, in order. First, durable execution so a destructive operation cannot fire twice on retry. Second, pattern-based approval gates that block destructive tool calls until an out-of-band approval decision arrives. Third, signed, append-only audit trails that survive incident review. Better prompts and safety classifiers help, but Anthropic's own auto-mode disclosure documents a meaningful false-negative rate on classifier-gated dangerous actions."
      }
    },
    {
      "@type": "Question",
      "name": "Is AI agent risk overstated?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The behavioral framing -- agents going rogue, agents lying -- is overstated and unhelpful. The structural framing is not. Generative models will produce confident wrong outputs, including wrong tool calls, for the foreseeable future. The relevant question is what the runtime around the model does when that happens. Production AI safety is a runtime architecture problem, not a model behavior problem."
      }
    },
    {
      "@type": "Question",
      "name": "What is durable execution for AI agents?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Durable execution records every step of an agent's workflow to an event log. On a process crash, the agent restarts and replays the log, skipping completed steps and re-executing only what was interrupted. For agents touching production, this means destructive tool calls cannot fire twice, expensive LLM calls are not paid for twice, and post-incident review can reconstruct exactly what the agent saw and did."
      }
    }
  ]
}
</script>

---

*JamJet is open source under Apache 2.0 and available on [GitHub](https://github.com/jamjet-labs/jamjet). The [Java runtime quickstart](https://github.com/jamjet-labs/jamjet-runtime-java) covers durable execution and crash recovery in under fifteen minutes. The hosted control plane -- with approval workflows, signed audit bundles, and the Web Inspector for execution forensics -- is in early access at [JamJet Cloud](https://app.jamjet.dev).*
