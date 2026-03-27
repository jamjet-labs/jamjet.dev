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
