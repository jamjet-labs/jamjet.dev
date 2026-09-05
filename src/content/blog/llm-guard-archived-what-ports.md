---
title: "llm-guard Is Archived. What Ports and What You Lose."
date: 2026-09-05
description: "protectai/llm-guard was archived in July 2026 and its models went with it. A scanner-by-scanner map of what reproduces in a zero-dependency library, what degrades, and the 23 scanners that nothing here replaces."
author: "Sunil Prakash"
category: "Guide"
---

# llm-guard Is Archived. What Ports and What You Lose.

[protectai/llm-guard](https://github.com/protectai/llm-guard) is archived. Its last release, 0.3.16, went to [PyPI](https://pypi.org/project/llm-guard/) on 19 May 2025, and the repository stopped taking commits in July 2026. If you are running it today it still works, and it will keep working until something in your dependency tree moves and nobody is there to fix it.

The second half matters more than the first. The archive notice covers the models as well as the code: "This project and its associated models on Hugging Face are no longer under active development or maintained." The default weights for `PromptInjection` and `NoRefusal` live on that account, and so do the ONNX builds that `use_onnx=True` fetches for `BanCode`, `BanCompetitors`, `BanTopics`, `Language`, `Toxicity`, `Bias` and `MaliciousURLs`. An archived scanner is a maintenance problem. An unmaintained classifier sitting in front of user input is a different kind of problem.

I spent a while mapping every scanner in that final release onto [jamjet-guardrails](https://github.com/jamjet-labs/jamjet-guardrails), a zero-dependency library of deterministic checks. The full table is in the repository, one row per scanner, marked `mapped`, `partial` or `gap`. This post is the shape of it.

## There is no coverage percentage in this, and there should not be

Six of thirty-seven is not a coverage figure. The scanners are not interchangeable units, and dividing them pretends they are.

Here is the arithmetic instead. llm-guard 0.3.16 exports **37 scanner classes**, 15 on the input side and 22 on the output side. Of those, **23 are a model making a judgment about meaning, and 14 are not**. Six map cleanly, nine are partial, and 22 are gaps.

The count itself is contested, so it is worth saying which one I used. Exported classes at the final PyPI release gives 37. Scanner modules at that tag gives 36, because `output_scanners/no_refusal.py` exports two classes. The archived `main` branch gives 38, since it carries twelve commits past the tag including an `EmotionDetection` scanner that never shipped. The documentation navigation gives 35. All four are defensible and none of them agree. I counted `__all__` at the tag.

## What you lose, first

A migration guide that only listed wins would be worth exactly as much as its first checkable row.

**Twenty-three scanners are a classifier and nothing here replaces them.** `PromptInjection`, `Toxicity`, `BanTopics`, `Gibberish`, `Bias`, `FactualConsistency`, `Relevance`, `NoRefusal`, `Language`, `LanguageSame`, `MaliciousURLs`, `BanCode`, `Code`, `BanCompetitors`, and the NER half of `Anonymize` and `Sensitive`. If a model's judgment was what you were buying, keep buying it somewhere. The honest migration for those is to a maintained model, not to a library that classifies nothing.

**No regular expression finds a person's name.** `Anonymize` and `Sensitive` run Presidio with a DeBERTa NER model behind them, which is how they catch `PERSON`, `LOCATION` and `ORGANIZATION`. Four regex types do not do that. Names are the concrete loss and there is no way to dress it up.

**Redaction is one way.** There is no `Vault` and no `Deanonymize`. A placeholder cannot be turned back into the value it replaced. That is a design decision rather than a missing feature, but if you were restoring values downstream, it is a rewrite.

**Secrets detection is narrower on purpose.** Seven prefix-anchored families against llm-guard's 110 configured detect-secrets plugins, several of which are entropy detectors. The anchoring is why a precision figure can be published at all, and it is also why `github_pat_` and `xapp-` are named as known misses rather than quietly absent.

**Nothing counts tokens and nothing opens a socket.** `TokenLimit` counts tiktoken tokens; the replacement counts characters, bytes and lines, and will not estimate a token count from them. `URLReachability` fetches every URL in a reply, and there is no equivalent because no check here makes a network call.

## The install is the whole argument

llm-guard declares these as unconditional runtime dependencies at 0.3.16, not as extras: torch, transformers, both halves of Presidio, NLTK, tiktoken, detect-secrets, faker, fuzzysearch, json-repair, regex and structlog.

Torch and transformers install whether or not you ever construct a scanner that uses them. Somebody who only ever ran `BanSubstrings`, which is a case-insensitive substring match with no model and no data file, still installed torch.

jamjet-guardrails declares zero runtime dependencies, and that sentence is checked against the built distribution metadata rather than against `pyproject.toml`, so a dependency added later fails the build instead of the claim going quietly out of date.

## What the 14 model-free scanners buy you

Eleven of the fourteen need no model file and no data file at all. Two need an NLTK lexicon and one needs a tiktoken encoding. Every one of the six `mapped` rows is a model-free scanner, and no model-backed scanner is mapped, because mapping one would mean shipping a model.

Moving those buys four things llm-guard did not offer for any scanner:

- **Typed findings with exact spans.** An llm-guard scanner returns `(text, is_valid, risk_score)`: a float, with no finding type and no position. Every verdict here carries typed findings with character spans, so a redaction can be applied and an audit record can say what was removed from where.
- **Published precision and recall per check**, measured on a committed corpus and gated in CI, with the misses named by case id. llm-guard published latency benchmarks, not accuracy per scanner.
- **A written porting contract.** The verdict fields, the combination order and the corpus schema are specified, so an implementation in another language can be graded against the same corpora.
- **Zero dependencies.** Same sentence as above, worth repeating once.

Most of the migration collapses into one call:

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

`patterns` replaces `Regex`, `banned` replaces `BanSubstrings` and `BanCompetitors`, and `limits` replaces `TokenLimit` and `ReadingTime` in a unit you can count.

## Guardrails AI is a different situation, and the two get confused

These two get mentioned in the same breath and should not be.

[guardrails-ai/guardrails](https://github.com/guardrails-ai/guardrails) is **not archived and is actively developed**. What changed there is distribution. On 25 August 2026 the `guardrails hub install` path, the private validator registry behind it and the hosted remote inference were shut down, and validators became plain PyPI packages you install with `pip`. The catalogue still resolves. The canonical statement is [HUB_UPDATE.md](https://github.com/guardrails-ai/guardrails/blob/main/HUB_UPDATE.md) in that repository.

One library stopped. The other changed how you install things. They are unrelated in kind, and they land on the same people at the same time, which is why they keep getting grouped.

If you are on Guardrails AI you do not need to migrate anything. `jamjet-guardrails-validators` is an ordinary pip install that gives you these checks as validators inside the `Guard` you already have. There is a NeMo Guardrails adapter on the same terms.

## The caveat you should hold me to

Eight of the nine checks are measured on corpora written for this library and are self-graded. Only the PII check has a third-party corpus behind it, derived from `nvidia/Nemotron-PII`. I looked for compatibly licensed external corpora for the other eight and did not find any that survived the licence screen, and the table of what failed and why ships in the repository.

Self-graded numbers are worth less than independent ones. They are worth more than no numbers, which is what most of this category ships, and the corpora are committed so you can disagree with a label rather than with a marketing claim.

## Where the rest is

The [full scanner table](https://github.com/jamjet-labs/jamjet-guardrails/blob/main/docs/migrating-from-llm-guard.md) has one row per scanner with the difference named in a sentence, the 28 `NoRefusalLight` phrases in full so you can carry them over, and the sources for everything above read from the source tree at the tag rather than from documentation prose.

```
pip install jamjet-guardrails
```

If a `gap` row is one you want closed, the contribution path is a check in about twenty lines with the same corpus machinery behind it.
