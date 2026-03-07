---
title: A2A Integration
description: Delegate to and serve other agents using the Agent-to-Agent protocol.
sidebar:
  order: 6
---

import { Aside } from '@astrojs/starlight/components';

# A2A Integration

JamJet implements the [Agent-to-Agent (A2A) protocol](https://google.github.io/A2A/) — an open standard for agents to discover, call, and collaborate with each other across frameworks and organizations.

## What is A2A?

A2A defines how agents:
- **Advertise** their capabilities via an **Agent Card** (a `.well-known/agent.json` file)
- **Accept tasks** from other agents (a structured request/response format)
- **Stream progress** back (SSE-based event stream)
- **Exchange artifacts** (files, structured data, text)

JamJet agents are A2A-native — every agent automatically gets an Agent Card and can accept A2A tasks from other frameworks (LangChain, CrewAI, AutoGen, etc.).

## Agent Cards

An Agent Card is a machine-readable description of your agent:

```json
{
  "id": "research-agent",
  "name": "Research Agent",
  "description": "Searches the web and synthesizes research reports.",
  "version": "0.2.0",
  "url": "https://agents.example.com/research-agent",
  "capabilities": {
    "streaming": true,
    "push_notifications": false
  },
  "input_schema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" }
    },
    "required": ["query"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "answer": { "type": "string" },
      "sources": { "type": "array" }
    }
  }
}
```

JamJet generates this automatically from your workflow schema. You can customize it in `jamjet.toml`:

```toml
[agent]
name = "Research Agent"
description = "Searches the web and synthesizes research reports."
url = "https://agents.example.com/research-agent"
```

## Calling other agents

Use an `a2a_task` node to delegate work to another agent:

### YAML

```yaml
nodes:
  delegate-research:
    type: a2a_task
    agent_url: "https://agents.example.com/research-agent"
    input:
      query: "{{ state.query }}"
    output_key: research_result
    next: synthesize
```

### Python SDK

```python
@node
async def delegate_research(self, state: State) -> State:
    result = await self.a2a(
        agent_url="https://agents.example.com/research-agent",
        input={"query": state["query"]},
    )
    return {"research_result": result.state}
```

## Discovering agents

If agents publish their URLs, you can discover them by fetching their Agent Card:

```bash
jamjet agents inspect https://agents.example.com/research-agent
```

```
Agent: Research Agent (research-agent v0.2.0)
  URL: https://agents.example.com/research-agent
  Streaming: yes

  Input schema:
    query: string (required)

  Output schema:
    answer: string
    sources: array
```

## Serving your agent as A2A

Any JamJet workflow is automatically servable as an A2A agent. Enable the A2A server:

```toml
[a2a.server]
enabled = true
port = 7702
expose = ["research-agent", "summarizer"]
```

```bash
jamjet dev --with-a2a-server
```

Your agent card will be available at:
```
http://localhost:7702/.well-known/agent.json
```

Other agents (in any framework) can now call your workflow as an A2A task.

## Streaming A2A responses

JamJet supports SSE-based streaming for A2A tasks. Enable streaming in the `a2a_task` node:

```yaml
  delegate-research:
    type: a2a_task
    agent_url: "https://agents.example.com/research-agent"
    input:
      query: "{{ state.query }}"
    stream: true              # receive events as they happen
    output_key: research_result
    next: synthesize
```

```python
# Python SDK
async for event in self.a2a_stream(
    agent_url="https://agents.example.com/research-agent",
    input={"query": state["query"]},
):
    print(event.type, event.data)
```

## Cross-framework compatibility

JamJet's A2A implementation is compatible with:

| Framework | A2A support |
|-----------|------------|
| JamJet | Native (client + server) |
| LangChain | Via `langchain-a2a` |
| CrewAI | Via A2A adapter |
| AutoGen | Via A2A adapter |
| Vertex AI | Native |
| Any HTTP client | Direct REST calls |

<Aside type="note">
A2A is framework-agnostic by design. A JamJet agent and a LangChain agent can collaborate directly — neither needs to know what framework the other uses.
</Aside>

## Security

A2A task endpoints should be protected in production. JamJet supports:

```toml
[a2a.server]
enabled = true
auth = "api_key"              # or mtls, jwt
api_keys = ["${AGENT_API_KEY}"]
```

For mTLS in zero-trust environments:

```toml
[a2a.server]
auth = "mtls"
ca_cert = "/path/to/ca.crt"
server_cert = "/path/to/server.crt"
server_key = "/path/to/server.key"
```

## Autonomy modes

JamJet agents have a configurable autonomy level that controls how much human oversight is required:

| Mode | Description |
|------|-------------|
| `guided` (default) | Pauses at key decision points for human approval |
| `supervised` | Runs autonomously but logs all decisions for review |
| `autonomous` | Fully autonomous — no human-in-the-loop |

```toml
[agent]
autonomy = "guided"    # guided | supervised | autonomous
```

For `guided` agents, use `wait` nodes to pause at approval points:

```yaml
nodes:
  propose-action:
    type: model
    model: claude-sonnet-4-6
    prompt: "Propose a plan for: {{ state.task }}"
    output_key: plan
    next: await-approval

  await-approval:
    type: wait
    event: human_approved
    timeout_hours: 24
    on_timeout: escalate
    next: execute
```
