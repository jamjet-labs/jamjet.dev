---
title: "Your AI Agents Won't Survive an Audit"
date: 2026-04-25
description: "89% of enterprise AI agents never reach production. The EU AI Act is enforceable in August. Here's what production safety actually requires — and why most agent frameworks aren't ready."
author: "Sunil Prakash"
category: "Enterprise & Governance"
---

# Your AI Agents Won't Survive an Audit

Eighty-nine percent of enterprise AI agent projects never make it to production. That number comes from the Stanford AI Index 2026 report, and it is worse than it sounds. It does not mean the agents do not work. It means organizations build agents that work in a demo, then discover they cannot deploy them because no one can answer the questions that production requires.

Gartner predicts that more than 40% of agentic AI projects started in 2025 will be canceled or scaled back by 2027, specifically due to inadequate risk controls. Not performance. Not cost. Risk controls.

The pattern is consistent. The agent itself is fine. The infrastructure around it — the part that makes it auditable, governable, and safe to operate — does not exist.

---

## The audit question

Imagine you run an insurance claims processing agent. It handles thousands of claims per day. It is fast, accurate on benchmarks, and your team is proud of it.

Then it approves a $50,000 payout on a fraudulent claim. Or it denies a legitimate claim and the customer sues. Or it leaks a claimant's medical records into a log file that three vendors have access to.

Now someone asks you these questions:

- What exactly did the agent see, decide, and do — step by step?
- Can you replay the exact execution that led to this decision?
- Were the guardrails in place at the time, or had someone disabled them?
- Did a human have the opportunity to review this before it was finalized?
- How long has this data been retained, and who has accessed it?

If you cannot answer all five with evidence — not with "we think so" or "it should have" but with immutable records — you have a problem. And starting in August, for certain categories of AI systems in the EU, that problem has legal teeth.

---

## The EU AI Act: what actually matters for agent builders

The EU AI Act becomes fully enforceable on August 2, 2026. It is the first comprehensive AI regulation with real penalties — up to 7% of global annual turnover for the most serious violations.

A few things worth understanding clearly, without overclaiming.

The Act classifies AI systems into risk categories. High-risk systems — which include AI used in employment decisions, credit scoring, insurance underwriting, law enforcement, and critical infrastructure — face the strictest requirements. If your agent makes or materially influences decisions in these domains, the high-risk provisions likely apply.

For high-risk AI systems, the Act mandates:

- **Automatic logging** of AI system operations, sufficient to trace decisions back to inputs and identify risks. Logs must be immutable and retained for periods appropriate to the system's purpose.
- **Human oversight capability** — the ability for a human to understand, monitor, and intervene in the system's operation. Not just a dashboard. The ability to override or halt.
- **Transparency and explainability** — the deployer must be able to explain how the system reaches its decisions, in terms the affected person can understand.
- **Data governance** — tracking data lineage, ensuring training and operational data quality, and maintaining records of what data influenced which decisions.
- **Technical documentation** — detailed records of the system's design, development, testing, and operational characteristics.

A critical caveat: full compliance requires organizational measures, risk management processes, and legal analysis that go far beyond tooling. A framework cannot make you compliant. But the technical infrastructure — the logging, the audit trails, the oversight mechanisms — must exist before the organizational measures have anything to sit on top of.

If you are building agents that operate in high-risk domains and deploying to users in the EU, the time to figure out your technical compliance story is not August. It was months ago.

---

## The six things production safety actually requires

Compliance is one driver. But even if you operate entirely outside the EU, these are the capabilities that separate production-grade agent infrastructure from a prototype.

### 1. Policy enforcement — not just logging

Most frameworks offer observability. You can see what the agent did after the fact. That is necessary but not sufficient.

Policy enforcement means the runtime blocks unauthorized actions before they execute. If an agent tries to call a tool it is not authorized to use, the call is rejected — not logged for later review. If an agent attempts to send data to an external endpoint not on the allowlist, the request never leaves the system.

The difference matters. Logging tells you about the breach after it happens. Enforcement prevents the breach. In regulated industries, "we detected it in the logs" is not an acceptable answer. "The runtime prevented it" is.

### 2. Audit trails — separate, append-only, retention-aware

