---
title: "Building a multi-agent wealth advisor with JamJet"
date: 2026-03-13
description: "Four specialist AI agents — risk profiler, market analyst, tax strategist, portfolio architect — collaborate through a durable workflow to produce investment recommendations. A deep dive into the architecture, with a side-by-side comparison to Google ADK."
author: jamjet-team
---

# Building a multi-agent wealth advisor with JamJet

Financial advisory is one of those domains where a single LLM prompt falls apart fast. A wealth management recommendation touches risk modeling, live market data, tax law, portfolio construction, and regulatory compliance — each requiring different expertise, different tools, and different reasoning strategies.

We built a complete multi-agent system that mirrors how a real wealth management team works. Four specialist agents collaborate through a JamJet workflow, each with its own persona, tools, and reasoning approach. The result is a comprehensive, compliance-checked investment recommendation — with a human approval gate before delivery.

Here is how it works, why we made each design choice, and how it compares to building the same thing with Google ADK.

---

## The architecture

```
Client Request
    │
    ├─▶ Risk Profiler        assess risk capacity and willingness
    │       │
    ├─▶ Market Analyst       research current market conditions
    │       │
    ├─▶ Tax Strategist       identify tax-optimization opportunities
    │       │
    └─▶ Portfolio Architect   synthesize into final recommendation
            │
     [Human Approval Gate]   senior advisor reviews
            │
        Final Report
```

Each agent is a full JamJet `Agent` with its own model, tools, instructions, and reasoning strategy. The workflow passes typed state between them — a Pydantic model called `AdvisoryState` that accumulates each agent's output.

---

## Choosing the right strategy for each agent

This is where JamJet's three built-in reasoning strategies matter. Each agent gets the one that fits its cognitive task:

### Risk Profiler → `plan-and-execute`

Risk assessment is sequential and deterministic: retrieve profile, compute concentration risk, calculate risk score, synthesize. Each step depends on the previous one. Plan-and-execute generates a plan upfront and executes it step by step.

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

### Market Analyst → `react`

Market analysis is exploratory. The analyst looks at broad indices, notices something interesting, drills into a specific sector, then synthesizes. The tight observe-reason-act loop of ReAct is ideal for this kind of iterative data exploration.

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

### Tax Strategist → `plan-and-execute`

Tax strategy is rule-based. The strategist needs to systematically evaluate every applicable strategy: tax-loss harvesting, Roth conversions, municipal bonds, asset location, 529 plans. Missing one is worse than exploring creatively. Plan-and-execute ensures completeness.

### Portfolio Architect → `critic`

The final recommendation is the most important deliverable. The critic strategy drafts an initial allocation, evaluates it against all inputs from the other agents, and refines it. This draft-evaluate-revise loop produces higher-quality output because the "inner critic" catches gaps that a single pass would miss.

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

## The workflow

The agents do not call each other directly. A JamJet `Workflow` orchestrates them with typed state:

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
    brief = f"""
    RISK: {state.risk_assessment}
    MARKET: {state.market_analysis}
    TAX: {state.tax_strategy}
    """
    result = await portfolio_architect.run(
        f"Build portfolio recommendation:\n{brief}"
    )
    return state.model_copy(
        update={"final_recommendation": result.output}
    )
