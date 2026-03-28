---
title: "What Your Competitors Are Already Doing With AI Agents"
date: 2026-03-25
description: "Named companies, real metrics, sourced data. How finance, legal, support, and insurance deploy AI agents in production — and what it means if you haven't started."
author: "Sunil Prakash"
draft: false
category: "Strategy & Vision"
---

# What Your Competitors Are Already Doing With AI Agents — And Why the Gap Is Widening

*This is not a trend piece. Every number in this article is sourced. Every company is named. The evidence points to a single conclusion: the moat is not access to models. It is the ability to redesign workflows, keep humans at the right boundary, and run agents reliably enough that the organization actually learns.*

In February 2026, Goldman Sachs announced that autonomous AI agents — built on Anthropic's Claude — are now doing trade accounting, compliance work, and client onboarding at the firm. Not as a pilot. Not in a sandbox. Anthropic engineers spent six months embedded at Goldman co-developing the systems. Internal tests showed 30% faster client onboarding and over 20% developer productivity gains.

Goldman's CTO framed the move carefully: these agents are "digital co-workers" designed to limit future headcount growth, not replace existing staff. But the subtext is hard to miss. One of the most sophisticated financial institutions in the world looked at AI agents and decided they were ready for production — in accounting and compliance, two of the most regulated functions in any enterprise.

