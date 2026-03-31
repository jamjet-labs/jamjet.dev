---
title: "Every Major AI Agent Failure Has the Same Root Cause"
date: 2026-03-28
description: "Klarna, Air Canada, DPD — sourced post-mortems of real AI agent failures. The pattern is always the same: prototype infrastructure in production. Named companies, real timelines, avoidable lessons."
author: "Sunil Prakash"
draft: false
category: "Strategy & Vision"
---

# Every Major AI Agent Failure Has the Same Root Cause — And It's Not the AI

*This is not a scare piece. Every incident in this article is public, sourced, and named. The pattern they share is not that AI is unreliable — it is that prototype infrastructure was deployed in production. No guardrails. No human escalation. No audit trail. Every one of these failures was avoidable.*

In our [companion article](/blog/competitors-already-deploying-ai-agents/), we documented what the leaders are doing — Goldman Sachs, Morgan Stanley, JPMorgan, Lemonade. Billions invested. Real results. But for every Goldman deploying agents with six months of embedded engineering, there is a company that shipped an AI agent with no guardrails and learned the lesson in public.

A fintech CEO who admitted on Bloomberg that cost was "a too predominant evaluation factor." An airline that lost a tribunal case because its chatbot fabricated a refund policy. A parcel delivery company whose chatbot swore at a customer and wrote a poem criticizing the company — on a live customer chat.

These are not stories about AI being bad. They are stories about infrastructure being absent. And they share the same root cause.

![Incident board showing the three anchor AI agent failure cases — Klarna, Air Canada, DPD — each with failure summary and infrastructure gap tag](/blog/failures-incident-board.svg)

---

## Case 1: Klarna — when cost replaces quality as the metric

In January 2024, Klarna launched an AI assistant built on GPT-4 across 23 markets and 35+ languages. The initial numbers were the kind every executive wants to see:

- **2.3 million conversations** handled in the first month
- **Two-thirds of all customer service chats** handled by AI
- Resolution time dropped from **11 minutes to under 2 minutes**
- **25% drop** in repeat inquiries
- Projected **$40 million** profit improvement for 2024

Klarna reduced headcount from roughly 5,500 to 3,400, primarily through attrition and a hiring freeze. The AI agent was doing the work. The numbers proved it.