An audit trail is not the same as execution logs. Execution logs exist to debug the system. Audit trails exist to prove to a third party — a regulator, an auditor, a court — what the system did and why.

This means audit trails must be append-only. No one should be able to modify or delete audit entries, including system administrators. They must be separate from execution data so that log rotation, storage optimization, or system migrations do not accidentally destroy compliance records. And they must be retention-aware — some regulations require 7-year retention, others require deletion after a specific period. The audit system needs to handle both.

If your audit trail is just your application logs in a different format, it will not survive scrutiny.

### 3. Human-in-the-loop — durable pause/resume, not callbacks

Human approval in most agent frameworks means a callback. The agent reaches a decision point, fires a webhook, and waits for a response. If the process crashes while waiting, the approval state is lost. If the approver takes three days to respond, the execution times out or the connection drops.

Real human-in-the-loop requires durable pause and resume. The agent's execution state is persisted to disk. The process can crash, restart, or be migrated to a different server. The approval request survives indefinitely. When the human finally approves — whether that is in 30 seconds or 30 days — the agent resumes from exactly where it stopped.

This is particularly important for high-stakes decisions. An insurance claims agent that needs human review on claims above $10,000 cannot afford to lose the approval state because a container was rescheduled.

### 4. Crash recovery — event-sourced, checkpoint-based

Agent workflows fail. Processes crash. Servers restart. Network calls time out. The question is not whether failures happen. It is what happens next.

Without crash recovery, a failure at step 7 of a 10-step workflow means starting over from step 1. If steps 1 through 6 involved expensive LLM calls, external API interactions, or time-sensitive operations, restarting from scratch is not just wasteful — it can produce different results, creating consistency problems.

Event-sourced execution with checkpoints means every state transition is recorded. When the process restarts, it replays the event log to reconstruct the exact state at the point of failure and resumes from there. No repeated LLM calls. No inconsistent state. No lost work.

This is table stakes in traditional distributed systems (Temporal, Azure Durable Functions, AWS Step Functions all do this). It is conspicuously absent from most AI agent frameworks.

### 5. Cost governance — per-agent budgets enforced by runtime

A single agent with a coding error or an unexpected loop can burn through thousands of dollars in API calls in minutes. Deloitte's 2026 enterprise AI survey found that cost overruns are the second most cited reason for agent project cancellations, behind only risk concerns.

Cost governance means per-agent and per-workflow budget limits enforced by the runtime — not monitored after the fact, but enforced in real time. When an agent hits its token budget, the runtime halts execution and surfaces the event. No more "we noticed the $12,000 bill on Monday morning."

### 6. Agent memory governance — accurate context, conflict detection

Agents that maintain long-term memory introduce a class of problems that stateless agents do not have. Memories can become stale. Contradictory facts can accumulate. An agent can confidently act on outdated information because its memory says a customer's address is X when they updated it to Y three weeks ago.

Memory governance means the system tracks when facts were recorded, detects conflicts between stored memories, and provides mechanisms to audit what the agent believed at the time it made a decision. If a customer disputes an agent's action, you need to reconstruct not just what the agent did, but what it thought it knew.

---

## Where current tools fall short

I want to be specific here, because vague claims about competitors help no one.

**LangGraph** is strong orchestration with a large ecosystem. But durability is opt-in via checkpointers, not a default. There is no policy enforcement engine — LangSmith provides excellent observability, but observability is not enforcement. There is no built-in audit trail separate from execution logs, no retention management, and no cost governance at the runtime level. LangGraph is a good tool for building agents. It is not a governance platform.

**Temporal** is arguably the best durable execution engine available. If your only concern is crash recovery and workflow reliability, Temporal is battle-tested and production-proven. But Temporal is a general-purpose workflow engine, not an agent runtime. It has no concept of agent policies, no memory system, no protocol support for MCP or A2A, and no human-in-the-loop as a built-in primitive. You can build all of these on top of Temporal. Many teams do. But you are building them yourself, and that is a significant engineering investment.

**Cloud provider platforms** — Google Vertex AI Agent Builder, AWS Bedrock Agents, Microsoft Azure AI Agent Service — provide strong governance stories with IAM integration, logging, and compliance tooling. The tradeoff is platform lock-in. Your agent's governance infrastructure is inseparable from the cloud provider's stack. If you need to run on-premises, multi-cloud, or at the edge, these are not viable options. For teams already committed to a single cloud, they are reasonable choices.

