---
title: Eval Harness
description: Score output quality, run regression suites, and gate CI with JamJet eval.
sidebar:
  order: 7
---

import { Aside, Steps } from '@astrojs/starlight/components';

# Eval Harness

JamJet includes a built-in eval system for measuring and enforcing output quality — from quick ad-hoc checks to full CI regression suites.

## Why eval matters

LLM outputs are probabilistic. The same workflow can produce great results on most inputs and fail on edge cases. JamJet eval gives you:

- **LLM-as-judge** — a separate model scores output quality on a rubric
- **Assertions** — structural checks (length, field presence, format)
- **Latency + cost gates** — enforce SLAs in CI
- **Regression suites** — catch regressions before they reach production

## Inline eval (workflow)

Add an `eval` node to your workflow to score outputs and retry on failure:

```yaml
nodes:
  check-quality:
    type: eval
    scorers:
      - type: llm_judge
        rubric: "Is the answer accurate, complete, and under 200 words?"
        min_score: 4          # 1-5 scale
        model: claude-haiku-4-5-20251001
      - type: assertion
        check: "len(output.answer) > 0"
      - type: latency
        max_ms: 5000
    on_fail: retry_with_feedback
    max_retries: 2
    next: end
```

When `on_fail: retry_with_feedback`, the scorer's feedback is automatically injected into the next model call's prompt, creating a self-improvement loop.

## Dataset eval (CLI)

For batch evaluation, create a JSONL dataset:

```jsonl
{"id": "q1", "input": {"query": "What is JamJet?"}, "expected": {"topic": "runtime"}}
{"id": "q2", "input": {"query": "How do I install it?"}, "expected": {"topic": "install"}}
{"id": "q3", "input": {"query": "What models does it support?"}, "expected": {}}
```

Run it:

```bash
jamjet eval run dataset.jsonl \
  --workflow workflow.yaml \
  --rubric "Is the answer accurate and helpful?" \
  --min-score 4 \
  --assert "len(output.answer) >= 50" \
  --latency-ms 3000 \
  --concurrency 10 \
  --fail-below 0.9
```

```
Running 50 eval rows... ████████████████████ 50/50

┌─────────┬────────────┬───────┬──────────┬────────────────────┐
│ Row     │ Status     │ Score │ Latency  │ Note               │
├─────────┼────────────┼───────┼──────────┼────────────────────┤
│ q1      │ ✓ passed   │ 4.8   │  512ms   │                    │
│ q2      │ ✓ passed   │ 4.2   │  623ms   │                    │
│ q3      │ ✗ failed   │ 2.1   │  891ms   │ Answer too vague   │
└─────────┴────────────┴───────┴──────────┴────────────────────┘

Results: 49/50 passed (98.0%) — above threshold 90.0% ✓
```

Exit code is `0` on pass, `1` on fail — works directly in CI.

## CI integration

Add to your GitHub Actions workflow:

```yaml
- name: Run eval suite
  run: |
    jamjet eval run evals/core.jsonl \
      --workflow workflow.yaml \
      --rubric "Is the answer accurate and complete?" \
      --fail-below 0.85
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    JAMJET_URL: http://localhost:7700
```

<Aside type="tip">
Start the JamJet dev runtime in the CI job before running evals: `jamjet dev &` then `sleep 2` to let it initialize.
</Aside>

## Python eval API

For custom eval logic, use the Python eval package:

```python
import asyncio
from jamjet.eval import EvalDataset, EvalRunner
from jamjet.eval.scorers import LlmJudgeScorer, AssertionScorer, LatencyScorer

dataset = EvalDataset.from_file("evals/core.jsonl")

runner = EvalRunner(
    workflow_path="workflow.yaml",
    runtime_url="http://localhost:7700",
    scorers=[
        LlmJudgeScorer(
            rubric="Is the answer accurate and helpful?",
            model="claude-haiku-4-5-20251001",
            min_score=4,
        ),
        AssertionScorer(check="len(output['answer']) >= 50"),
        LatencyScorer(max_ms=3000),
    ],
    concurrency=10,
)

results = asyncio.run(runner.run(dataset))
runner.print_summary(results)

# Check overall pass rate
pass_rate = sum(1 for r in results if r.passed) / len(results)
assert pass_rate >= 0.9, f"Eval failed: {pass_rate:.0%} pass rate"
```

## Custom scorers

Write your own scorer by subclassing `BaseScorer`:

```python
from jamjet.eval.scorers import BaseScorer, ScorerResult

class ExactMatchScorer(BaseScorer):
    async def score(
        self,
        output: dict,
        *,
        expected: dict,
        duration_ms: float,
        cost_usd: float,
        input_data: dict,
    ) -> ScorerResult:
        answer = output.get("answer", "")
        expected_answer = expected.get("answer", "")
        passed = answer.strip().lower() == expected_answer.strip().lower()

        return ScorerResult(
            scorer="exact_match",
            passed=passed,
            score=1.0 if passed else 0.0,
            message=None if passed else f"Expected '{expected_answer}', got '{answer}'",
        )
```

## Scorer types

### LLM judge

Uses a separate model to score output on a 1–5 rubric:

```yaml
- type: llm_judge
  rubric: "Is the answer accurate, complete, and under 200 words?"
  min_score: 4           # 1–5 (5 = perfect)
  model: claude-haiku-4-5-20251001
```

The judge is given the input, output, and rubric, and returns a JSON object with `score` (1–5) and `reason`.

### Assertion

Python expression evaluated against `output` and `expected`:

```yaml
- type: assertion
  check: "len(output.answer) > 0"

# Multiple assertions
- type: assertion
  check: "'sources' in output"

- type: assertion
  check: "output.confidence >= 0.7"
```

### Latency

Checks that the execution completed within a time budget:

```yaml
- type: latency
  max_ms: 3000
```

### Cost

Checks that the execution stayed within a cost budget:

```yaml
- type: cost
  max_usd: 0.05
```

## Output formats

Save results to a file for further analysis:

```bash
jamjet eval run dataset.jsonl \
  --workflow workflow.yaml \
  --output results.json
```

```json
{
  "summary": {
    "total": 50,
    "passed": 47,
    "failed": 3,
    "pass_rate": 0.94,
    "avg_latency_ms": 612,
    "avg_cost_usd": 0.0003
  },
  "rows": [
    {
      "id": "q1",
      "passed": true,
      "scorers": [
        { "scorer": "llm_judge", "passed": true, "score": 4.8 }
      ],
      "duration_ms": 512,
      "cost_usd": 0.00023
    }
  ]
}
```
