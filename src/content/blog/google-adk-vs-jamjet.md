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

Here is the same claims agent in JamJet's native Python SDK. Four specialist agents, typed Pydantic state, and a workflow that compiles to durable IR.

```python
from pydantic import BaseModel
from jamjet import Agent, Workflow, tool

# Tools -- structured capabilities
@tool
def analyze_photos(photo_urls: list[str]) -> dict:
    """Analyze damage photos using a vision model."""
    return {"damage_type": "hail", "severity": 7, "affected_areas": ["roof", "gutter"]}

@tool
def lookup_policy(customer_id: str) -> dict:
    """Retrieve the customer's insurance policy."""
    return {"coverage_limit": 150_000, "deductible": 1_000, "covered_perils": ["hail"]}

@tool
def check_fraud(claim_id: str, customer_id: str) -> dict:
    """Cross-reference claim history for anomalies."""
    return {"risk_score": 0.12, "flags": [], "recommendation": "proceed"}

# Agents -- each with a role, strategy, and tools
intake_agent = Agent(
    name="intake_specialist",
    model="claude-sonnet-4-6",
    tools=[analyze_photos],
    instructions="You are a claims intake specialist. Extract damage details and analyze photos.",
    strategy="react",
    max_iterations=3,
)

damage_assessor = Agent(
    name="damage_assessor",
    model="claude-sonnet-4-6",
    tools=[lookup_policy],
    instructions="Estimate repair cost against policy terms. Be specific with dollar amounts.",
    strategy="plan-and-execute",
    max_iterations=5,
)

fraud_analyst = Agent(
    name="fraud_analyst",
    model="claude-haiku-4-5-20251001",
    tools=[check_fraud],
    instructions="Run fraud checks. Provide clear proceed/flag/reject recommendation.",
    strategy="react",
    max_iterations=2,
)

resolution_writer = Agent(
    name="resolution_writer",
    model="claude-sonnet-4-6",
    instructions="Write a professional decision letter with amounts, conditions, and next steps.",
    strategy="critic",
    max_iterations=3,
)

# Typed state -- validated at every step
workflow = Workflow("claims_processor", version="0.1.0")

@workflow.state
class ClaimsState(BaseModel):
    claim_id: str
    customer_id: str
    submission: str
    photo_urls: list[str]
    claim_analysis: str | None = None
    assessment: str | None = None
    fraud_result: str | None = None
    decision: str | None = None

# Workflow steps -- each runs an agent and updates state
@workflow.step
async def intake(state: ClaimsState) -> ClaimsState:
    result = await intake_agent.run(f"Process claim {state.claim_id}: {state.submission}")
    return state.model_copy(update={"claim_analysis": result.output})

@workflow.step(parallel=["analyze_photos_step", "lookup_policy_step"])
async def parallel_lookup(state: ClaimsState) -> ClaimsState:
    return state  # branches run concurrently

@workflow.step
async def assess_damage(state: ClaimsState) -> ClaimsState:
    result = await damage_assessor.run(f"Assess claim {state.claim_id}:\n{state.claim_analysis}")
    return state.model_copy(update={"assessment": result.output})

@workflow.step
async def check_fraud_step(state: ClaimsState) -> ClaimsState:
    result = await fraud_analyst.run(f"Check fraud for {state.claim_id}")
    return state.model_copy(update={"fraud_result": result.output})

@workflow.step(human_approval=True)  # Pauses here. Survives restarts.
async def approve_claim(state: ClaimsState) -> ClaimsState:
    return state

@workflow.step
async def resolve(state: ClaimsState) -> ClaimsState:
    result = await resolution_writer.run(
        f"Write decision for {state.claim_id}:\n{state.assessment}\n{state.fraud_result}"
    )
    return state.model_copy(update={"decision": result.output})
```

Run it:

```python
result = await workflow.run(ClaimsState(
    claim_id="CLM-4821",
    customer_id="CUST-1092",
    submission="Hail damage to roof, multiple shingles missing...",
    photo_urls=["s3://claims/4821/roof.jpg", "s3://claims/4821/gutter.jpg"],
))

# Per-step trace -- every step, every cost
for event in result.events:
    print(f"{event.node}: {event.duration_ms}ms, {event.tokens} tokens, ${event.cost:.4f}")

# intake:         1840ms, 1,247 tokens, $0.0094
# photo_analysis:  920ms,     0 tokens, $0.0800  (vision API)
# policy_lookup:   145ms,     0 tokens, $0.0000
# assessment:     2100ms, 2,891 tokens, $0.0217
# fraud_check:     310ms,     0 tokens, $0.0010
# approve_claim: PAUSED  (waiting for human approval)
# resolution:     1950ms, 3,102 tokens, $0.0233
```

A few things to notice:

**It is Python, not config.** Agents are Python objects with strategies (`react`, `plan-and-execute`, `critic`). State is a Pydantic model with compile-time validation. Workflow steps are async functions. If you can read the ADK version, you can read this. The mental model is the same -- define agents, define tools, orchestrate.

**Parallel branches.** Photo analysis and policy lookup run concurrently via `parallel=["analyze_photos_step", "lookup_policy_step"]`. In ADK, you would use `ParallelAgent` -- similar concept, different syntax.

**Human approval is a decorator.** `@workflow.step(human_approval=True)` pauses the workflow and persists state. It survives process restarts, deployments, even server migrations. No polling. No external queue. In ADK, you build this yourself.

