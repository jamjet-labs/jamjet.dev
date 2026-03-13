---
title: "Building a multi-agent wealth advisor with JamJet"
date: 2026-03-13
description: "Four specialist AI agents — risk profiler, market analyst, tax strategist, portfolio architect — collaborate through a durable workflow to produce investment recommendations. A deep dive into the architecture, with a side-by-side comparison to Google ADK."
author: jamjet-team
---

# Building a multi-agent wealth advisor with JamJet

A wealth management recommendation touches risk modeling, market data, tax law, portfolio construction, and compliance — each requiring different expertise, different tools, and different reasoning. A single LLM prompt cannot do this well.

We built a multi-agent system that mirrors how a real wealth management team operates. Four specialist agents collaborate through a JamJet workflow, each with its own persona, tools, and reasoning strategy. The result is a compliance-checked investment recommendation with a human approval gate before delivery.

---

## The agents

| Agent | Role | Strategy | Tools |
|-------|------|----------|-------|
| Risk Profiler | Certified Financial Planner | `plan-and-execute` | `get_client_profile`, `assess_risk_score` |
| Market Analyst | CFA charterholder | `react` | `get_market_data` |
| Tax Strategist | Enrolled Agent (EA) | `plan-and-execute` | `get_client_profile`, `analyze_tax_implications` |
| Portfolio Architect | Senior PM, 20yr exp | `critic` | `build_portfolio_allocation`, `check_compliance` |

Each agent gets the reasoning strategy that fits its cognitive task. This is not cosmetic — it changes how the agent thinks.

![Wealth management multi-agent architecture — 4 specialist agents orchestrated through a durable workflow with typed state and human approval](/blog/wealth-mgmt-architecture.svg)

---

## Why each strategy matters

![Three reasoning strategies — plan-and-execute, react, and critic — each matched to an agent role](/blog/wealth-mgmt-strategies.svg)

### Risk Profiler: `plan-and-execute`

Risk assessment is sequential: retrieve profile, compute concentration risk, calculate risk score, synthesize. Each step depends on the previous one. Plan-and-execute generates a plan upfront and executes it methodically.

```python
risk_profiler = Agent(
    name="risk_profiler",
    model="claude-sonnet-4-6",
    tools=[get_client_profile, assess_risk_score],
    instructions="You are a CFP specializing in risk assessment...",
    strategy="plan-and-execute",
    max_iterations=5,
)
```

### Market Analyst: `react`

Market analysis is exploratory. The analyst fetches broad indices, notices a trend, drills into specific sectors, then synthesizes. The tight observe-reason-act loop of ReAct is purpose-built for this kind of iterative data exploration.

```python
market_analyst = Agent(
    name="market_analyst",
    model="claude-sonnet-4-6",
    tools=[get_market_data],
    instructions="You are a CFA charterholder...",
    strategy="react",
    max_iterations=5,
)
```

### Tax Strategist: `plan-and-execute`

Tax rules are systematic. The strategist must evaluate every applicable strategy: tax-loss harvesting, Roth conversions, municipal bonds, asset location, 529 plans. Missing one is worse than exploring creatively.

### Portfolio Architect: `critic`

The final recommendation is the highest-stakes deliverable. The critic strategy drafts an initial allocation, evaluates it against all prior analysis, then refines. This draft-evaluate-revise loop catches gaps that a single pass would miss.

```python
portfolio_architect = Agent(
    name="portfolio_architect",
    model="claude-sonnet-4-6",
    tools=[build_portfolio_allocation, check_compliance],
    instructions="You are a senior portfolio manager...",
    strategy="critic",
    max_iterations=5,
)
```

---

## Orchestration with typed state

The agents do not call each other. A JamJet `Workflow` orchestrates them, passing a typed Pydantic model between steps:

```python
workflow = Workflow("wealth_management_advisory", version="0.1.0")

@workflow.state
class AdvisoryState(BaseModel):
    client_id: str
    risk_assessment: str | None = None
    market_analysis: str | None = None
    tax_strategy: str | None = None
    final_recommendation: str | None = None

@workflow.step
async def assess_risk(state: AdvisoryState) -> AdvisoryState:
    result = await risk_profiler.run(
        f"Assess risk for client {state.client_id}"
    )
    return state.model_copy(update={"risk_assessment": result.output})

@workflow.step
async def analyze_markets(state: AdvisoryState) -> AdvisoryState:
    result = await market_analyst.run(
        f"Analyze markets for this risk profile:\n{state.risk_assessment}"
    )
    return state.model_copy(update={"market_analysis": result.output})

@workflow.step
async def plan_tax_strategy(state: AdvisoryState) -> AdvisoryState:
    result = await tax_strategist.run(
        f"Tax strategy for client {state.client_id}..."
    )
    return state.model_copy(update={"tax_strategy": result.output})

@workflow.step(human_approval=True)
async def build_recommendation(state: AdvisoryState) -> AdvisoryState:
    brief = (
        f"RISK: {state.risk_assessment}\n"
        f"MARKET: {state.market_analysis}\n"
        f"TAX: {state.tax_strategy}"
    )
    result = await portfolio_architect.run(
        f"Build portfolio recommendation:\n{brief}"
    )
    return state.model_copy(
        update={"final_recommendation": result.output}
    )
```

