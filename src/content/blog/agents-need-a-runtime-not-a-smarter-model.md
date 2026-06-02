---
title: "Your Agents Don't Need a Smarter Model. They Need a Runtime."
date: 2026-06-02
description: "Models keep getting better and agents keep breaking in production. The bottleneck was never intelligence. It is execution reliability, and that is a runtime problem."
author: "Sunil Prakash"
category: "Perspective"
---

Your agent passed every test. It demoed clean. Then it went to production, and three days later it was stuck at 2am, halfway through a task, with no memory of how it got there.

There is a reflex when this happens. It will be fine once the next model lands.

It will not be fine.

For two years the limiting factor in building agents was how good the model was. That is no longer the thing breaking your agent in production. The bottleneck moved, and most teams have not noticed because they are still watching the model.

## The data already says this

The clearest read on what actually breaks production agents is not a vendor blog. It is a study from researchers at Berkeley and Databricks, [Measuring Agents in Production](https://arxiv.org/abs/2512.04123), which surveyed 306 practitioners running agents across 26 domains. The finding is blunt: reliability, defined as consistent correct behavior over time, is the top development challenge, and teams address it through systems-level design rather than by tuning the model.

Read that again. The people actually shipping agents are not solving reliability with better weights. Seventy percent of them are prompting off-the-shelf models. They are solving it with engineering around the model.

That matches what anyone who has run a long agent has felt. Models got dramatically better over the last eighteen months. Agents did not get proportionally more reliable in production. If intelligence were the bottleneck, those two curves would track. They do not.

## The math of a long-running agent

Here is why a smarter model does not rescue you.

An agent is a loop, and each step can fail. A timeout, a malformed tool call, a rate limit, a crash, a dropped connection. Anthropic, in its own guidance on [building effective agents](https://www.anthropic.com/research/building-effective-agents), names the cost directly: the autonomous nature of agents means higher costs and the potential for compounding errors.

Compounding is the word that matters. Put numbers on it. Say each step in your agent succeeds 99 percent of the time. That sounds production-ready. Across a 50-step run, the whole thing succeeds about 60 percent of the time, because 0.99 to the 50th power is roughly 0.6. Drop per-step reliability to 95 percent, a number most demos would still be happy with, and a 50-step run succeeds about 8 percent of the time.

A better model nudges the per-step number. It does nothing about the structure. And the structure is the problem: a process that dies at step 37 and starts over from step 1, making every model call again, burning the budget again, with no memory that the first 36 steps ever happened.

You cannot prompt your way out of a crash.

## What actually works

The teams that get agents to stick in production do two unglamorous things.

First, they make execution durable. State is checkpointed. When the process dies, the agent resumes from the last completed step instead of restarting from zero. Retries are idempotent, so a replay does not charge a customer twice or send the same email again. This is the same durable-execution idea that backend systems have relied on for years, applied to the agent loop.

Second, they restrict the agent. The Berkeley and Databricks study describes production agent engineering as a discipline of restriction. Sixty-eight percent of teams cap their agents at ten steps or fewer before a checkpoint or a human intervenes. Seventy-four percent keep a human in the loop. The winning move is not more autonomy. It is bounded autonomy with recovery built in.

Both of these live below the model. They are properties of the runtime the agent executes in, not the prompt you hand it.

## The market is already moving here

If this were a fringe view, the money would not be following it. In February 2026, Temporal, the durable-execution company, [raised $300M at a $5B valuation](https://temporal.io/news/temporal-raises-300M-to-make-agentic-ai-real-for-companies), with the explicit framing of making agentic AI real for companies. The VP of Application Infrastructure at OpenAI put it plainly in that announcement: as AI systems become more complex and long-running, durability is as important as performance.

That is the shift in one sentence. For a long time the question was how to make the model better. Increasingly the question is how to build a system around the model that does not fall apart.

LangChain's late-2025 [survey of agent builders](https://www.langchain.com/state-of-agent-engineering) found 57.3 percent now run agents in production, up from 51 percent the year before. More agents are reaching production, which means more teams are hitting the wall that production reliability actually is.

## The honest part

Durable execution is not magic, and anyone who tells you otherwise is selling something.

Resuming from a checkpoint does not make a wrong answer right. Durability is about not losing work and not repeating it. It is not about correctness. You still need evaluation and guardrails for that.

Even exactly-once, the phrase on every durable-execution site, deserves a careful read. For the external API and tool calls an agent makes, which is most of what an agent does, the honest guarantee is usually at-least-once plus idempotency keys. True exactly-once depends on the service on the other end. Restriction has costs too. Cap the steps too aggressively and you cut off the long-horizon work that made agents interesting in the first place.

None of this gets solved by waiting for a release. It gets solved by treating the runtime as a first-class part of the system.

## Where this leaves us

This is the bet we made building JamJet. We treat agents as durable, governed entities inside a runtime, not as scripts wrapped around a model call. Crash recovery and checkpoint-resume are built in, not bolted on, and the same runtime that keeps the agent alive across failures is the one that enforces what it is allowed to do.

A small example we ship is a loan-underwriting agent that is both durable and governed. It survives a crash mid-decision and resumes where it left off, and every step it takes is checked against policy and recorded for audit. The durability and the control are the same layer. That is the part a smarter model was never going to give you.

So before the next model drops, it is worth asking an honest question. Is the model actually the thing that is broken, or is it everything around the model?

The model will keep getting better. Your agent still needs somewhere reliable to run.