([Source: Klarna press release, February 2024](https://www.klarna.com/international/press/klarna-ai-assistant-handles-two-thirds-of-customer-service-chats-in-its-first-month/))

Then quality caught up.

In May 2025 — shortly after a successful US IPO — CEO Sebastian Siemiatkowski publicly admitted the AI push went too far. His words to Bloomberg:

> *"As cost unfortunately seems to have been a too predominant evaluation factor when organizing this, what you end up having is lower quality."*

Customer satisfaction dropped. Customers complained of generic, repetitive responses for complex issues. Forrester analyst Kate Leggett summarized it: *"They overpivoted to cost containment, without thinking about the longer-term impact of customer experience."*

Klarna reversed course. They began rehiring human agents and moved to a hybrid model — AI handles routine queries, humans handle complex and sensitive cases.

([Source: Bloomberg, May 2025](https://www.bloomberg.com/news/articles/2025-05-08/klarna-turns-from-ai-to-real-person-customer-service); [Fortune, May 2025](https://fortune.com/2025/05/09/klarna-ai-humans-return-on-investment/))

**The root cause was not the AI.** The AI still handles roughly two-thirds of Klarna's chats today. The root cause was the operating model: no quality monitoring loop, no human escalation path designed into the system, and cost metrics that replaced quality metrics entirely. When the only number you optimize is cost, quality becomes the thing you discover you lost — after your customers already noticed.

![Klarna failure analysis — what actually happened vs. what production infrastructure looks like: no quality gate or escalation path on the left, confidence scoring and human escalation on the right](/blog/failures-klarna-flow.svg)

---

## Case 2: Air Canada — when the chatbot makes promises you cannot keep

In late 2022, Air Canada deployed a chatbot on its customer support page. A passenger named Jake Moffatt was looking for information about bereavement fares — discounted tickets for people traveling due to a family member's death.

The chatbot told Moffatt he could book a full-price ticket and apply for a bereavement discount retroactively within 90 days. This was clear, specific, and wrong. No such policy existed.

Moffatt booked the ticket. He flew to the funeral. He applied for the bereavement rate. Air Canada denied the request and told him the chatbot had been incorrect — he should have checked the actual policy page on the website.

Moffatt filed a complaint with the Civil Resolution Tribunal of British Columbia. Air Canada's defense was remarkable: they argued the chatbot was a "separate legal entity" responsible for its own actions, and that the airline could not be held liable for what it said.

The tribunal rejected this entirely. In its February 2024 ruling, tribunal member Christopher Rivers wrote that Air Canada "does not explain why the webpage titled 'Bereavement travel' should be trusted over its chatbot." The airline was responsible for **all information on its website**, including information provided by its chatbot.

Air Canada was ordered to pay Moffatt approximately $812 in damages and tribunal fees — a small financial penalty but a precedent with enormous implications.

([Source: Civil Resolution Tribunal of BC, Moffatt v. Air Canada, Feb 2024](https://decisions.civilresolutionbc.ca/crt/crtd/en/item/521133/index.do); [The Verge, Feb 2024](https://www.theverge.com/2024/2/15/24074791/air-canada-chatbot-mangled-refund-policy-lawsuit); [BBC, Feb 2024](https://www.bbc.com/travel/article/20240222-air-canada-chatbot-))

**The root cause was not hallucination itself** — large language models hallucinate. That is a known behavior. The root cause was that Air Canada deployed an LLM with no source grounding, no content boundaries, no fallback to a human agent, and no audit trail of what it told customers. The chatbot was not constrained to answer from verified policy documents. It generated responses from its training data and presented them with the same confidence as verified information.

The legal precedent is the part executives should remember: **your chatbot's statements are your company's statements.** Without guardrails and an audit trail, every AI-generated response is an unreviewed legal commitment your organization is responsible for.

![Air Canada failure analysis — hallucinated response with no record vs. production infrastructure with source grounding, confidence checks, and human fallback](/blog/failures-aircanada-flow.svg)

---

## Case 3: DPD — when the chatbot turns on you

In January 2024, DPD — one of the UK's largest parcel delivery companies — updated their customer service chatbot with a new AI model. What happened next became one of the most shared AI fails of the year.

A customer named Ashley Beauchamp, frustrated after receiving unhelpful responses about a missing parcel, discovered that the chatbot had no content boundaries. He prompted it to go off-script. The chatbot complied:

- It **swore at the customer** using explicit language
- It called itself **"useless" and "unable to help anyone"**
- It wrote a **poem criticizing DPD**
- It **recommended competitor delivery services**

Beauchamp posted the screenshots on social media. They went viral — millions of views within hours. Every major UK news outlet covered it. DPD immediately disabled the AI component of the chatbot and reverted to their older scripted system.

A DPD spokesperson confirmed it was "an error" following a system update and that the AI element had been disabled "as a precaution."

([Source: The Guardian, January 2024](https://www.theguardian.com/technology/2024/jan/20/dpd-ai-chatbot-swears-at-customer-calling-itself-useless); [BBC, January 2024](https://www.bbc.co.uk/news/technology-68025677))

**The root cause is almost too simple:** no output guardrails. No content boundary enforcement. No adversarial testing before deployment. No real-time monitoring that could catch a chatbot going off-script before screenshots end up on social media.

The technical fix — output filtering, topic boundaries, a list of things the chatbot must never say — would take a developer hours to implement. DPD shipped without it. The brand damage was instant, global, and permanent in search results. This is the cost of treating deployment as "connect the model and go live."

![DPD failure story — three panels showing the chatbot exchange, viral spread, and what production infrastructure would have prevented](/blog/failures-dpd-panels.svg)

---

## It keeps happening

The three cases above are the most instructive, but they are not isolated. Here are four more — all public, all sourced, all sharing the same root cause.

| Company | What Happened | Infrastructure Gap | Source |
|---------|--------------|-------------------|--------|
| **NYC MyCity Chatbot** (2024) | The city's official AI chatbot told business owners they could legally discriminate based on source of income, serve food containing rodent droppings, and take worker tips. Every answer was wrong — and delivered with confidence. | No source grounding. No content boundaries. No human review of outputs. | [The Markup, Mar 2024](https://themarkup.org/news/2024/03/29/nycs-ai-chatbot-told-businesses-to-break-the-law) |
| **Chevrolet Dealership** (2023) | A Chevy dealer's ChatGPT-powered chatbot agreed to sell a brand-new Chevrolet Tahoe for $1 after a customer asked creatively. The chatbot confirmed: "That's a deal, and I'll hold you to it." | No transaction guardrails. No output constraints. No escalation for financial commitments. | [Business Insider, Dec 2023](https://www.businessinsider.com/chatgpt-chevrolet-dealer-chatbot-tricked-into-selling-car-for-1-2023-12) |
| **Samsung** (2023) | Samsung engineers pasted proprietary semiconductor source code and confidential meeting notes into ChatGPT for debugging and summarization. The data was sent to OpenAI's servers. Samsung banned all generative AI tools internally within weeks. | No data loss prevention. No input filtering. No boundary between internal data and external services. | [TechCrunch, May 2023](https://techcrunch.com/2023/05/02/samsung-bans-use-of-generative-ai-tools-like-chatgpt-after-internal-data-leak/) |
| **Lawyer cites fake cases** (2023) | New York attorney Steven Schwartz used ChatGPT for legal research and submitted a court brief containing six completely fabricated case citations. The cases did not exist. The court sanctioned Schwartz and his firm. | No hallucination verification. No human review gate. No source validation before submission. | [NY Times, Jun 2023](https://www.nytimes.com/2023/06/08/nyregion/lawyer-chatgpt-sanctions.html) |

![Wall of incidents — AI agent failure cases with infrastructure gap tags](/blog/failures-wall-of-incidents.svg)

## The pattern

Every failure in this article — seven companies, four countries, billions of dollars in collective market cap — shares the same root cause.

It is not that the AI was bad. In most of these cases, the AI was doing exactly what it was designed to do: generate plausible-sounding responses. The failures happened because **prototype-grade infrastructure was deployed in production.**

No guardrails to constrain outputs. No human escalation when confidence was low. No audit trail to record what was said. No content boundaries to keep the system on-topic. No quality monitoring to catch degradation before customers did.

These are not AI problems. They are engineering problems with known solutions. The organizations in our [companion article](/blog/competitors-already-deploying-ai-agents/) — Goldman Sachs, Morgan Stanley, JPMorgan — solved them. They just spent six months and millions of dollars doing it.

![Root cause tree — the shared infrastructure gaps behind every AI agent failure, mapped to each company](/blog/failures-root-cause-tree.svg)

---

## What failed vs. what production infrastructure provides

Every failure maps to a specific infrastructure capability that was absent. Here is the complete picture:

| What Failed | What Production Infrastructure Provides | Which Cases |
|------------|----------------------------------------|-------------|
| AI hallucinated confidently | **Source grounding** — responses constrained to verified documents only | Air Canada, NYC, Lawyer |
| No human could intervene | **Human-in-the-loop** as a first-class workflow step, not a bolt-on | Klarna, DPD |
| No record of what was said | **Automatic audit trail** — every input, output, and decision logged | Air Canada, Samsung |
| Output went off-script | **Output guardrails** and content boundary enforcement | DPD, Chevy, NYC |
| Quality degraded silently | **Quality monitoring loop** — metrics beyond cost | Klarna |
| Failure was total, not graceful | **Durable execution** — crash recovery, partial progress preserved | All |

![Demo infrastructure vs. production infrastructure — side-by-side comparison of a fragile pipeline versus an instrumented, resilient one](/blog/failures-demo-vs-production.svg)

These capabilities are not novel. The organizations in our [companion article](/blog/competitors-already-deploying-ai-agents/) — Goldman Sachs, Morgan Stanley, JPMorgan — built them internally. Goldman embedded Anthropic engineers for six months. JPMorgan has 2,000+ AI/ML specialists and an $18 billion technology budget. The infrastructure requirements are the same regardless of budget. The question for most teams is not whether they need these capabilities, but how to get them without a multi-year internal build.

This is why we built [JamJet](/) — an open-source runtime (Apache 2.0) that provides event-sourced durability, automatic audit trails, first-class human-in-the-loop, model-agnostic execution, and native MCP + A2A protocol support. Rust core for performance. Python and Java authoring surface for accessibility. The goal: make the infrastructure patterns the leaders share available without requiring their budgets.

Every failure in this article was avoidable. The engineering is known. The patterns are proven. The only question is whether your organization builds on production infrastructure from the start — or discovers, like Klarna and Air Canada, what happens when you don't.

- [What your competitors are already doing →](/blog/competitors-already-deploying-ai-agents/)
- [The operational gap is compounding — why starting now matters →](/blog/companies-quietly-replacing-workflows/)
- [The business case for AI agents →](/blog/ai-agents-business-case/)
- [Multi-agent wealth management architecture →](/blog/wealth-management-multi-agent/)
- [Try JamJet — `pip install jamjet` →](https://github.com/jamjet-labs/jamjet)
- [Read the docs →](https://docs.jamjet.dev)
- [Join the community →](https://discord.gg/jamjet)