([Source: CNBC, February 2026](https://www.cnbc.com/2026/02/06/anthropic-goldman-sachs-ai-model-accounting.html))

The advantage Goldman is building is not about having access to Claude. Every company can license a frontier model. Their advantage is operational: they spent six months redesigning workflows around agents, they kept human oversight on every critical decision, and they built the infrastructure for the organization to learn from every run. That is the pattern this article documents — across finance, legal, support, and insurance.

---

## The scale of what is already happening

The numbers across industries tell a consistent story:

| Signal | Number | Source |
|--------|--------|--------|
| JPMorgan's annual AI investment | $2 billion | [CNBC, Sep 2025](https://www.cnbc.com/2025/09/30/jpmorgan-chase-fully-ai-connected-megabank.html) |
| JPMorgan AI use cases in production | 450+ | [Tearsheet](https://tearsheet.co/artificial-intelligence/jpmorgan-chases-gen-ai-implementation-450-use-cases-and-lessons-learned/) |
| Harvey AI's annual recurring revenue | ~$190 million | [Sacra](https://sacra.com/c/harvey/) |
| Lawyers using Harvey AI | 100,000+ | [Harvey blog](https://www.harvey.ai/blog/cms-expands-use-of-harvey-firmwide-across-50-countries) |
| Salesforce Agentforce ARR | $1.4 billion | [Futurum Group, Q3 FY2026](https://futurumgroup.com/insights/salesforce-q3-fy-2026-ai-agents-data-360-lift-bookings-and-fy26-outlook/) |
| McKinsey: AI revenue unlock in insurance | $50–70 billion | [McKinsey, Feb 2026](https://www.mckinsey.com/industries/financial-services/our-insights/ai-in-insurance-understanding-the-implications-for-investors) |

These are not projections. They are measurements. But the more interesting question is not *whether* organizations are deploying agents — it is what separates the ones getting durable results from the ones generating press releases. That is what the case studies below reveal.

![Timeline of major AI agent deployments across industries, 2023–2026, showing accelerating adoption](/blog/competitors-timeline.svg)

---

## Financial Services: The industry that moved first

Financial services has the deepest pockets and the highest regulatory bar — which makes it the most instructive case study. If agents can clear compliance in banking, the "our industry is too regulated" objection loses most of its weight.

### Morgan Stanley — 98% adoption in six months

In September 2023, Morgan Stanley rolled out an AI assistant powered by GPT-4 to its 16,000 financial advisors. The system gives advisors instant access to roughly 100,000 research reports and internal documents — the kind of information that previously required manual searching through multiple databases.

The results:

- **98% of financial advisor teams** actively adopted the tool — an adoption rate that most enterprise software never achieves
- **Document retrieval efficiency** went from 20% to 80%
- **Query response time** dropped from 30+ minutes to seconds
- Salespeople using the research tool respond to client inquiries in **one-tenth the time**

Morgan Stanley did not stop there. They launched a meeting summarization tool that transcribes client calls, generates actionable notes, drafts follow-up emails, and saves everything into Salesforce CRM — automatically. Then they built AskResearchGPT for their institutional securities group, where employees now ask three times more questions than they did with the previous tool.

([Source: CNBC, Sep 2023](https://www.cnbc.com/2023/09/18/morgan-stanley-chatgpt-financial-advisors.html); [Morgan Stanley press release](https://www.morganstanley.com/press-releases/key-milestone-in-innovation-journey-with-openai); [CNBC, Oct 2024](https://www.cnbc.com/2024/10/23/morgan-stanley-rolls-out-openai-powered-chatbot-for-wall-street-division.html))

### JPMorgan Chase — 450+ use cases, $2 billion committed

JPMorgan is not experimenting with AI. They are industrializing it.

The bank has 450+ AI use cases in production, more than 2,000 AI/ML specialists, and a total technology budget of $18 billion in 2025. CEO Jamie Dimon has stated the bank expects $2 billion in annual cost savings from AI — matching what they invest.

Their trajectory tells the story:

- **2017**: COiN platform launched — machine learning that interprets 12,000 commercial credit agreements per year, eliminating 360,000 hours of lawyer review time ([Bloomberg, Feb 2017](https://www.bloomberg.com/news/articles/2017-02-28/jpmorgan-marshals-an-army-of-developers-to-automate-high-finance))
- **2024**: LLM Suite rolled out to 60,000 employees for writing, summarization, and analysis — expanded to 200,000+ employees within months ([CNBC, Aug 2024](https://www.cnbc.com/2024/08/09/jpmorgan-chase-ai-artificial-intelligence-assistant-chatgpt-openai.html))
- **2025**: Agentic AI roadmap announced — every employee gets a personalized AI assistant, back-office workflows automated with AI agents ([CNBC, Sep 2025](https://www.cnbc.com/2025/09/30/jpmorgan-chase-fully-ai-connected-megabank.html))

JPMorgan's LLM Suite won American Banker's 2025 "Innovation of the Year" Grand Prize. This is a bank that processes trillions of dollars and serves millions of clients treating AI agents as core infrastructure — not an experiment.

### Goldman Sachs — Autonomous agents doing real work

Beyond the Anthropic accounting agents mentioned above, Goldman launched its internal GS AI Assistant in January 2025. By June, it was available to all 46,500+ employees with over 50% adoption — a multi-model system routing queries across OpenAI, Google Gemini, and Meta Llama based on task type.

In July 2025, Goldman became the first major bank to pilot Devin, an autonomous AI coding agent. The results: 3–4x productivity improvement over previous AI coding tools. Goldman plans to scale from hundreds to thousands of Devin instances.

([Source: CNBC, Jan 2025](https://www.cnbc.com/2025/01/21/goldman-sachs-launches-ai-assistant.html); [CNBC, Jul 2025](https://www.cnbc.com/2025/07/11/goldman-sachs-autonomous-coder-pilot-marks-major-ai-milestone.html))

### Bank of America — 3.2 billion interactions and counting

Erica, Bank of America's AI assistant, has processed 3.2 billion client interactions since its 2018 launch. Nearly 50 million people have used it. The system handles 58 million interactions per month — balance checks, transaction searches, bill reminders, spending insights, and Zelle transfers. Their commercial CashPro integration reduced live chat volume by 42%.

([Source: Bank of America press release, Aug 2025](https://newsroom.bankofamerica.com/content/newsroom/press-releases/2025/08/a-decade-of-ai-innovation--bofa-s-virtual-assistant-erica-surpas.html))

![Financial services AI deployment comparison — JPMorgan, Morgan Stanley, Goldman Sachs, Bank of America: what they deployed, when, and at what scale](/blog/competitors-finance-table.svg)

**What this means:** The largest financial institutions — the ones with the most to lose from getting this wrong — have moved past evaluation. They are competing on "how fast can we scale?" These are frontier adopters with resources most organizations do not have. But the patterns they are establishing — workflow-specific deployment, human oversight, durable infrastructure — are setting the standard for the rest of the industry. The longer an organization waits to develop its own operational muscle, the harder it becomes to close the gap in institutional knowledge.

> **Want to see how a multi-agent workflow actually operates in wealth management?** We built a detailed walkthrough — four specialist agents collaborating through a structured workflow, with the same kind of human oversight Goldman and Morgan Stanley use — in [The Business Case for AI Agents](/blog/ai-agents-business-case/).

---

## Legal: AI-assisted research is changing the economics of law

The legal industry's AI adoption curve might be the steepest in any profession. According to the Clio Legal Trends Report, AI adoption among legal professionals jumped from 19% in 2023 to 79% in 2024. Not a gradual climb — a four-fold increase in twelve months.

([Source: Clio, Oct 2024](https://www.lawnext.com/2024/10/ai-adoption-by-legal-professionals-jumps-from-19-to-79-in-one-year-clio-study-finds.html))

### Harvey AI — 100,000 lawyers, 42% of the Am Law 100

Harvey AI went from under $10 million in annual revenue to roughly $190 million in about a year. Its valuation trajectory — $3B (Feb 2025) to $5B (Jun 2025) to $8B (Dec 2025) to $11B talks (Feb 2026) — tells you how fast the legal industry is adopting.

The numbers behind the growth:

- **100,000+ lawyers** using the platform across 1,000+ customers
- **42% of the Am Law 100** — the hundred largest law firms by revenue — are customers
- Active files grew from 268,000 to 9.75 million — a **36x increase**
- Harvey's Contract Intelligence Benchmark showed that lawyers working with Harvey's tools outscored either lawyers or LLMs working alone by 5%+

([Source: TechCrunch, Dec 2025](https://techcrunch.com/2025/12/04/legal-ai-startup-harvey-confirms-8b-valuation/); [Harvey blog](https://www.harvey.ai/blog/contract-intelligence-benchmark); [Legal IT Insider](https://legaltechnology.com/2025/12/02/the-impact-of-legal-ai-a-deeper-dive-into-the-rsgi-harvey-adoption-report/))

### CMS — 118 hours saved per lawyer per year

CMS, one of the largest law firms in the world, deployed Harvey across 7,000+ lawyers and staff in 50+ countries — the largest Harvey deployment in EMEA by seats. Their internal analysis found that 93% of users reported productivity gains, equating to 118 hours saved per lawyer per year. That is roughly 30 minutes every working day redirected from information retrieval to actual legal work.

One specific use case: preparing witness statements from multiple documents and interview recordings. Harvey's transcription workflow converted audio to text and synthesized across sources, saving "several hours of manual work" per instance.

([Source: Artificial Lawyer, Dec 2025](https://www.artificiallawyer.com/2025/12/10/cms-expands-harvey-deal-with-roll-out-across-50-countries/))

*Note: CMS's 118-hour figure is based on internal self-reported surveys, not independently audited.*

### AI is closing the accuracy gap on legal research

The Vals AI VLAIR Legal Benchmark — an independent evaluation — tested legal AI systems against lawyer baselines on legal research tasks. On this specific benchmark, AI systems scored an average accuracy of **80%**, compared to a lawyer baseline of **71%**.

([Source: Vals AI, Oct 2025](https://www.lawnext.com/2025/10/vals-ais-latest-benchmark-finds-legal-and-general-ai-now-outperform-lawyers-in-legal-research-accuracy.html))

A benchmark is not the whole job — legal work involves judgment, strategy, and contextual reasoning that no research accuracy score captures. But on the research component specifically — the volume-heavy, time-consuming work that consumes most junior associate hours — AI tools are reaching and in some cases exceeding the human baseline. The firms using these tools are augmenting their research capacity, not replacing lawyers.

### The revenue impact is measurable

Thomson Reuters' Future of Professionals Report found that firms with a visible AI strategy were **2x more likely to experience revenue growth** and **nearly 4x more likely to see ROI** compared to firms with ad-hoc adoption. Legal technology spending grew 9.7% in 2025 — likely the fastest real growth ever recorded in the legal industry.

([Source: LawSites, Apr 2025](https://www.lawnext.com/2025/04/thomson-reuters-survey-over-95-of-legal-professionals-expect-gen-ai-to-become-central-to-workflow-within-five-years.html); [LawSites, Jan 2026](https://www.lawnext.com/2026/01/legal-tech-spending-surges-9-7-as-firms-race-to-integrate-ai-says-report-on-state-of-legal-market.html))

![Legal industry AI adoption curve — 19% to 79% in one year, with revenue impact comparison for firms with AI strategy vs. ad-hoc adoption](/blog/competitors-legal-adoption.svg)

**What this means:** Legal teams using AI-assisted research are seeing measurable productivity gains — CMS reports 118 hours saved per lawyer per year. The economics are shifting: firms with a visible AI strategy are twice as likely to see revenue growth. For legal departments that have not started, the question is less about whether AI works in legal and more about how quickly the competitive baseline moves.

---

## Customer Support: The Klarna lesson everyone should learn

Customer support is where AI agents have been deployed most aggressively — and where the most important cautionary tale played out in public. The Klarna story is not a failure story. It is the most valuable case study in the industry, because it shows both the real gains and the real risks of deploying AI agents without the right operating model.

### Klarna — what happened, honestly

In January 2024, Klarna launched an AI assistant built on GPT-4 across 23 markets and 35+ languages. The initial numbers were remarkable:

- 2.3 million conversations handled in the first month
- Two-thirds of all customer service chats handled by AI
- Resolution time dropped from 11 minutes to under 2 minutes
- 25% drop in repeat inquiries
- Projected $40 million profit improvement for 2024

Klarna reduced headcount from roughly 5,500 to 3,400, primarily through attrition and a hiring freeze.

([Source: Klarna press release, Feb 2024](https://www.klarna.com/international/press/klarna-ai-assistant-handles-two-thirds-of-customer-service-chats-in-its-first-month/))

Then quality caught up.

In May 2025 — shortly after a successful US IPO — CEO Sebastian Siemiatkowski publicly admitted the AI push went too far. His words to Bloomberg: *"As cost unfortunately seems to have been a too predominant evaluation factor when organizing this, what you end up having is lower quality."*

Customer satisfaction dropped. Customers complained of generic, repetitive responses for complex issues. Forrester analyst Kate Leggett summarized it bluntly: *"They overpivoted to cost containment, without thinking about the longer-term impact of customer experience."*

Klarna reversed course. They began rehiring human agents and moved to a hybrid model where AI handles routine queries and humans handle complex and sensitive cases.

([Source: Bloomberg, May 2025](https://www.bloomberg.com/news/articles/2025-05-08/klarna-turns-from-ai-to-real-person-customer-service); [Fortune, May 2025](https://fortune.com/2025/05/09/klarna-ai-humans-return-on-investment/))

**The lesson is not "AI agents don't work."** AI still handles roughly two-thirds of Klarna's chats. The lesson is that how you deploy agents matters as much as whether you deploy them. The organizations getting durable results are the ones that design the human-AI boundary deliberately — not the ones that maximize automation and hope quality holds.

![Klarna's AI journey — three panels showing initial deployment metrics, quality decline, and the hybrid model they landed on](/blog/competitors-klarna-journey.svg)

### Salesforce Agentforce — 83% autonomous resolution

Salesforce deployed Agentforce on their own help site first — "Customer Zero" — before selling it to customers. Their results:

- Over 2 million customer conversations handled
- **83–85% autonomous resolution rate** — no human needed
- Only ~1% of customers need to speak to a human
- ~32,000 conversations per week
- Projected $50 million in annual cost savings

Customer deployments show similar patterns: Wiley (publisher) saw a 40%+ increase in case resolution and 213% ROI. OpenTable achieved a 40% improvement in inquiry resolution, launched in 3 weeks. Wyndham Hotels anticipates a 30% decrease in call resolution time.

Agentforce and Salesforce's Data 360 products reached $1.4 billion ARR with 114% year-over-year growth and 9,500+ paid deals.

([Source: Salesforce Customer Zero](https://www.salesforce.com/news/stories/agentforce-customer-zero/); [Futurum Group](https://futurumgroup.com/insights/salesforce-q3-fy-2026-ai-agents-data-360-lift-bookings-and-fy26-outlook/))

*Note: Most customer metrics come from Salesforce's own case studies. The self-deployment numbers (help.salesforce.com) are more verifiable.*

### Intercom Fin — 40 million conversations resolved

Intercom's Fin AI agent has resolved over 40 million conversations. Their headline resolution rate is 67%, though the average across thousands of customers is closer to 41% — a gap that reflects how much resolution rates depend on knowledge base quality and setup.

Individual customer results tell the story: Lightspeed Commerce sees up to 65% resolution, tado (smart thermostats) up to 70% workflow completion.

([Source: Intercom Fin AI](https://fin.ai/))

*Note: The gap between Intercom's 67% headline and 41% customer average is worth noting. Resolution rates vary significantly by implementation quality.*

![Customer support AI comparison — Salesforce, Intercom, Zendesk: resolution rates, scale, and deployment model](/blog/competitors-support-comparison.svg)

**What this means:** AI agents can handle high volumes of routine customer queries — the data is clear. But the Klarna reversal and the variation in Intercom's resolution rates show that the operating model matters as much as the technology. Workflow design, quality monitoring, human escalation paths, and the ability to recover gracefully when something goes wrong are the difference between a system that saves $50 million a year and one that damages your brand.

---

## Insurance Underwriting: From weeks to minutes

Insurance underwriting is a workflow built on sequential specialist handoffs — exactly the pattern AI agents are best at compressing. The data from early movers is dramatic.

### Lemonade — 55% of claims fully automated

Lemonade has been the most aggressive insurer in deploying AI. Their AI systems now handle:

- **96% of first notices of loss** without human intervention
- **55% of all claims** fully automated from start to finish
- A world-record claim settlement in **3 seconds** — the AI reviewed the claim, cross-referenced the policy, ran 18 anti-fraud algorithms, approved it, and sent wiring instructions

The business results are equally striking: gross loss ratio improved 12 points year-over-year to 67% in Q2 2025, improved 27 points over two years. In-force premium reached $1.083 billion with 29% growth. Gross margin hit 39% — among the highest the company has ever recorded.

([Source: Lemonade Q2 2025 Shareholder Letter](https://www.lemonade.com/investor-relations-bo/wp-content/uploads/2025/08/LMND-Shareholder-Letter-Q2-2025-FINAL.pdf); [Lemonade blog](https://www.lemonade.com/blog/lemonade-sets-new-world-record/))

### Zurich Insurance — $40 million in underwriting leakage recovered

Zurich deployed Azure OpenAI Service across its underwriting workflows, processing unstructured data across multiple formats and languages. The result: **$40 million annual reduction in underwriting leakage** — money lost through pricing inaccuracies, missed risk factors, and manual processing errors.

Zurich is not stopping there. They integrated AI-enhanced aerial imagery (Nearmap/Betterview) directly into their U.S. Middle Market underwriting platform, giving underwriters automated roof condition scores and deferred maintenance indicators. They launched an AI Lab with ETH Zurich to research the next generation of insurance AI. They have deployed over 200 AI tools across the organization.

([Source: Microsoft case study](https://www.microsoft.com/en/customers/story/19760-zurich-insurance-azure-open-ai-service); [Zurich press release, Oct 2025](https://www.zurichna.com/media/news-releases/2025/nearmap-and-zurich-advance-property-underwriting-with-ai-integration))

### Allianz BRIAN — 65,000 minutes saved

Allianz UK deployed BRIAN, a generative AI tool that digests all Property & Casualty and Specialty underwriting guides. Instead of manually searching through documentation, underwriters ask questions and receive sourced answers drawn exclusively from approved documents — ensuring compliance.

Since its January 2025 rollout across 260 underwriters:

- **13,000+ questions asked**
- **65,000 minutes saved** (135 working days) in information gathering
- Plans to scale to **600+ underwriters** within 12 months

Across the broader Allianz group, the company has **900+ AI use cases** registered internally and close to 400 GenAI use cases.

([Source: Allianz, Feb 2025](https://www.allianz.com/en/mediacenter/news/articles/250211-aI-at-allianz-how-ai-is-cracking-complexity-for-underwriters.html))

### The industry trajectory

The numbers on where insurance underwriting AI is heading:

- **AI use in underwriting projected to grow from 14% to 70% by 2028** — Accenture survey of 430 senior executives ([Source: Accenture](https://www.accenture.com/us-en/insights/insurance/underwriting-rewritten))
- **AI-driven underwriting can reduce policy issuance times by up to 80%** — Deloitte ([Source: Deloitte](https://www.deloitte.com/us/en/insights/industry/financial-services/scaling-gen-ai-insurance.html))
- **Gen AI could unlock $50–70 billion** in insurance industry revenue — McKinsey ([Source: McKinsey, Feb 2026](https://www.mckinsey.com/industries/financial-services/our-insights/ai-in-insurance-understanding-the-implications-for-investors))
- **77% of insurers** are at least piloting AI initiatives, up 16 points from the prior year

Quoting times in commercial lines are moving from **multiple days to hours**. In simpler risk categories, semi-autonomous underwriting is already in production.

![Insurance underwriting pipeline — before (weeks, manual handoffs) vs. after (hours, AI-assisted) with named companies at each stage](/blog/competitors-insurance-pipeline.svg)

**What this means:** Insurers still running sequential manual underwriting reviews are competing against organizations processing the same work in a fraction of the time — with better loss ratios. Lemonade's 27-point improvement in gross loss ratio over two years is not a marginal optimization. It is a structural advantage in pricing and profitability that compounds with each quarter of operational refinement.

---

## Three patterns the leaders share

Across every industry, the organizations getting real results from AI agents — not just press releases, but measurable business impact — share three characteristics.

### 1. They started with one workflow, not an org-wide strategy

Morgan Stanley did not try to "implement AI across wealth management." They gave financial advisors a research tool. It worked. Adoption hit 98%. Then they added meeting summaries. Then they extended to institutional securities. Each deployment built confidence and operational knowledge for the next one.

JPMorgan started with COiN for commercial loan agreements in 2017 — one specific workflow, one specific problem. Nine years later, they have 450+ use cases. But they got there one workflow at a time.

The organizations that announced grand AI transformation strategies in 2023 are mostly still in committee. The ones that picked one painful workflow and deployed are already scaling.

### 2. They kept humans in the loop — and the Klarna lesson reinforced why

Every successful deployment in this article has a human-in-the-loop component. Goldman's accounting agents have human oversight. Morgan Stanley's research tool augments advisors, it does not replace them. Even Lemonade, the most automated insurer, keeps humans on complex claims.

Klarna's reversal made this lesson impossible to ignore. When they over-rotated to cost savings and removed too many humans from the loop, quality degraded — publicly, measurably, in a way that required a course correction. The CEO's own words: cost was "a too predominant evaluation factor."

The right operating model is not "automate everything." It is "automate the volume and complexity, keep humans on judgment and relationships." Every case study in this article confirms it.

### 3. They invested in infrastructure, not demo-ware

There is a meaningful difference between a prototype that works in a demo and a system that runs reliably in production. The organizations scaling AI agents successfully built — or bought — infrastructure that handles:

- **Durability**: What happens when the system crashes mid-workflow? Goldman and JPMorgan do not re-run trade accounting from scratch. They resume from where they stopped.
- **Auditability**: Every step is logged. In financial services, legal, and insurance, this is not optional — regulators require it. The firms that built complete audit trails into their agent workflows from day one avoided the compliance headaches that catch teams who bolt it on later.
- **Recovery**: When a data source times out, when a model returns an unexpected response, when a compliance rule triggers mid-workflow — what happens? In demo-ware, the run fails and someone restarts it manually. In production infrastructure, completed work is preserved and execution resumes.

The companies still "evaluating" are often evaluating prototyping tools — frameworks designed to build demos quickly. The companies already deploying at scale long ago moved past prototyping into durable, observable, auditable infrastructure.

Here is the uncomfortable truth: Goldman embedded Anthropic engineers for six months to build their agent infrastructure. JPMorgan has 2,000+ AI/ML specialists and an $18 billion technology budget. Most organizations do not have those resources. But the infrastructure requirements — durability, auditability, human-in-the-loop, crash recovery — are the same regardless of budget. The question for most teams is not whether they need these capabilities, but how to get them without a multi-year internal build.

![Three patterns shared by AI agent leaders — started with one workflow, kept humans in the loop, invested in production infrastructure](/blog/competitors-three-patterns.svg)

---

## The real advantage is organizational learning

Here is the part of this article that is hardest to quantify but most important to understand: the durable advantage is not the technology. It is what the organization learns by operating it.

Morgan Stanley's research tool has been live since September 2023. That means over two years of advisor feedback, workflow refinement, edge case resolution, and institutional knowledge about where AI adds value and where it does not. Every quarter that tool runs, Morgan Stanley gets better at deploying the *next* tool — not because the model improved, but because the organization did.

JPMorgan started their AI journey in 2017 with COiN. When they deploy agentic AI in 2025, they are building on nine years of institutional muscle: how to scope a workflow, how to validate results, how to earn internal trust.

The technology will be available to everyone. Models are commoditizing. But the organizational knowledge — how to redesign workflows around agents, how to set the right human boundaries, how to handle the edge cases that only surface in production — that only comes from doing. Every quarter of operational experience compounds. This is why "we'll catch up later" is a riskier bet than it appears: the gap is not in technology access, it is in operational maturity.

![Compounding advantage curve — early movers' lead widens each quarter as organizational learning accumulates](/blog/competitors-compounding-curve.svg)

---

## Where to start

If the evidence in this article has moved you from "watching" to "ready to act," here are three concrete steps:

**1. Pick the most painful handoff in your organization.**

Not the most important process. The most painful handoff — the place where work passes from one specialist to another and context gets lost, time accumulates, and quality degrades. Every organization has one. It is the quarterly report that takes three weeks because four teams contribute sequentially. It is the underwriting decision that waits two days for a risk analyst to be available. It is the contract review that requires three specialists working in sequence.

That handoff is where agents create the most value, because they eliminate the waiting, the context loss, and the inconsistency that handoffs introduce.

**2. Require durability from day one.**

The difference between a successful deployment and a failed one is not the model. It is the infrastructure. If your agent crashes at step 7 of 10 and has to restart from step 1, you do not have production infrastructure — you have a demo.

Before you choose any platform, ask these five questions:

| Question | Why it matters |
|----------|---------------|
| If the system crashes mid-workflow, does it resume or restart? | Goldman's agents do not re-run trade accounting from scratch. Neither should yours. |
| Is every step logged automatically, or do you build logging yourself? | In regulated industries, incomplete audit trails are a compliance failure. In any industry, they are a debugging nightmare. |
| Can a human approve or reject a decision mid-workflow? | The Klarna lesson: human-in-the-loop cannot be bolted on after quality degrades. It must be a first-class capability. |
| Are you locked to one model provider? | Goldman routes across OpenAI, Gemini, and Llama by task type. Model flexibility is not a nice-to-have — it is how you avoid vendor dependency. |
| Can your agents collaborate with agents in other systems? | The industry is converging on standard protocols (MCP, A2A). Agents that cannot interoperate are agents that cannot scale beyond your own walls. |

If the answer to any of these is "no" or "we'd have to build that," you are evaluating a prototyping tool, not production infrastructure.

**3. Design the human boundary before you write a line of code.**

Klarna's lesson: decide where humans stay in the loop before you deploy, not after quality degrades. The most successful deployments in this article — Morgan Stanley, Goldman Sachs, Lemonade — all designed explicit human oversight into their agent workflows from the start. Agents handle volume and complexity. Humans handle judgment, relationships, and decisions that require context no system can replicate.

![Where to start — three steps: identify the painful handoff, require durable infrastructure, design the human boundary](/blog/competitors-getting-started.svg)

---

## The infrastructure question

Goldman spent six months with embedded Anthropic engineers building the reliability layer beneath their agents. JPMorgan has a $2 billion annual AI budget. Most organizations do not have those resources — but they face the same infrastructure requirements.

The five questions in the previous section — crash recovery, audit trails, human-in-the-loop, model flexibility, interoperability — are not aspirational. They are what separates a demo from a system you would trust with your clients. The organizations in this article answered them through massive internal investment. The question for everyone else is whether that same foundation can be adopted rather than built from scratch.

This is why we built [JamJet](/) — an open-source runtime (Apache 2.0) that provides event-sourced durability, automatic audit trails, first-class human-in-the-loop, model-agnostic execution, and native MCP + A2A protocol support. Rust core, Python and Java authoring surface. The goal is to make the infrastructure patterns the leaders share available without requiring their budgets.

- [What happens when AI agents fail — sourced post-mortems →](/blog/ai-agent-failures-root-cause/)
- [Read the full business case for AI agents →](/blog/ai-agents-business-case/)
- [See the wealth management architecture →](/blog/wealth-management-multi-agent/)
- [Try JamJet — `pip install jamjet` →](https://github.com/jamjet-labs/jamjet)
- [Read the docs →](https://docs.jamjet.dev)
- [Join the community →](https://discord.gg/jamjet)

