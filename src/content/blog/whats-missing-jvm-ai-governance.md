---
title: "What's Missing in JVM AI: Governance and Budget Enforcement"
date: 2026-06-07
description: "Java got serious about AI observability this year. Governance is a different story: the frameworks ship interception hooks, not a safety layer, and nobody enforces a budget."
author: "Sunil Prakash"
category: "Perspective"
---

# What's Missing in JVM AI: Governance and Budget Enforcement

## TL;DR

If you build AI apps on the JVM today, observability is largely handled. Spring AI emits OpenTelemetry GenAI metrics out of the box, the Quarkus LangChain4j extension wires up tracing and metrics with no config, and anything OTLP-compatible (Langfuse included) receives the data. Governance is the opposite. The frameworks give you interception points, not a safety layer: LangChain4j guardrails are still beta with two built-in implementations, Spring AI's advisors are a substrate you build on, and as far as I can find, no flagship JVM framework ships cost or budget enforcement, audit trails, PII redaction, content moderation, or human-in-the-loop out of the box. You can watch what your agent does. Stopping it from doing the wrong thing is still your code.

## Two halves, two very different maturities

"Observability" and "governance" get bundled together in pitches, but on the JVM in mid-2026 they are in completely different places. One has converged on a standard and shipped GA. The other is a set of extension hooks waiting for someone to build on them. Worth separating.

## Observability: largely a solved problem

