---
title: "Google ADK vs JamJet: Building a Claims Processing Agent"
date: 2026-04-15
description: "We built the same insurance claims agent in both frameworks. One crashes and loses everything. The other picks up exactly where it left off."
author: "Sunil Prakash"
category: "Architecture & Deep Dives"
---

# Google ADK vs JamJet: Building a Claims Processing Agent

Google ADK and JamJet both build AI agents. But they make fundamentally different bets about what matters in production. ADK bets on tight Gemini integration, composable agent primitives, and the Google Cloud deployment story. JamJet bets on durable execution, structured audit trails, and the assumption that your agent will crash at the worst possible time.

We built the same insurance claims processing agent in both frameworks to find out where those bets pay off and where they fall short.

The verdict is not "one is better." It is "they are built for different failure modes." If your biggest risk is development speed, ADK wins. If your biggest risk is a 2 AM crash that loses four expensive LLM calls and leaves no audit trail, JamJet wins. Most production systems eventually face both.

---

## The use case

An insurance claims processing agent. Seven steps, each with real costs and real consequences:

1. **Intake** -- receive a claim with photos and a description
2. **Document analysis** -- use a vision model to analyze damage photos
3. **Policy lookup** -- query a database for the customer's coverage
4. **Damage assessment** -- LLM estimates repair cost from the analysis and policy terms
5. **Fraud check** -- cross-reference claim history, flag anomalies
6. **Human approval** -- route high-value claims (>$10K) to a human adjuster
7. **Resolution** -- generate the decision letter and payment authorization

Why insurance? Because it has every production requirement at once. Steps 2 through 5 each cost real money -- LLM calls, vision API calls, database queries. If the process crashes at step 5, you have wasted four expensive steps. Regulators require a complete audit trail of every decision. Human-in-the-loop is mandatory for high-value claims. And quality matters -- a wrong decision is a lawsuit.

If your framework can handle this, it can handle anything.

---

## The ADK version

Here is the claims agent in Google ADK, using their real API:

```python
from google.adk.agents import LlmAgent, SequentialAgent, ParallelAgent
from google.adk.tools import FunctionTool, ToolContext

# Tool definitions -- plain Python functions
def analyze_photos(claim_id: str, photo_urls: list[str]) -> dict:
    """Analyzes damage photos using vision model."""
    # Calls a vision API, returns structured damage report
    return {"damage_type": "hail", "severity": "moderate", "affected_areas": ["roof", "siding"]}

def lookup_policy(customer_id: str) -> dict:
    """Retrieves policy details from database."""
    return {"coverage_limit": 150000, "deductible": 1000, "exclusions": ["flood"]}

def estimate_repair_cost(damage_report: str, policy: str) -> dict:
    """Estimates repair cost based on damage and policy."""
    return {"estimated_cost": 12400, "line_items": ["roof: $8200", "siding: $4200"]}

def check_fraud(claim_id: str, tool_context: ToolContext) -> dict:
    """Cross-references claim history for anomalies."""
    history = tool_context.state.get("claim_history", [])
    return {"risk_score": 0.12, "flags": [], "recommendation": "proceed"}

# Agent definitions
intake_agent = LlmAgent(
    name="intake",
    model="gemini-2.5-flash",
    instruction="Extract claim details from the submission. Analyze the attached photos using the analyze_photos tool. Store structured results.",
    tools=[analyze_photos],
    output_key="claim_analysis",
)

assessment_agent = LlmAgent(
    name="assessment",
    model="gemini-2.5-pro",
    instruction="""Based on the claim analysis in state key 'claim_analysis',
    look up the customer's policy and estimate repair costs.
    Then run a fraud check on the claim.""",
    tools=[lookup_policy, estimate_repair_cost, check_fraud],
    output_key="assessment",
)

resolution_agent = LlmAgent(
    name="resolution",
    model="gemini-2.5-flash",
    instruction="""Generate a decision letter based on the assessment in state key 'assessment'.
    Include: claim decision, approved amount, deductible, payment timeline.""",
    output_key="decision",
)

pipeline = SequentialAgent(
    name="claims_processor",
    sub_agents=[intake_agent, assessment_agent, resolution_agent],
)
```

This is clean. ADK's composable agent primitives -- `SequentialAgent`, `LlmAgent`, `FunctionTool` -- give you a working pipeline quickly. Tool definitions are plain Python functions. State passes between agents via `output_key`. The code reads well.

But look at what is missing. There is no crash recovery. No audit trail. No human approval step for the $12,400 claim that just exceeded our $10K threshold. No cost tracking. No quality evaluation of the decision letter.

The agent works on the happy path. Production is not the happy path.

---

## What happens when things go wrong

### The 2 AM crash