Three design choices worth noting:

**Typed state.** `AdvisoryState` is a Pydantic model — IDE autocomplete, compile-time validation, automatic JSON Schema. Not `session.state['risk_assessment']` with string keys.

**Immutable updates.** Each step returns a new state via `model_copy(update={...})`. The workflow engine records every transition. If the process crashes after the market analysis step, it resumes from the last committed state.

**Human approval.** `human_approval=True` on the final step is a first-class workflow primitive. The workflow pauses and waits for an explicit sign-off. In financial services, a licensed advisor must review before anything reaches the client.

---

## Running it

**Local, in-process:**

```bash
python jamjet_impl.py C-1001
```

Agents run in sequence, tools execute locally, output streams in real time. No runtime server needed.

**On the JamJet runtime (durable):**

```bash
jamjet dev                         # start the Rust runtime
python jamjet_impl.py --runtime    # submit to runtime
```

The workflow is now durable. Crash after the tax step? The runtime resumes from there on restart. The approval gate pauses execution until:

```bash
jamjet approve exec_<id> --decision approved
```

---

## Comparison with Google ADK

We implemented the same scenario with Google ADK. Here is the side-by-side.

### What ADK does well

- **Simpler tool definition** — plain Python functions, no decorator needed
- **Built-in parallel execution** — `ParallelAgent` runs sub-agents concurrently
- **Vertex AI integration** — managed hosting if you are on GCP with Gemini

### Where JamJet pulls ahead

![JamJet vs Google ADK — 9-dimension feature comparison](/blog/wealth-mgmt-comparison.svg)

| Capability | JamJet | Google ADK |
|------------|--------|------------|
| Reasoning strategies | 3 built-in per agent | Model decides |
| State model | Typed Pydantic, immutable | Mutable dict |
| Human approval | `human_approval=True` | Build from scratch |
| Durability | Event-sourced, crash-safe | In-memory only |
| Audit trail | Full event log | Not available |
| Protocols | MCP + A2A + ANP | MCP client only |
| LLM support | Any OpenAI-compatible | Gemini-first |
| Cost controls | `max_cost_usd`, `max_iterations` | Not built-in |

### The strategy gap

With JamJet, each agent gets a reasoning strategy that matches its task. The risk profiler plans then executes. The market analyst observes then reasons. The portfolio architect drafts, critiques, and refines.

With ADK, you have one lever: the system prompt. The model decides how to reason. You cannot say "use ReAct for this agent" — that concept does not exist in ADK.

### The durability gap

JamJet event-sources every state transition. If the process crashes after step 2:

- **JamJet** — resumes from last committed state. Steps 1-2 are preserved. Only steps 3-4 re-execute.
- **ADK (OSS)** — everything is lost. Start over.

In a workflow costing $0.50+ per run, that adds up.

### The compliance gap

Wealth management is heavily regulated — FINRA suitability, Reg BI, KYC/AML. JamJet provides:

- **Immutable audit trail** of every agent decision, tool call, and state transition
- **Human approval gate** ensuring a licensed advisor signs off before client delivery
- **Compliance tool** checking suitability, concentration limits, and regulatory requirements

ADK has no built-in audit trail and no approval primitive. You build both from scratch.

---

## When to choose what

**JamJet** — durable execution, audit trails, human approval gates, multi-framework interop via MCP/A2A. Financial services, healthcare, legal — anywhere compliance is non-negotiable.

**Google ADK** — fast prototyping with Gemini, Vertex AI managed hosting, no durability or compliance requirements.

---

## Try it

```bash
git clone https://github.com/jamjet-labs/jamjet
cd examples/wealth-management-agents

# JamJet
python jamjet_impl.py

# Google ADK (requires google-adk)
python google_adk_impl.py
```

The `comparison.md` in that directory has a full 8-dimension analysis. The `tools.py` contains all simulated data sources — swap in Bloomberg/Plaid/tax APIs for production.