**CrewAI and AutoGen** are excellent for prototyping and research. Neither has durable execution, policy enforcement, audit trails, cost governance, or memory governance. They are not designed for this — they are designed for fast iteration and experimentation, and they do that well. But deploying agents built on these frameworks into regulated production environments requires building every governance layer yourself.

This is not a criticism of these tools. They are solving different problems. The issue is that teams use them to build agents, the agents work, and then the governance question arrives — and the framework has no answer.

---

## How JamJet approaches this

I built JamJet specifically because this gap frustrated me. I will explain the technical approach, not pitch it. JamJet is early-stage — pre-revenue, small community. But the architecture was designed around these problems from day one.

**Policy engine with a 4-level hierarchy.** Policies are defined at global, tenant, workflow, and node levels. A global policy might say "never allow file system writes." A workflow-level policy might say "this claims agent can only call the claims API and the fraud detection API." Policies compose and the most restrictive wins. Enforcement happens in the Rust runtime before tool calls execute — not after.

**Separate append-only audit log.** Audit entries are written to a dedicated store, separate from execution state. The audit log is append-only — the runtime does not expose update or delete operations on audit records. Retention policies are configurable per workflow, and automatic purge runs on schedule. PII redaction is applied before audit entries are written, so sensitive data never reaches the compliance record.

**Human-in-the-loop as a durable primitive.** When an agent reaches an approval point, the runtime persists the full execution state and creates an approval request. The agent process can crash, the server can restart, and the approval survives. Approvals support timeouts, escalation chains, and multiple approvers. The entire mechanism is event-sourced — you can audit who approved what and when.

**Event-sourced execution with checkpoint replay.** Every state transition is persisted as an event. Crash recovery reconstructs state from the event log. Replay is deterministic — you can take any production execution and replay it locally for debugging. This is the same pattern used by Temporal and Azure Durable Functions, applied to agent workflows with agent-native extensions.

**Engram memory with conflict detection.** JamJet's memory system (Engram) tracks memory provenance — when a fact was recorded, from what source, with what confidence. When contradictory facts are detected, the system surfaces the conflict rather than silently using stale data. Memory is queryable and auditable, so you can reconstruct what the agent believed at any point in time.

**Open source, cloud-agnostic, protocol-native.** The runtime is Apache 2.0 licensed. It runs anywhere — cloud, on-premises, edge. MCP and A2A are built into the runtime, not adapted on top. There is no lock-in to a specific cloud provider, model provider, or platform.

I want to be transparent about the tradeoffs. JamJet is a Rust runtime with Python and Java SDKs. The community is small. There are fewer integrations than LangChain. If you need a framework with a large ecosystem and extensive third-party support today, JamJet is probably not the right choice yet. The bet is that governance infrastructure will matter more than ecosystem breadth as agents move into production — but that is a bet, not a certainty.

---

## The question that matters

The question for 2026 is not whether you can build an AI agent. Anyone can build an AI agent. The frameworks are mature, the models are capable, and the demos are impressive.

The question is whether you can prove your agent is safe to run.

Can you prove to an auditor what it did and why? Can you prove the guardrails were in place? Can you prove a human had oversight? Can you prove sensitive data was handled correctly? Can you prove it recovered correctly after a failure?

If you cannot answer these questions with evidence, you have a demo. Not a production system.

The EU AI Act is one forcing function. But even without regulation, the economics push in the same direction. Gartner's 40% cancellation prediction is not about regulation — it is about organizations realizing that agents without governance create more risk than value. Stanford's 89% figure is not about technology — it is about the gap between what agents can do and what organizations can safely let them do.

Closing that gap is an infrastructure problem. And like most infrastructure problems, it is easier to solve before the crisis than after.

---

*JamJet is open source and available on [GitHub](https://github.com/jamjet-labs/jamjet). If you are evaluating agent frameworks for production use, the [quickstart guide](https://docs.jamjet.dev/en/docs/quickstart) walks through durable execution, policy enforcement, and audit trails in under 15 minutes.*