Your claims processing service crashes at step 5 -- the fraud check. Maybe the database connection dropped. Maybe the host ran out of memory. It does not matter why. What matters is what happens next.

**With ADK:** The default `InMemorySessionService` loses everything. The session state, the photo analysis results, the policy lookup, the damage assessment -- gone. Even if you upgrade to `DatabaseSessionService`, you preserve conversation history, but there is no mechanism to resume the workflow from step 5. `SequentialAgent` does not checkpoint between sub-agents. You re-run from step 1, re-paying for the vision API call on the photos (~$0.08), the policy lookup, and the damage assessment LLM call. For one claim, that is annoying. At 200 claims per day with a weekly crash, you are burning roughly $1,500 per year on re-execution alone.

**With JamJet:** Event sourcing recorded every state transition. On restart, the runtime replays the results of steps 1 through 4 from the event store -- instantly, with no LLM calls, no API calls, no cost. Then it resumes execution at step 5, the fraud check. Zero wasted compute. Zero lost work.

### The audit question

A state insurance regulator asks: "Show me every decision this agent made on claim #4821, including the exact prompts, model responses, and tool calls."

**With ADK:** You hope your application logging is comprehensive enough. ADK does not produce a structured execution trace by default. The ADK Web UI captures interactions during development and can record golden test datasets, but in production you need to build your own instrumentation layer -- intercepting tool calls, logging model responses, correlating everything with the claim ID.

**With JamJet:** `jamjet inspect exec_claims_4821 --events` returns the complete timeline: every node execution with timestamps, every LLM call with the exact prompt and response plus token counts, every tool invocation with inputs and outputs, every state transition with before/after diffs. This is the default behavior, not an add-on. The event store is the audit trail.

### The human approval gap

Claim #4821 comes back with an estimated cost of $47,000. Company policy requires a human adjuster to review any claim above $10,000.

**With ADK:** There is `tool_context.actions.transfer_to_agent` for agent-to-agent delegation, and you can build a tool that sends a request to an external approval system. But there is no built-in "pause the workflow, persist its state, wait for a human decision, and resume when the decision arrives" primitive. You build this yourself -- typically with a database flag, a polling loop or webhook, and careful state reconstruction. And that polling mechanism needs to survive process restarts, which means more infrastructure. ADK's A2A human-in-the-loop sample shows the pattern, but it requires a separate remote agent and significant orchestration code.

**With JamJet:** `type: wait` is a workflow node. The execution pauses, its full state persists to the event store, and the runtime resumes when the human approves via API. The pause survives process restarts, deployments, even server migrations. No polling. No external queue. No custom infrastructure.

```bash
# The workflow paused at the approval gate. Days later:
jamjet approve exec_claims_4821 --decision approved --reviewer "Jane Park, Senior Adjuster"
# Execution resumes at the resolution step.
```

---

## The JamJet version

Here is the same claims agent in JamJet. The YAML workflow defines the execution graph; the Python code submits it.

```yaml
id: claims-processor
version: "0.1.0"

nodes:
  intake:
    type: model
    model: claude-sonnet-4-6
    prompt: |
      Extract structured claim details from this submission:
      {{ state.submission }}
      
      Return: claim type, damage description, location, date of loss.
    output_key: claim_analysis
    next: parallel_lookup

  parallel_lookup:
    type: parallel
    branches:
      - photo_analysis
      - policy_lookup
    next: assessment

  photo_analysis:
    type: tool
    server: vision-tools
    tool: analyze_damage_photos
    arguments:
      urls: "{{ state.photo_urls }}"
    output_key: damage_report
    retry:
      max_attempts: 3
      backoff: exponential

  policy_lookup:
    type: tool
    server: insurance-db
    tool: get_policy
    arguments:
      customer_id: "{{ state.customer_id }}"
    output_key: policy

  assessment:
    type: model
    model: claude-sonnet-4-6
    prompt: |
      Estimate repair cost based on:
      Damage report: {{ state.damage_report }}
      Policy coverage: {{ state.policy }}
      Claim analysis: {{ state.claim_analysis }}
      
      Return: estimated total cost, line items, coverage determination.
    output_key: assessment
    next: fraud_check

  fraud_check:
    type: tool
    server: fraud-detection
    tool: check_claim_history
    arguments:
      claim_id: "{{ state.claim_id }}"
      customer_id: "{{ state.customer_id }}"
    output_key: fraud_result
    next: approval_gate

  approval_gate:
    type: condition
    expression: "state.assessment.estimated_cost > 10000"
    if_true: human_review
    if_false: resolution

  human_review:
    type: wait
    prompt: "Claim {{ state.claim_id }}: ${{ state.assessment.estimated_cost }} estimated. Fraud score: {{ state.fraud_result.risk_score }}. Approve?"
    next: resolution

  resolution:
    type: model
    model: claude-sonnet-4-6
    prompt: |
      Generate a formal decision letter for claim {{ state.claim_id }}.
      Assessment: {{ state.assessment }}
      Fraud check: {{ state.fraud_result }}
      Policy: {{ state.policy }}
      
      Include: claim decision, approved amount, deductible applied,
      payment timeline, and appeal instructions.
    output_key: decision
    next: evaluate

  evaluate:
    type: eval
    scorers:
      - type: assertion
        check: "len(state.decision) > 100"
      - type: llm_judge
        model: claude-haiku-4-5-20251001
        rubric: |
          Is this decision letter professional, complete, and consistent
          with the damage assessment and policy terms? Does it include
          all required elements: decision, amount, deductible, timeline,
          and appeal instructions?
    fail_under: 4.0
```

