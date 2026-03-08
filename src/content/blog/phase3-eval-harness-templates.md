---
title: "Phase 3: Eval Harness, Project Templates, and the Path to Trustworthy Agents"
date: 2026-03-08
description: "Shipping the eval harness, four built-in project templates, and why testing your agents the same way you test software is the only path forward."
author: jamjet-team
---

# Phase 3: Eval Harness, Project Templates, and the Path to Trustworthy Agents

Today we're shipping the first pieces of JamJet's Phase 3 — the developer experience layer that turns a working agent into a *trustworthy* one.

Two things landed:

1. **A complete eval harness** with a full test suite
2. **Project templates** — `jamjet init --template <name>` now scaffolds production-ready workflows from day one

---

## The core problem with AI agents in production

Software engineering has a solved problem: you write tests, you run them on every commit, you get a green or red signal. If something breaks, you know immediately.

AI agents don't have this yet — not in practice.

People ship agents to production and cross their fingers. They check a few outputs manually, maybe run a quick eyeball test, then deploy. This works for demos. It doesn't work when you're running thousands of executions a day and need to know whether a model change, a prompt tweak, or a new tool integration broke something.

The JamJet eval harness is our answer to this.

---

## What the eval harness gives you

The harness has been in the SDK since v0.1.0, but today we're shipping a comprehensive test suite (38 tests) that validates every component end-to-end — and it's the best illustration of how it's designed to be used.

### Four scorer types, composable

```python
from jamjet.eval import (
    EvalDataset,
    EvalRunner,
    AssertionScorer,
    LatencyScorer,
    CostScorer,
    LlmJudgeScorer,
)

dataset = EvalDataset.from_file("evals/dataset.jsonl")

runner = EvalRunner(
    workflow_id="research-agent",
    scorers=[
        # Hard assertions — Python expressions, always fast, zero cost
        AssertionScorer(checks=[
            "'report' in output",
            "len(output['report']) >= 200",
            "'sources' in output['report'].lower()",
        ]),

        # Latency budget
        LatencyScorer(threshold_ms=8000),

        # Cost budget per execution
        CostScorer(threshold_usd=0.05),

        # LLM-as-judge for subjective quality
        LlmJudgeScorer(
            rubric="Is the report comprehensive, well-structured, and does it cite sources?",
            min_score=4,
            model="claude-haiku-4-5-20251001",
        ),
    ],
)

results = await runner.run(dataset)
runner.print_summary(results)
```

The output is a Rich table showing pass/fail per row, per scorer, with scores and cost.

### Datasets are just JSONL

```jsonl
{"id": "q1", "input": {"query": "What is event sourcing?"}, "expected": {}}
{"id": "q2", "input": {"query": "How does A2A work?"}, "expected": {}}
{"id": "q3", "input": {"query": "Best practices for prompt engineering"}, "expected": {}}
```

No database, no platform lock-in. A dataset is a file. You version it, you diff it, you review it in a PR.

### It runs against your real runtime

The `EvalRunner` submits executions to the JamJet runtime (local or remote), polls until completion, extracts cost from events, and runs all scorers concurrently. Concurrency is configurable — default is 4 parallel rows.

This matters. An eval harness that mocks everything doesn't tell you whether your *actual workflow* works. JamJet evals run real executions.

### CI-ready in one command

```bash
jamjet eval run evals/dataset.jsonl --workflow research-agent --fail-under 0.9
```

Pass rate below 90%? Exit code 1. Your CI pipeline fails. You know before you ship.

---

## `jamjet init --template`: starting from something real

The other thing that landed today is proper template support for `jamjet init`.

Before today:

```bash
jamjet init my-agent
# → generic workflow.yaml with a single model node
```

Now:

```bash
jamjet init my-agent --template research-agent
# → workflow.yaml (web search + synthesis with retry)
# → jamjet.toml  (Brave Search MCP server configured)
# → evals/dataset.jsonl (5 seed eval rows)
```

Four templates ship today:

| Template | What it does |
|---|---|
| `hello-agent` | Minimal Q&A — one model node, answer a question |
| `research-agent` | Web search (Brave MCP) + synthesis with retry |
| `code-reviewer` | GitHub PR fetch → model review → eval quality gate → post comment |
| `approval-workflow` | Model proposes → human approves → execute or escalate |

List them anytime:

```bash
jamjet init --list-templates
```

Every template ships with an `evals/dataset.jsonl` (where it makes sense) so you have a regression test on day one — not after the first production incident.

The `code-reviewer` template is particularly interesting because it demonstrates the `eval` node type inline in the workflow itself:

```yaml
check-quality:
  type: eval
  scorers:
    - type: llm_judge
      rubric: "Is this code review thorough, constructive, specific, and well-structured?"
      min_score: 4
      model: claude-haiku-4-5-20251001
    - type: assertion
      check: "len(output['review']) >= 200"
  on_fail: retry_with_feedback
  max_retries: 2
  next: post-comment
```

The workflow doesn't just run a model — it evaluates its own output, and retries with feedback if quality is too low. The eval harness and the eval node are the same concept: score outputs, fail on bad quality, use that signal to drive behavior.

---

## Why we test the eval harness itself

One thing worth calling out: we ship 38 tests for the eval harness. Not just "does it run" — edge cases like:

- LLM judge response with prose before/after the JSON block
- Scorer that throws an exception mid-run (doesn't crash the row, produces a failed `ScorerResult`)
- Cost extraction from multiple node events (summed correctly)
- `EvalResult.overall_score` skipping `None` values from scorers that have no numeric output (latency scorer when duration isn't measured)

This matters because an eval harness you can't trust is worse than no eval harness. If your test framework has bugs, you get false confidence. We wanted to ship something we could stake the CI signal on.

---

## What's next

The eval harness and templates are the first Phase 3 milestones. Coming up:

- **Model node executor in Rust** — the critical piece that closes the loop between workflow definitions and real LLM calls in the runtime (currently the Python SDK compiles workflows, but the Rust worker doesn't yet execute `type: model` nodes end-to-end)
- **`eval` workflow node** in the Rust executor — so `on_fail: retry_with_feedback` actually works at runtime, not just in YAML
- **More reasoning strategies** — reflection, consensus, and debate patterns as first-class strategy types
- **Time-travel debugging** — replay any execution from any checkpoint in the event log

The runtime is the foundation. The eval harness is how you know the foundation holds. Both are shipping in parallel.

---

If you want to try it:

```bash
pip install jamjet
jamjet init my-first-agent --template hello-agent
cd my-first-agent
jamjet dev
```

The code is at [github.com/jamjet-labs/jamjet](https://github.com/jamjet-labs/jamjet). Examples at [github.com/jamjet-labs/examples](https://github.com/jamjet-labs/examples).