**Agent strategies matter.** The intake agent uses `react` (tight tool-use loop). The assessor uses `plan-and-execute` (structured multi-step). The resolution writer uses `critic` (draft, evaluate, refine). Each strategy is suited to the task. ADK agents do not have pluggable strategies.

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
| Time to first working prototype | Fast (define agents, compose) | Fast (`pip install jamjet`, Agent + Workflow) |

---

## Where ADK wins

Being honest makes the comparison useful. But being honest also means not giving away ground JamJet already covers.

**Gemini-specific features.** If you are committed to Gemini, ADK gives you capabilities that are tightly coupled to the model: built-in code execution (the agent writes and runs Python in a sandbox), Google Search grounding (model responses cite verifiable sources), and Vertex AI Agent Engine for managed deployment with Google's SLA. These are Gemini platform features, not framework features -- you get them because ADK is Google's framework for Google's model. If Gemini is your model, this integration depth is real. If you use multiple models or want provider flexibility, it is irrelevant.

**Google Cloud managed deployment.** Vertex AI Agent Engine gives you a managed runtime without operating your own infrastructure. For teams already on Google Cloud, this removes operational overhead. JamJet deploys anywhere -- Docker, Kubernetes, bare metal -- which is more flexible but requires you to manage the runtime yourself.

---

## Where JamJet wins

**Native A2A and MCP -- both protocols, first-class.** Google co-developed A2A, and ADK supports it. But JamJet also has native A2A support built into the runtime -- both client and server. And JamJet has native MCP support, which gives your agents access to hundreds of community-built tool servers (databases, file systems, APIs, search) without writing adapter code. ADK added MCP client support, but JamJet treats both protocols as core primitives, not integrations.

**Agent strategies.** JamJet agents ship with pluggable reasoning strategies: `react` (tight tool-use loops), `plan-and-execute` (structured multi-step reasoning), `critic` (draft-evaluate-refine), `consensus`, and `debate`. Each strategy is suited to different tasks -- the claims example uses three different strategies across four agents. ADK agents do not have pluggable strategies; the reasoning approach is implicit in the prompt.

**Composability beyond linear pipelines.** ADK's `SequentialAgent`, `ParallelAgent`, and `LoopAgent` are clean primitives. JamJet matches all of them -- sequential via `@workflow.step` chains, parallel via `parallel=["step_a", "step_b"]`, loops via conditional routing -- and adds coordinator nodes with structured scoring for dynamic agent routing, agent-as-tool invocation in three modes (sync, streaming, conversational), and typed Pydantic state validated at every transition. The composability surface is broader.

**Web Companion and CLI debugging.** JamJet has a Web Companion Inspector (React SPA embedded in the runtime binary) with graph visualization, node detail, event timeline, and state inspection. Plus `jamjet inspect` for full execution traces in the terminal and `jamjet replay` / `jamjet fork` for deterministic reproduction. ADK's Web UI captures interactions during development -- JamJet's tooling works on production executions too.

**Ecosystem via MCP.** ADK supports LangChain tools, CrewAI tools, and MCP servers. JamJet's approach is simpler: MCP is the standard, so JamJet speaks MCP natively. Any MCP server works out of the box -- no adapters, no compatibility layers. And JamJet can also serve your workflows as MCP tools for other agents to call.

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

There is no universal answer. But the decision space is narrower than it looks.

**Committed to Gemini on Google Cloud?** ADK gives you Gemini-specific features (code execution, grounding) and Vertex AI managed deployment that no other framework matches. If your stack is Gemini + Google Cloud, ADK is purpose-built for it.

**Everything else?** JamJet covers the ground. Durable execution, native MCP and A2A, pluggable agent strategies, typed state, human-in-the-loop, eval harness, replay debugging, cost tracking, audit trails -- these are all built in. You get model-agnostic multi-model workflows, JVM support via Spring Boot, and deployment flexibility (Docker, Kubernetes, bare metal, any cloud).

**Enterprise Java team?** JamJet. Spring Boot starter, Maven Central artifacts, Micrometer and OpenTelemetry integration, LangChain4j bridge. ADK is Python-first.

**Regulated industry?** JamJet. The structured event log is an audit trail by default -- every prompt, response, tool call, and state transition, timestamped and immutable.

**Multi-model workflows?** JamJet. Use Claude for reasoning, Gemini for code generation, and a local Llama for classification -- in the same workflow, with different agent strategies. No adapter layer needed.

**Need reproducible experiments?** JamJet. Replay testing, execution forking, ExperimentGrid for parameter sweeps, and statistical comparison are built into the workflow model.

---

## The real difference

ADK is Google's framework for Google's model on Google's cloud. If that is your stack, the integration depth is genuine and hard to replicate elsewhere.

JamJet is a general-purpose agent runtime that treats production concerns -- durability, audit, human approval, quality, cost -- as first-class primitives rather than afterthoughts. It is model-agnostic, cloud-agnostic, and language-flexible (Python and Java). It matches ADK on agent composition, exceeds it on production guarantees, and gives you the protocol support (MCP + A2A) and debugging tools (replay, fork, inspect) that production systems actually need.

The question is not which framework has more features. It is whether your production requirements are met by default or require you to build them yourself.

Try the claims processing example: [github.com/jamjet-labs/jamjet/examples/claims-processing](https://github.com/jamjet-labs/jamjet/examples/claims-processing)