And the Python runner:

```python
from jamjet import JamJetClient

client = JamJetClient()
result = await client.run("claims-processor", input={
    "claim_id": "CLM-4821",
    "customer_id": "CUST-1092",
    "submission": "Hail damage to roof and north-facing siding. Storm date: March 12. Multiple shingles missing, two downspouts detached.",
    "photo_urls": [
        "s3://claims/4821/roof-overview.jpg",
        "s3://claims/4821/shingle-detail.jpg",
        "s3://claims/4821/siding-damage.jpg",
    ],
})

# Full execution trace -- every step, every cost
for event in result.events:
    print(f"{event.node}: {event.duration_ms}ms, {event.tokens} tokens, ${event.cost:.4f}")

# intake:         1840ms, 1,247 tokens, $0.0094
# photo_analysis:  920ms,     0 tokens, $0.0800  (vision API)
# policy_lookup:   145ms,     0 tokens, $0.0000
# assessment:     2100ms, 2,891 tokens, $0.0217
# fraud_check:     310ms,     0 tokens, $0.0010
# human_review:  PAUSED  (waiting for approval)
# resolution:     1950ms, 3,102 tokens, $0.0233
# evaluate:        680ms,   412 tokens, $0.0025
# ─────────────────────────────────────────
# Total: $0.1379, 7,652 tokens, 7.95s active
```

A few things to notice:

**Parallel branches.** Photo analysis and policy lookup run concurrently. In ADK, you would use a `ParallelAgent` with two sub-agents -- similar concept, different syntax.

**Retry with backoff.** The photo analysis node has `retry: max_attempts: 3, backoff: exponential`. Vision APIs are flaky. This is declarative, not a try/except loop.

**Conditional routing.** `approval_gate` checks the estimated cost. Claims under $10K skip straight to resolution. Claims over $10K pause for human review. This is a workflow node, not an if-statement buried in a tool function.

**Quality gate.** The `evaluate` node at the end scores the decision letter. If the LLM judge scores it below 4.0, the workflow can route to a retry or escalation. In CI, `--fail-under 4.0` catches quality regressions before deployment.

**Per-step cost attribution.** Every event carries token count and dollar cost. You know exactly which step is expensive and where to optimize. This is not logging you build -- it is the execution model.

---

## The numbers

| Scenario | ADK | JamJet |
|----------|-----|--------|
| Process crash at step 5 | Re-run from step 1 (~$0.11 wasted) | Resume from step 5 ($0.00 wasted) |
| 200 claims/day, weekly crash | ~$1,150/year in re-execution | $0 in re-execution |
| Regulator requests audit for claim #4821 | Grep through application logs | `jamjet inspect exec_claims_4821 --events` |
| Human approval for $47K claim | Custom DB flag + polling + state reconstruction | `type: wait` (built-in, durable, survives restarts) |
| Quality regression in decision letters | Manual review or external test suite | `type: eval` with `fail_under: 4.0` in the workflow |
| Per-step cost visibility | Build your own instrumentation | `result.events` -- per-node tokens, duration, cost |
| Time to first working prototype | Faster (fewer concepts upfront) | Slightly longer (more concepts, more guarantees) |

---

## Where ADK wins

Being honest about this makes the comparison useful.

**Gemini integration.** If you are building on Gemini, ADK's native features are hard to match. Built-in code execution lets the agent write and run Python in a sandbox. Google Search grounding gives model responses verifiable sources. Vertex AI deployment gives you managed infrastructure with Google's SLA. These are not things you bolt on -- they are first-class features of the platform.

**A2A protocol.** Google co-developed the Agent-to-Agent protocol. ADK's A2A support is mature, with both client and server implementations and a clean integration story. The human-in-the-loop A2A sample demonstrates cross-agent approval workflows, and it works.

**ADK Web UI.** The built-in development interface is polished. It captures agent interactions, lets you step through execution, inspect tool calls and state changes, and record conversations as golden test datasets. For debugging during development, it is genuinely good.