Spring AI reached 1.1 GA in November 2025, and its observability is production-ready and built on Micrometer plus Spring Boot Actuator. It captures token usage and latency and aligns with the [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/), emitting attributes like `gen_ai.operation.name`, `gen_ai.system`, request and response model names, and the `gen_ai.client.token.usage` metric. The details are in the [Spring AI observability docs](https://docs.spring.io/spring-ai/reference/observability/index.html).

Quarkus comes at it from the other direction. The [Quarkus LangChain4j observability docs](https://docs.quarkiverse.io/quarkus-langchain4j/dev/observability.html) describe traces that appear automatically when `quarkus-opentelemetry` is on the classpath (spans named `langchain4j.aiservices.$interface.$method` and `langchain4j.tools.$tool`), Micrometer metrics when `quarkus-micrometer` is present, and a Langfuse DevServices that spins up a local Langfuse instance in dev and test with no manual setup.

The backends are reached through standard OpenTelemetry export rather than a bespoke Java tracing SDK. Langfuse, for example, [receives traces on its OTLP endpoint](https://langfuse.com/integrations/native/opentelemetry); the `langfuse-java` package is a REST API client, not a tracing SDK, so OTLP is the path that records spans from the JVM.

One honest caveat: the standard underneath all this is not finished. The OpenTelemetry GenAI conventions are still in "Development" status, and every metric they define currently carries a Development badge. The core dimensions (token usage, latency) are covered and stable enough to build on, but attribute and metric names can still move. So "solved" means the wiring is GA and adopted, not that the spec is frozen.

## Governance: hooks, not a layer

Now the other half. The frameworks give you good places to intervene. They do not give you much that intervenes.

**Spring AI advisors** are the interception substrate. The [advisors API](https://docs.spring.io/spring-ai/reference/api/advisors.html) lets you examine and modify a prompt, block a request by not calling the next entity in the chain, inspect the response, and throw. Advisors also show up in the observability stack, so you can trace their execution. This is a clean extensibility point, and you can host PII redaction or a policy check inside one. But it is a mechanism, not a feature set. The one built-in with a safety-sounding name, `SafeGuardAdvisor`, has no documented content-safety implementation behind it.

**LangChain4j guardrails** are the closest thing to a dedicated safety feature, and they are genuinely useful: input guardrails run before the model (scope checks, prompt-injection prevention), output guardrails run after (JSON and schema validation, business rules, hallucination checks). The Quarkus LangChain4j workshop even [demonstrates a prompt-injection guardrail](https://quarkus.io/quarkus-workshop-langchain4j/section-1/step-09/) that fails the call when an injection-likelihood score crosses a threshold. The API is real and merged, not blog-only.

The gap is what they ship versus what you have to write. The [guardrails documentation](https://docs.langchain4j.dev/tutorials/guardrails/) opens by calling the feature experimental, the dedicated module is published only in a parallel beta line (no GA release as of June 2026 while core LangChain4j hit 1.0 a year earlier), and the library ships essentially two concrete guardrails: a moderation guardrail that delegates to an external moderation model, and a JSON extractor. The maintainers' own [Common Guardrails Library issue (#3248)](https://github.com/langchain4j/langchain4j/issues/3248) puts it plainly: even basic guardrails like prompt-injection detection or PII masking require custom implementation. That issue is open and unbuilt.

## What nobody ships

Stack up the things a team actually needs before putting an agent in front of users or a budget, and look for the out-of-box implementation on the JVM:

- **Cost and budget enforcement.** Observability tracks token usage and latency. It does not track spend, and nothing stops a runaway agent at a dollar limit.
- **Audit trails.** A durable, queryable record of what was asked, what was returned, and what was blocked.
- **PII redaction.** A built-in that strips or masks sensitive data on the way in or out.
- **Content moderation.** More than a hook to call your own moderation model.
- **Human-in-the-loop.** A first-class pause-for-approval step on a risky action.

I want to be careful here. Part of this is absence of evidence rather than documented absence: I am reporting what the flagship frameworks' docs and sources describe, and the safety layer is largely left to the developer. There are early third-party attempts and plenty of blog posts wiring these patterns by hand. What there is not, as far as I can find, is a batteries-included governance layer that a Java team can add and get enforcement from on day one.

## Why budget enforcement is the sharpest gap

Of that list, budget enforcement is the one I keep coming back to, because the asymmetry is so stark. The JVM can now *observe* token usage almost everywhere. The `gen_ai.client.token.usage` metric is standardized, emitted by Spring AI, and scraped into Prometheus and Grafana across the ecosystem. And yet nothing *enforces* a budget. You can build a beautiful dashboard of exactly how much an agent spent overrunning its limit last night. Observability without enforcement is a smoke detector with no sprinkler.

That asymmetry is the tell. When a metric is standardized and adopted but the control that should sit next to it does not exist, that is not a niche left empty by lack of demand. It is a layer the ecosystem has not gotten to yet.

## What this means

The takeaway is not that Spring AI or LangChain4j are behind. They have done the hard, correct work of standardizing observation and giving you clean interception points, and on a fast timeline. The takeaway is that the JVM AI stack has a well-built floor and is missing a wall. Observation is a solved, standardized, GA problem you should simply adopt. Governance is a real gap, and budget enforcement is its sharpest edge.

If you are shipping agents on the JVM, the practical implication is to lean on the standard for observability (emit OTel GenAI, point it at whatever backend you like) and budget real engineering time for the governance layer you will have to assemble yourself, because the framework will hand you the hook and not much else.

---

*Disclosure: I work on [JamJet](https://jamjet.dev), which builds a governance and policy layer (including budget enforcement and audit) plus a memory system for AI agents, so I have a stake in this part of the stack. This post is meant as an objective read of the JVM landscape, and the claims are sourced above so you can check them yourself.*

## Sources

- Spring AI observability: https://docs.spring.io/spring-ai/reference/observability/index.html
- Spring AI 1.1 GA: https://spring.io/blog/2025/11/12/spring-ai-1-1-GA-released/
- Spring AI advisors: https://docs.spring.io/spring-ai/reference/api/advisors.html
- LangChain4j guardrails: https://docs.langchain4j.dev/tutorials/guardrails/
- LangChain4j Common Guardrails Library (issue #3248): https://github.com/langchain4j/langchain4j/issues/3248
- Quarkus LangChain4j observability: https://docs.quarkiverse.io/quarkus-langchain4j/dev/observability.html
- Quarkus LangChain4j prompt-injection guardrail (workshop): https://quarkus.io/quarkus-workshop-langchain4j/section-1/step-09/
- Langfuse over OpenTelemetry: https://langfuse.com/integrations/native/opentelemetry
- OpenTelemetry GenAI semantic conventions: https://opentelemetry.io/docs/specs/semconv/gen-ai/