```

Three things to note:

1. **Typed state.** `AdvisoryState` is a Pydantic model. You get IDE autocomplete, compile-time validation, and automatic JSON Schema generation. No `session.state['risk_assessment']` with string keys and no type checking.

2. **Immutable updates.** Each step returns a new state via `model_copy(update={...})`. The workflow engine records every transition. If the process crashes after the market analysis step, it resumes from the last committed state — not from scratch.

3. **Human approval.** The `human_approval=True` flag on the final step is a first-class workflow primitive. When the workflow reaches this step, it pauses and waits for an explicit approval. In production, the senior advisor reviews the recommendation before it goes to the client.

---

## Running it

### Local (in-process)

```bash
python jamjet_impl.py C-1001
```

Each agent runs in sequence, tools execute locally, and you see output in real time. No runtime server needed during development.

### On the JamJet runtime (durable)

```bash
jamjet dev                         # start the Rust runtime
python jamjet_impl.py --runtime    # submit to runtime
```

Now the workflow is durable. If your laptop crashes after the tax strategy step, the runtime picks up from there when it restarts. The approval gate pauses execution until:

```bash
jamjet approve exec_<id> --decision approved
```

---

## Comparison with Google ADK

We implemented the exact same scenario with Google ADK to understand the trade-offs. Here is what we found.

### What ADK does well

**Simpler tool definition.** ADK tools are plain Python functions — no decorator needed. The framework extracts the schema from type hints and docstrings.

**Built-in parallel execution.** `ParallelAgent` runs sub-agents concurrently out of the box. JamJet's workflow DAG supports this too, but ADK makes it a one-liner.

**Vertex AI integration.** If you are already on GCP with Gemini models, ADK provides a seamless path to managed hosting.

### Where JamJet pulls ahead

| Dimension | JamJet | Google ADK |
|-----------|--------|------------|
| Strategy selection | 3 built-in strategies per agent | Model decides |
| State model | Typed Pydantic with immutable updates | Mutable dict |
| Human approval | First-class `human_approval=True` | Not available |
| Durability | Event-sourced, crash-resilient | In-memory (OSS) |
| Audit trail | Full event log per execution | Not available |
| Protocol support | MCP + A2A + ANP | MCP client only |
| LLM flexibility | Any OpenAI-compatible API | Gemini-first |
| Cost controls | `max_cost_usd`, `max_iterations` | Not built-in |

### The strategy gap

This is the biggest difference. With JamJet, each agent gets a reasoning strategy that matches its cognitive task. The risk profiler plans then executes. The market analyst observes then reasons. The portfolio architect drafts, critiques, and refines.

With ADK, you have one knob: the system prompt. The model decides how to reason. Sometimes it plans well, sometimes it does not. You cannot say "use ReAct for this agent" — that concept does not exist in ADK.

### The durability gap

For financial services, this matters a lot. JamJet's workflow engine event-sources every state transition. If the process crashes after the market analysis step:

- **JamJet:** Restarts from the last committed state. The risk assessment and market analysis are preserved. Only the remaining steps re-execute.
- **ADK (OSS):** Everything is lost. Start over.

In a workflow that takes 30+ seconds and costs $0.50+ in API calls, that difference adds up fast.

### The compliance gap

Wealth management is heavily regulated. FINRA suitability rules, Reg BI, KYC/AML. JamJet's event-sourced execution gives you a complete, immutable audit trail of every agent decision, every tool call, every state transition.

The human approval gate ensures a licensed advisor signs off before any recommendation reaches a client. This is not a nice-to-have in financial services — it is a regulatory requirement.

ADK has no built-in audit trail and no human approval primitive. You would need to build both from scratch.

---

## When to use what

**Choose JamJet** when you need durable execution, regulatory audit trails, human-in-the-loop approval, or multi-framework interoperability via MCP/A2A. Financial services, healthcare, legal — anywhere compliance matters.

**Choose Google ADK** when you are prototyping with Gemini models, want the fastest path to a working demo, and do not need durability or compliance guarantees. Vertex AI managed hosting is a strong value prop if you are already on GCP.

---

## Try it yourself

The complete working example is in the JamJet repo:

```bash
git clone https://github.com/jamjet-labs/jamjet
cd examples/wealth-management-agents

# JamJet implementation
python jamjet_impl.py

# Google ADK implementation (requires google-adk)
python google_adk_impl.py
```

The `comparison.md` file in that directory has a detailed 8-dimension side-by-side analysis. The `tools.py` file contains all the simulated data sources — swap in real Bloomberg/Plaid/tax APIs for production.