**Composable primitives.** `SequentialAgent`, `ParallelAgent`, `LoopAgent` -- these are clean, intuitive building blocks. You compose complex workflows from simple, well-named components. The mental model is immediately clear: agents are the unit of composition.

**Ecosystem breadth.** ADK supports LangChain tools, CrewAI tools, MCP servers, and custom function tools out of the box. If you have existing tool implementations in another framework, the migration path is straightforward.

**Speed to prototype.** Fewer concepts to learn upfront. Define agents, give them tools, compose them. You can have a working multi-agent system in under an hour. ADK optimizes for time-to-first-result.

---

## Where JamJet wins

**Durable execution is the default.** Every workflow execution is event-sourced. Every node checkpoint is persisted before execution begins. Crash recovery is not a feature you enable or a service you integrate -- it is the execution model. There is no "in-memory mode" that silently loses your state.

**Replay and fork.** Debug production issues by replaying the exact execution locally, with the exact inputs, state, and model responses. Fork from any checkpoint to test "what if" scenarios. `jamjet replay exec_claims_4821` reproduces the full run. `jamjet fork exec_claims_4821 --from fraud_check` creates a new execution starting from that node's state.

**Human-in-the-loop as a primitive.** `type: wait` is a first-class workflow node. The execution pauses, persists, and resumes when the human decides. It survives process restarts, deployments, server migrations. No polling, no external queue, no custom database flags.

**Structured audit trail.** Every execution produces a complete, queryable event log: node transitions, LLM prompts and responses with token counts, tool invocations with inputs and outputs, state diffs, timing, cost. This is not logging you add -- it is the execution record. For regulated industries, this is the difference between "we think the agent did X" and "here is exactly what the agent did, timestamped and immutable."

**Eval harness in the workflow.** Quality gates are workflow nodes, not a separate test framework. LLM judge scoring, assertion checks, and custom scorer plugins run as part of execution. Route based on quality: retry if the score is low, escalate if the scorer flags an issue, block deployment if `fail_under` is not met.

**Model-agnostic.** No primary model preference. The claims agent above uses Claude, but you can use GPT-4o, Gemini, Llama, Mistral, or any OpenAI-compatible API. Swap the `model` field in YAML -- no code changes. ADK works with non-Gemini models through LiteLLM, but Gemini is the first-class citizen.

**Per-step cost tracking.** Every node in the execution records tokens consumed and dollar cost. You know that photo analysis is your most expensive step, not because you instrumented it, but because the runtime tracks it automatically.

**JVM support for enterprise teams.** Java SDK plus a Spring Boot starter with auto-configuration, Micrometer metrics, OpenTelemetry spans, and JUnit 5 replay testing. If your backend is Java and your ML team is Python, both author agents that compile to the same IR and run on the same runtime.

---

## How to decide

There is no universal answer. The right choice depends on your constraints.

**Building on Google Cloud with Gemini?** ADK is the natural choice. Native Vertex AI deployment, Google Search grounding, built-in code execution -- you get capabilities that require significant integration work in any other framework.

**Need crash recovery and audit trails?** JamJet. Durable execution and structured event logs are the core of the runtime, not features you add later.

**Enterprise Java team?** JamJet. Spring Boot starter, Maven Central artifacts, Micrometer and OpenTelemetry integration. ADK is Python-first (with a Go SDK in development).

**Need human-in-the-loop that survives restarts?** JamJet. `type: wait` is a durable primitive. In ADK, you build this yourself.

**Want the fastest path to a working agent?** ADK. Fewer concepts, faster iteration, excellent developer tooling with the Web UI.

**Need reproducible experiments and eval?** JamJet. Replay testing, execution forking, and quality gates are built into the workflow model.

**Multi-model workflows?** JamJet. Use Claude for reasoning, Gemini for code generation, and a local Llama for classification -- in the same workflow, declared in YAML. ADK can do this through LiteLLM, but the ergonomics favor Gemini.

**Regulated industry with compliance requirements?** JamJet. The structured event log is an audit trail by default. In ADK, you build your own compliance layer.

---

## The real difference

Both frameworks build agents. Both have tools, state management, and multi-agent composition. The architectural difference is what each framework considers a first-class concern.

ADK treats agent composition and model integration as first-class concerns. It gives you elegant primitives for building agent topologies and tight integration with the Gemini ecosystem. It optimizes for the path from idea to working prototype.

JamJet treats durability, observability, and operational safety as first-class concerns. It gives you crash recovery, audit trails, human approval gates, and quality evaluation as built-in workflow primitives. It optimizes for the path from prototype to production.

Both are good frameworks. They just make different promises about what happens after the demo.

Try the claims processing example: [github.com/jamjet-labs/jamjet/examples/claims-processing](https://github.com/jamjet-labs/jamjet/examples/claims-processing)
