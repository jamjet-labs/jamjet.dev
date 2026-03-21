---
title: "Testing AI agents like software"
date: 2026-03-08
description: "Most teams test their agents by running them manually and eyeballing the output. There is a better way — and it fits in a CI pipeline."
author: jamjet-team
category: "Testing & Evaluation"
---

# Testing AI agents like software

Here is something I keep seeing: teams building production AI agents who have no automated tests for them. They run the workflow manually, look at the output, decide it seems okay, and ship it. Then something breaks in production and the debugging is entirely manual.

This is not because developers are lazy. It is because testing non-deterministic LLM output is genuinely hard, and most agent frameworks do not give you good tools for it. So people fall back to the only thing that works: human judgment.

JamJet ships a built-in eval harness. Here is what it looks like and why I think the approach is right.

---

## What you are actually testing

When you test a software function, you assert that given an input, you get a specific output. With LLM-powered agents, the output is never exactly the same twice. So you need to test at a different level:

- Does the output contain the right information? (**assertion scoring**)
- Did it respond within an acceptable time budget? (**latency scoring**)
- Is the quality good enough for a human expert? (**LLM-as-judge**)
- Did it cost within budget? (**cost scoring**)

These are the four scorer types built into JamJet. You combine them into an eval run, point it at a JSONL dataset, and get a pass/fail result you can wire into CI.

---

## A minimal eval

```python
from jamjet.eval import EvalDataset, EvalRunner, AssertionScorer, LatencyScorer, LlmJudgeScorer

dataset = EvalDataset.from_jsonl("dataset.jsonl")
# dataset.jsonl: each line is {"input": {...}, "expected": {...}}

runner = EvalRunner(workflow=wf, dataset=dataset)

results = runner.run(scorers=[
    AssertionScorer(fn=lambda output, expected: expected["keyword"] in output["answer"]),
    LatencyScorer(max_ms=3000),
    LlmJudgeScorer(prompt="Rate the answer quality 1-5. Pass if >= 4."),
])

print(f"{results.passed}/{results.total} passed")
# 5/5 passed
```

The dataset is just JSONL — one test case per line, human-readable, version-controllable:

```jsonl
{"input": {"question": "What is event sourcing?"}, "expected": {"keyword": "state transitions"}}
{"input": {"question": "Explain CAP theorem"}, "expected": {"keyword": "consistency"}}
```

---

## Running in CI

```yaml
# .github/workflows/eval.yml
- name: Run evals
  run: |
    pip install jamjet
    python eval.py --fail-under 0.9
```

`--fail-under 0.9` exits with code 1 if fewer than 90% of cases pass. Your CI pipeline fails. The PR does not merge. Exactly like a unit test suite.

---

## LLM-as-judge with local Ollama

The `LlmJudgeScorer` makes a second LLM call to evaluate the first one. In production you might use a stronger model as judge. For CI — or for developers running evals locally — you can use Ollama for free:

```python
LlmJudgeScorer(
    prompt="Is this a clear, accurate, and concise answer? Reply PASS or FAIL with one sentence of reasoning.",
    model="llama3.2",
    base_url="http://localhost:11434/v1",
)
```

No API cost. Runs on your laptop. Same eval, same scoring.

---

## The mindset shift

The hardest part of AI agent testing is not technical. It is accepting that "close enough" needs a definition.

If your agent answers a customer support question, what makes the answer acceptable? If it writes code, what makes the code correct? These questions feel hard because LLM output is fuzzy — but they are exactly the questions your team already answers implicitly when they eyeball output. Writing a scorer just makes that implicit judgment explicit and repeatable.

Once you have a JSONL dataset with 20–50 test cases and a scorer that matches your judgment, you have something worth running in CI. Start small. A 10-row dataset with an `AssertionScorer` that checks one thing is infinitely better than no tests at all.

---

## What this is not

This is not a replacement for human review of LLM output. It is a floor — a minimum bar that runs automatically and catches regressions. The human review still happens, but you are not relying on it to catch every breakage.

It is also not a silver bullet. If your prompts change significantly, your scorers might need updating. That is expected. Treat your eval dataset the same way you treat your test suite: maintain it, extend it, and take failures seriously.

---

## Try it

Example 03 in [jamjet-benchmarks](https://github.com/jamjet-labs/jamjet-benchmarks/tree/main/examples/03_eval_harness) runs a 5-row eval locally with Ollama as the judge:

```bash
git clone https://github.com/jamjet-labs/jamjet-benchmarks
cd jamjet-benchmarks/examples/03_eval_harness
pip install -r requirements.txt
OPENAI_API_KEY=ollama OPENAI_BASE_URL=http://localhost:11434/v1 MODEL_NAME=llama3.2 python main.py
```

Output:

```
Eval Results — 5/5 passed (100%)
assertion : 5/5 passed
latency   : 5/5 passed
llm_judge : 5/5 passed  (local Ollama — free)
```

Full eval harness docs: [jamjet.dev/eval](/eval)
