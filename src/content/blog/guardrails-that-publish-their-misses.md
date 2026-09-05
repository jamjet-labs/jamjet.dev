---
title: "A Guardrails Library That Publishes Its Misses"
date: 2026-09-05
description: "jamjet-guardrails is nine deterministic checks for LLM input and output with zero runtime dependencies. Every check ships a precision and recall figure measured on a committed corpus and gated in CI, and the wrong decisions it is known to make are named by case id."
author: "Sunil Prakash"
category: "Build log"
---

# A Guardrails Library That Publishes Its Misses

Ask a guardrails library how often it is wrong and you will usually get silence, or a benchmark of how fast it is.

That is the gap [jamjet-guardrails](https://github.com/jamjet-labs/jamjet-guardrails) was built into. Nine deterministic checks for LLM input and output, zero runtime dependencies, and a published precision and recall figure for every one of them, measured on a corpus committed to the repository and gated in CI so a change that moves a number fails the build.

The part I care about more: the cases it gets wrong are named, in the README, by case id.

## The problem with a float

A typical scanner hands back something like `(text, is_valid, 0.83)`. A boolean and a score. It does not tell you what it found, or where.

That is enough to block a request and not enough to do anything else. You cannot redact, because you do not know which characters to replace. You cannot write a useful audit record, because "risk 0.83" is not a fact about what happened. And you cannot tune it, because a threshold is not a description.

Every verdict here carries typed findings with character spans:

```py
from jamjet_guardrails import Context, Limits, build

guard = build(
    "rules",
    patterns={"TICKET_ID": r"\bJIRA-\d{4,}\b"},
    banned={"COMPETITOR": ("northwind", "initech")},
    limits=Limits(max_chars=20_000),
    on_match="deny",
)
guard.check("see JIRA-1234", Context(direction="input", origin="user"))
```

That returns a deny with a `TICKET_ID` finding carrying a span, so a redaction can be applied and an audit line can say what was removed from where. Every check also declares which directions it applies to, because a rule that makes sense on a model's output often does not on a user's input.

## Nine checks, no dependencies

| Check | What it catches |
|---|---|
| `injection-structural` | instructions hidden in the encoding rather than the words |
| `encoded-content` | instructions, credentials and structure one encoding layer down |
| `url-exfiltration` | URLs that carry data out rather than fetch something in |
| `template-integrity` | content claiming a conversational role it does not have |
| `confusables` | words that read as one script and are written in two |
| `script-constraint` | text in a script your deployment did not ask for |
| `pii` | personal data, redacted to typed placeholders |
| `secrets` | credentials, matched on their issuer prefix |
| `rules` | whatever you define |

`dependencies = []`, and that is checked against the built distribution metadata rather than against `pyproject.toml`, so adding one fails the build instead of the claim going quietly out of date.

## The numbers, and why some of them are low

| Check | Corpus | Cases | Precision | Recall |
|---|---|---:|---:|---:|
| `rules` | in-repo | 42 | 1.000 | 1.000 |
| `encoded-content` | in-repo | 81 | 1.000 | 0.875 |
| `injection-structural` | in-repo | 154 | 0.972 | 0.873 |
| `script-constraint` | in-repo | 85 | 0.960 | 0.980 |
| `pii` | nvidia/Nemotron-PII | 300 | 0.960 | 0.997 |
| `confusables` | in-repo | 115 | 0.942 | 0.891 |
| `url-exfiltration` | in-repo | 94 | 0.923 | 0.923 |
| `secrets` | in-repo | 160 | 0.881 | 0.873 |
| `template-integrity` | in-repo | 152 | 0.820 | 0.965 |
| `pii` | in-repo | 81 | 0.631 | 0.872 |

Look at the bottom row. The in-repo PII corpus scores 0.631 precision, and it is published at the top of the README next to the others.

It is low on purpose. Every corpus here labels a case with **what should happen, never with what the detector does**. A known false positive is labelled `allow` and costs precision. A known false negative is labelled `deny` and costs recall. So each corpus is a stress set holding the shapes its detector is worst at, and the numbers come out lower than the checks behave on ordinary text.

That is the only way two rows in one table can be compared, and it is the difference between a measurement and a marketing figure. A corpus labelled with what the detector already does will score near 1.000 forever and tell you nothing.

The third-party row is the one to read for ordinary traffic: 300 rows we did not write, from `nvidia/Nemotron-PII`, scoring 0.960 and 0.997 with the source named beside its own numbers.

## Four misses, named

The `secrets` check matches credentials on their issuer prefix rather than by scoring entropy, which is what makes its precision defensible and what keeps it off your git SHAs and UUIDs. It also means it misses things, so the README names four rather than leaving you to find them:

`github_pat_` fine-grained tokens, `xapp-` Slack app-level tokens and `xoxe-` Slack refresh tokens are not among the matched prefixes and pass through untouched. And a JWT whose `eyJ` header runs past the check's 4096-character bound matches nothing at all rather than matching short.

All four are cases in the corpus. They cost recall in the row above rather than being quietly excluded, and each is named by case id in the corpus notice. Latency is treated the same way, with p50, p95 and p99 per check from 1 KB to 1 MB, the machine and interpreter named and the command that reproduces them.

## What it does not do

It does not score toxicity and it does not call a model. Nothing downloads weights or reaches the network.

Where a check judges what content is for, as `encoded-content` does when it separates a hidden instruction from hidden prose, it uses a lexicon you can read and a rule you can test rather than a classifier. That sentence used to say the library does not classify intent at all, which was wrong from the day that check shipped, and it is fixed as of 0.4.1.

No regular expression finds a person's name, so there is no NER and no vault to restore a redaction from. If a model's judgment is what you need, this is not that, and the honest answer is to buy it somewhere maintained.

## The caveat you should hold me to

Eight of the nine checks are measured on corpora written for this library and are self-graded. Only `pii` has a third-party corpus behind it. I looked for compatibly licensed external corpora for the other eight and none survived the licence screen, and the table of what failed and why ships in the repository.

Self-graded numbers are worth less than independent ones. They are worth more than no numbers, which is what most of this category ships, and the corpora are committed so you can disagree with a label rather than with a claim.

## Why this arrived now

Two things moved this year and they get confused, so worth separating.

[protectai/llm-guard](https://github.com/protectai/llm-guard) is archived, and the notice covers its Hugging Face models as well as its code. Its final release was May 2025. An archived library is a maintenance problem; an unmaintained classifier sitting in front of user input is a different kind of problem. If you are on it, there is a [scanner-by-scanner migration guide](https://github.com/jamjet-labs/jamjet-guardrails/blob/main/docs/migrating-from-llm-guard.md) covering all 37 classes in that release, marked mapped, partial or gap, and it leads with the 23 that are a classifier and are not replaced here.

[guardrails-ai/guardrails](https://github.com/guardrails-ai/guardrails) is a different situation and should not be grouped with it. It is **not archived and is actively developed**. What changed is distribution: the hub install path, the private validator registry and the hosted remote inference closed in August 2026, and validators became plain PyPI packages. If you are there you do not need to migrate anything, because `jamjet-guardrails-validators` is an ordinary pip install that gives you these checks inside the `Guard` you already have. There is a NeMo Guardrails adapter on the same terms.

## Install

```
pip install jamjet-guardrails
```

Apache-2.0, Python 3.10 to 3.13, no dependencies. The [porting contract](https://github.com/jamjet-labs/jamjet-guardrails/blob/main/docs/conformance.md) specifies the verdict fields, the combination order and the corpus schema, so an implementation in another language can be graded against the same corpora.

If a check you need is missing, adding one is about twenty lines against the same corpus machinery, and the row it publishes has to pass the same gate as every row above.
