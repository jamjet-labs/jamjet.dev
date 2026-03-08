---
title: "Building a self-evaluating AI agent in 50 lines"
date: 2026-03-08
description: "Draft, judge, retry. A workflow that scores its own output and loops until it is good enough — or gives up gracefully."
author: jamjet-team
---

# Building a self-evaluating AI agent in 50 lines

One of the patterns I find most useful in production AI systems is the self-evaluating loop: generate an answer, score it, retry with specific feedback if it falls short. Not because LLMs always get it wrong — but because "good enough" is a constraint worth encoding explicitly rather than leaving to chance.

Here is the full thing, in about 50 lines of Python.

---

## The pattern

Three nodes, one loop:

```
draft → judge → accept   (if score ≥ threshold)
              → draft    (if score < threshold and attempts < max)
              → give_up  (if out of retries)
```

The routing predicate controls the loop. The state carries the score and attempt count. No hidden magic.

---

## The code

```python
from __future__ import annotations
import os
from pydantic import BaseModel
from openai import OpenAI
from jamjet import Workflow

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY", "ollama"),
    base_url=os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1"),
)
MODEL = os.getenv("MODEL_NAME", "llama3.2")
QUESTION = os.getenv("QUESTION", "Explain event sourcing in one paragraph.")
MIN_SCORE = 4
MAX_RETRIES = 3


def llm(system: str, user: str) -> str:
    resp = client.chat.completions.create(
        model=MODEL, temperature=0, max_tokens=300,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
    )
    return (resp.choices[0].message.content or "").strip()


wf = Workflow("self-eval")

@wf.state
class State(BaseModel):
    question: str
    answer: str = ""
    feedback: str = ""
    judge_score: int = 0
    attempts: int = 0

@wf.step(next="judge")
async def draft(state: State) -> State:
    prompt = state.question
    if state.feedback:
        prompt += f"\n\nPrevious attempt was rated {state.judge_score}/5. Feedback: {state.feedback}\nPlease improve."
    answer = llm("You are a concise technical writer.", prompt)
    return state.model_copy(update={"answer": answer, "attempts": state.attempts + 1})

@wf.step(next={
    "accept":   lambda s: s.judge_score >= MIN_SCORE,
    "draft":    lambda s: s.judge_score < MIN_SCORE and s.attempts < MAX_RETRIES,
    "give_up":  lambda s: s.judge_score < MIN_SCORE and s.attempts >= MAX_RETRIES,
})
async def judge(state: State) -> State:
    raw = llm(
        "You are a strict technical editor. Rate the answer 1-5 (5=excellent). "
        "Reply in exactly this format: SCORE: <n>\nFEEDBACK: <one sentence>",
        f"Question: {state.question}\nAnswer: {state.answer}",
    )
    score, feedback = 3, "Could be clearer."
    for line in raw.splitlines():
        if line.startswith("SCORE:"):
            try: score = int(line.split(":")[1].strip())
            except ValueError: pass
        if line.startswith("FEEDBACK:"):
            feedback = line.split(":", 1)[1].strip()
    return state.model_copy(update={"judge_score": score, "feedback": feedback})

@wf.step
async def accept(state: State) -> State:
    return state

@wf.step
async def give_up(state: State) -> State:
    return state


result = wf.run_sync(State(question=QUESTION))
s = result.state

print(f"\nFinal answer ({s.attempts} attempt{'s' if s.attempts != 1 else ''}, score {s.judge_score}/5):")
print(s.answer)
if s.attempts > 1:
    print(f"\nFeedback that triggered retry: {s.feedback}")
```

---

## What is happening

**`draft`** generates an answer. On retries, it receives the previous score and feedback as context, so it knows what to improve — not just "try again."

**`judge`** asks a second LLM call to score the answer 1–5 and give one sentence of feedback. The scoring and routing are completely separate from the generation. You can swap the judge for a different model, a different prompt, or a deterministic scorer without touching `draft`.

**Routing** is the routing predicate on `judge`. Three branches, plain Python lambdas on the state. You can test them without running any LLM:

```python
assert route(State(judge_score=5, attempts=1)) == "accept"
assert route(State(judge_score=2, attempts=1)) == "draft"
assert route(State(judge_score=2, attempts=3)) == "give_up"
```

**`result.events`** gives you the full execution trace after it runs:

```
✓ draft    1200ms
✓ judge     810ms
✓ accept      0ms
──────────────────
Judge score: 5/5 — accepted on first attempt
```

---

## Why this matters

The self-evaluating loop is a pattern that comes up constantly in production:

- Code review agents that retry until the diff passes a quality check
- Summarisation agents that retry if the summary is too long
- SQL agents that retry if the generated query fails validation
- Report generators that retry if a fact-checker flags an error

In most frameworks you build this loop in ad-hoc ways — a `while` loop, custom retry logic, external state tracking. In JamJet it is just a routing predicate. The loop is explicit, inspectable, and testable.

---

## Try it

This is example 04 in the [jamjet-benchmarks examples](https://github.com/jamjet-labs/jamjet-benchmarks/tree/main/examples/04_self_evaluating_workflow). Runs locally with Ollama, no API key:

```bash
git clone https://github.com/jamjet-labs/jamjet-benchmarks
cd jamjet-benchmarks/examples/04_self_evaluating_workflow
pip install -r requirements.txt
OPENAI_API_KEY=ollama OPENAI_BASE_URL=http://localhost:11434/v1 MODEL_NAME=llama3.2 python main.py
```
