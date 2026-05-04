---
title: "Engram on LongMemEval: What Worked, What Didn't, What We Learned"
date: 2026-05-04
description: "We added 8 retrieval-and-reading techniques to Engram and benchmarked each independently against LongMemEval-S. Three shipped, five didn't. The negative results turned out to be the most useful part."
author: "Sunil Prakash"
draft: false
category: "Engineering"
---

# Engram on LongMemEval: What Worked, What Didn't, What We Learned

We spent a few sessions adding eight retrieval-and-reading techniques to [Engram](https://github.com/jamjet-labs/engram) — query decomposition, a programmatic temporal solver, tool-augmented reading, query-time re-extraction, adaptive self-consistency, a ReAct retrieval agent, and a fine-tuned cross-encoder reranker. We ablated each one independently on [LongMemEval-S](https://github.com/xiaowu0162/LongMemEval), the 500-question synthetic-chat-history benchmark from Wu et al. (2024).

**Three shipped. Five didn't.** The headline number is a +4pp lift over our bare-pipeline baseline. Honest framing: that's small, and we're well behind the public leaderboard frontier ([AgentMemory](https://arxiv.org/abs/2501.00309) at 96.2%). But the *interesting* output of the programme isn't the +4pp — it's the negative results, because every one of them changed our mental model of why these techniques work in some pipelines and not others.

![Per-category accuracy: baseline vs shipped stack on LongMemEval-S 100q](/blog/engram-tier-2-3-categories.svg)

## The setup

We used a stratified 100-question subset for fast ablation iteration (~$1 and ~12 minutes per smoke), with the official `gpt-4o-mini` LongMemEval judge for scoring. Reader: gpt-4o-mini. Embedder: Ollama `nomic-embed-text` local. Reranker: MS MARCO MiniLM base.

For each new technique, we ran an isolated smoke (technique on / technique off) and compared per-category accuracy. Items only shipped ON-by-default if they cleared their pre-declared gate (overall non-regression at minimum; +Δ on the target category for items with category-specific gates).

## What shipped

**1. Decomposer wiring (`--decompose`):** +1pp overall, **+6pp on multi-session**. The interesting twist: a naive "split on conjunctions" gate regressed temporal-reasoning by -6pp because questions like *"Which event did I attend first, the workshop or the seminar?"* got decomposed into atomic sub-questions that lost the comparison. Tightening the gate to *skip* questions containing temporal/ordering markers ("first", "before", "after", "how long", etc.) recovered the lift without the regression.

**2. Tool-augmented reader (`--tools`):** +3pp overall. Six tools (`search_facts`, `search_events`, `solve_temporal`, `count_between`, `add_days`, `days_between`) exposed to the reader through a text-protocol marker (`[TOOL_USE]{...}[/TOOL_USE]`). gpt-4o-mini handles this well — its training distribution includes function-calling-shaped formats. Sonnet and Haiku regressed when we tried them with the same protocol; native Anthropic tool-use API is the future-work fix there.

That's it for shippable wins.

![Three items shipped ON, five behind flags default OFF](/blog/engram-tier-2-3-shipped-vs-failed.svg)

## What didn't ship — and why

### Programmatic temporal solver: parser too eager

We built a small DSL (count / duration / before-after / elapsed) that parses temporal questions and executes deterministically against the SVO event calendar. The intuition was: "how many marathons did I run before the cure event?" should not require an LLM to count — it should require a SQL query.

In practice, the LLM parser was too aggressive. It would classify *"how many followers do I have on Instagram now?"* as a count-of-events query, search the SVO calendar for "have followers" events, find none, return zero. The Reader trusted the deterministic output as final and produced a confident-but-wrong answer.

We added a fail-closed guard (return None when the count is zero, defer to the LLM), which dropped the firing rate from 18 wrong answers per 100 questions down to 3. But that residual 3 was still 3/3 wrong, because the parser kept treating "how many X do I have" as event counts. Net negative; ships behind a flag.

**Lesson:** deterministic solvers help when the parser can be made *strict enough to fail-closed on ambiguous questions*. With a more cautious parser ("only fire when the question has explicit anchor words like 'before X' or 'after Y'"), this could be a real win. Future work.

### Query-time re-extraction: nothing to re-extract

The idea: when the verifier flags an answer as PARTIAL, re-extract the top candidate sessions on-the-fly conditioned on the actual question, surfacing missed facts that the original general-purpose extractor missed.

Net result at n=50: zero detectable lift. With 30 facts already in context (top_k=30) and gpt-4o-mini as the reader, there wasn't much marginal value to surface. This might rescue value on Sonnet (which reasons over more context productively), or with a much smaller initial top_k, but at our default config it's a no-op.

### Adaptive self-consistency: gpt-4o-mini is too consistent

N=3 reader samples + majority vote on PARTIAL verdicts, gated to the categories where reader nondeterminism most often hurts. The theory: temperature-0.4 sampling lets the model hop out of locally-confident-wrong answers; the vote stabilises.

In practice, gpt-4o-mini at temperature 0 is already so deterministic that there's nothing for self-consistency to add. The N=3 votes were almost always identical to the N=1 answer, just slower and more expensive. Self-consistency probably rescues value on a chattier reader; on this stack it doesn't.

### ReAct retrieval agent: the verifier overcorrects

Full ReAct loop over the SVO event calendar with the same tool registry as the tool-augmented reader. Termination on `final_answer`, max-hops (4), wall-clock budget, and loop-detection (same tool called with identical args twice).

The agent works correctly — it can multi-hop, it terminates well, the trace shows clean tool calls. But the *escalation rule* is the problem. The verifier sometimes flags borderline-correct Reader answers as PARTIAL (which is the cautious, correct behaviour from the verifier's perspective). ReAct then re-runs and produces a *different* answer — sometimes better, often worse. The net effect is overwriting marginally-correct answers with confidently-different ones. -4pp at n=100.

**Lesson:** escalation chains need *calibrated* triggers, not "fire whenever the verifier isn't sure." A stricter trigger ("only fire when the Reader literally returns 'I don't know'") would probably flip this from net negative to net neutral. Future work.

### Fine-tuned cross-encoder: the most instructive failure

This one was the most interesting because it looked like a clear win for half a day, then turned into the most useful negative result of the programme.

We built a synthetic pair generator: walk the LongMemEval haystacks, label turns containing the gold answer string as positive (1), siblings as hard negatives (0). 1136 pairs total, group-aware split (no question's positive in train and its negative in eval). Fine-tuned the MS MARCO MiniLM cross-encoder for 3 epochs on Apple MPS (~56 seconds).

**nDCG@10 on held-out: base 0.9481 → fine-tuned 0.9785.** A +3 absolute lift on retrieval ranking quality. Looked great.

Then we plugged it into the full pipeline and ran the live smoke: **-7pp downstream accuracy.** Multi-session accuracy collapsed from 65% to 35%.

The reason: our positive label was "turn contains the answer string verbatim." That works for single-turn questions where the answer lives in one place. For multi-session questions, the answer is *synthesised* across many turns — none of which contain the answer literally. A reranker that learned to push answer-containing turns to the top systematically *demoted* the multi-turn-context turns that multi-session questions need.

The eval set was group-aware split, so it *should* have caught this — but it didn't, because nDCG measures ranking quality on the *same biased label distribution*. Garbage labels look great when measured against garbage labels.

**Lesson:** **high nDCG ≠ good downstream accuracy when training labels misalign with task structure.** This is a generally-true thing about IR-style metrics that I'd nodded at intellectually before but hadn't internalised. Question-type-aware labels (different positive criteria per LongMemEval category) is the obvious fix; future work.

## What this changed about how we think

A few things shifted:

1. **Deterministic-everywhere isn't free.** Programmatic solvers and structured tools beat LLM reasoning when they can be made *strict enough to fail-closed on ambiguous input*. Otherwise they confidently return wrong answers and the LLM trusts them. The work is in the strictness, not the implementation.

2. **Escalation chains compound errors as easily as they correct them.** ReAct + verifier sounds like "two safeguards better than one." In practice, a slightly miscalibrated verifier turns a careful Reader into a runaway agent. Calibration of *when* to escalate matters more than the escalation itself.

3. **Reranker fine-tuning should target downstream accuracy, not nDCG.** Or at minimum, downstream accuracy should be the gate, with nDCG as a fast-feedback proxy. Going from "nDCG passed, ship it" to "downstream regression, document and revert" cost us a day; we're glad we caught it before the leaderboard claim.

4. **Smaller smoke sizes are fine for direction, not for category-level claims.** We started with 100q smokes and a 200q M1 milestone; halfway through we realized 50q was sufficient for overall-only gates and the milestone was decision-irrelevant. Saved ~$5 and an hour without losing any signal.

## What we shipped

![Final pipeline: gpt-4o-mini reader with --decompose and --tools, plus 5 disabled escalation rungs](/blog/engram-tier-2-3-pipeline.svg)

Engram v0.6 (or whatever the next release is — versioning still in flux) ships:

- `gpt-4o-mini` as default reader (and utility) via `ModelTier.default()`
- `--decompose` ON by default with the tightened gate
- `--tools` ON by default with the 6-tool registry
- Five flags available default-OFF: `--solver`, `--reextract`, `--self-consistency`, `--react`, `--ft-cross-encoder` — with a documented diagnosis for each in the [spec doc](https://github.com/jamjet-labs/engram/blob/main/docs/superpowers/specs/2026-04-30-engram-v2-tier-2-3-design.md)

And the full reproducer for the negative results — including the cross-encoder training pipeline that doesn't help — is in the repo at [`training/cross_encoder/`](https://github.com/jamjet-labs/engram/tree/main/training/cross_encoder). If you build on this work, please don't repeat our mistake; use the negative result as a starting point.

## Honest closing

We are not on the LongMemEval leaderboard frontier. We are at 68% on a 100-question subset; AgentMemory reports 96.2% on the full set. The gap is real, the documented follow-up work is real, and we'd rather publish the +4pp number with the five negative results than pretend they didn't happen.

If you have ideas for the calibration problems above, [open an issue](https://github.com/jamjet-labs/engram/issues) — especially if you've solved the verifier-overcorrects problem in another agent stack.
