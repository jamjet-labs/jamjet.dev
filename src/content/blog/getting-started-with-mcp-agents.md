---
title: "Getting Started with MCP: Connect AI Agents to Any Tool"
date: 2026-04-15
description: "Model Context Protocol is becoming the USB-C of AI agents. Here is how to connect your agents to databases, APIs, and file systems — with working code."
author: "Sunil Prakash"
category: "Architecture & Deep Dives"
---

# Getting Started with MCP: Connect AI Agents to Any Tool

Every agent framework eventually hits the same wall: tools. Your agent needs to search the web, query a database, read files, post to Slack. Each integration is a custom wrapper. Each wrapper has its own auth story, error handling, and discovery mechanism. Multiply that by the number of tools you need, and you spend more time on plumbing than on the actual agent logic.

Model Context Protocol (MCP) is Anthropic's answer to this. It is an open standard that defines how AI agents discover and call external tools. Think USB-C for AI — one connector, any device. There are already hundreds of community-built MCP servers for everything from GitHub to PostgreSQL to Brave Search.

Most frameworks bolt MCP on as an afterthought. JamJet treats it as a first-class citizen. Tool calls are part of the durable workflow graph. They get checkpointed, retried, and replayed like any other node. That distinction matters when your agent is doing real work in production.

---

## What MCP actually is (and isn't)

MCP is a client-server protocol with three primitives:

- **Tools** — functions with typed input/output schemas that your agent can call
- **Resources** — read-only data sources (files, database rows, API responses)
- **Prompts** — reusable prompt templates that a server can expose

Your agent is the MCP client. Each external capability (web search, file access, a database) runs as an MCP server. The client discovers what tools a server offers, gets their schemas, and calls them with structured arguments.

Transport is either stdio (for local servers — the most common setup during development) or HTTP with Server-Sent Events (for remote servers in production).

What MCP is *not*: a replacement for function calling. Your LLM still decides when and how to use a tool. MCP standardizes the discovery and invocation layer so you are not writing bespoke wrappers for every integration.

---

## Your first MCP connection

Install JamJet:

```bash
pip install jamjet
```

Create a `jamjet.toml` in your project root to declare which MCP servers your agent can reach:

```toml
[[mcp.servers]]
name = "filesystem"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "./data"]
```

This connects to the official MCP filesystem server and gives your agent read/write access to the `./data` directory. No custom wrapper code.

Now define a workflow that uses it. Here is a YAML definition:

```yaml
id: file-summarizer
version: "0.1.0"

nodes:
  read:
    type: tool
    server: filesystem
    tool: read_file
    arguments:
      path: "{{ state.file_path }}"
    output_key: file_contents
    next: summarize

  summarize:
    type: model
    model: claude-sonnet-4-6
    prompt: |
      Summarize the following file contents concisely:

      {{ state.file_contents }}
    output_key: summary
```

And the Python code to run it:

```python
import asyncio
from jamjet import JamJetClient

async def main():
    client = JamJetClient()
    result = await client.run(
        "file-summarizer",
        input={"file_path": "report.txt"},
    )
    print(result.state["summary"])

asyncio.run(main())
```

Start the runtime with `jamjet dev`, run the script, and you get a summary of `./data/report.txt`. The filesystem MCP server handles the file I/O. The LLM handles the summarization. JamJet handles the orchestration and state.

You can verify which tools are available at any time:

```bash
jamjet tools list
```

```
Server: filesystem
  read_file(path: str) -> str
  write_file(path: str, content: str) -> void
  list_directory(path: str) -> list[FileEntry]
```

---

## Building your own MCP server with JamJet

JamJet is not just an MCP client. It can also serve your workflows as MCP tools for other agents or editors to call.

Add this to `jamjet.toml`:

```toml
[mcp.server]
enabled = true
port = 7701
workflows = ["file-summarizer"]
```

Start the runtime:

```bash
jamjet dev --with-mcp-server
```

Now any MCP client — another JamJet agent, Claude Desktop, Cursor, or a custom script — can discover and call your `file-summarizer` workflow as a tool. They see a typed schema for input and output. They do not need to know it is JamJet underneath.

This is how you get composability. Agent A exposes its capabilities over MCP. Agent B connects to Agent A's MCP server and uses those capabilities as tools. No shared codebase. No tight coupling.

---

## MCP + durable execution

Here is where JamJet pulls away from other frameworks.

In most setups, if an MCP tool call fails — network timeout, rate limit, server crash — you lose everything. The agent state is gone. You start over from the beginning.

JamJet checkpoints every tool call as part of the durable workflow graph. When something goes wrong:

- **Automatic retry with backoff.** Configure per node — exponential backoff, max attempts, delay.
- **State preservation.** If the process crashes after the first tool call succeeds but before the second completes, JamJet resumes from the checkpoint, not from scratch.
- **Replay.** You can replay the exact sequence of tool calls for debugging, with the same inputs and outputs.

Here is what retry configuration looks like:

```yaml
nodes:
  search:
    type: tool
    server: brave-search
    tool: web_search
    arguments:
      query: "{{ state.query }}"
    output_key: search_results
    retry:
      max_attempts: 3
      backoff: exponential
      delay_ms: 1000
    next: summarize
```

Compare this to a plain LangChain or LangGraph setup: if the API call fails on step 3 of a 5-step pipeline, you re-run the entire pipeline. With JamJet, you resume from step 3 with the results of steps 1 and 2 already in state. For agents doing expensive LLM calls or slow tool invocations, this saves real time and money.

---

## Real-world patterns

Three patterns I see used most often with MCP in production.

### Database agent

An MCP server wrapping a read-only PostgreSQL connection. The agent queries, aggregates, and summarizes.

```toml
[[mcp.servers]]
name = "analytics-db"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-postgres"]
env = { DATABASE_URL = "${DATABASE_URL}" }
```

```python
@workflow(id="db-analyst", version="0.1.0")
class DbAnalyst:
    @node(start=True)
    async def query(self, state: State) -> State:
        result = await self.tool(
            server="analytics-db",
            tool="run_query",
            arguments={"sql": f"SELECT * FROM orders WHERE status = 'pending' LIMIT 50"},
        )
        return {"rows": result.content}

    @node
    async def summarize(self, state: State) -> State:
        response = await self.model(
            model="claude-sonnet-4-6",
            prompt=f"Summarize these pending orders:\n{state['rows']}",
        )
        return {"summary": response.text}
```

The agent never sees raw connection strings. The MCP server handles auth and connection pooling. The agent just calls `run_query`.

### Multi-tool orchestration

An agent that connects to three MCP servers — web search, filesystem, and a database — and coordinates between them.

```toml
[[mcp.servers]]
name = "brave-search"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-brave-search"]
env = { BRAVE_API_KEY = "${BRAVE_API_KEY}" }

[[mcp.servers]]
name = "filesystem"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "./reports"]

[[mcp.servers]]
name = "analytics-db"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-postgres"]
env = { DATABASE_URL = "${DATABASE_URL}" }
```

Each server is independent. The agent's workflow graph decides which tools to call and in what order. Add a new MCP server to `jamjet.toml` and the agent immediately has access — no code changes, no redeployment of the agent itself.

### Agent-to-agent via MCP

Agent A is a research specialist. Agent B is a report writer. Agent B uses Agent A's capabilities as MCP tools.

Agent A's `jamjet.toml`:

```toml
[mcp.server]
enabled = true
port = 7701
workflows = ["deep-research"]
```

Agent B's `jamjet.toml`:

```toml
[[mcp.servers]]
name = "researcher"
url = "http://localhost:7701/mcp"
```

Agent B calls `researcher.deep-research` like any other tool. Behind the scenes, it triggers Agent A's full durable workflow — search, extract, synthesize — and returns the result. Each agent maintains its own state, retries, and checkpoints independently.

---

## Get started

MCP makes your agents composable. JamJet makes them reliable. Together, you get agents that can connect to anything and survive anything.

Install JamJet, point it at an MCP server, and build something:

```bash
pip install jamjet
jamjet init my-agent
jamjet dev
```

Full MCP documentation: [docs.jamjet.dev/en/docs/mcp](https://docs.jamjet.dev/en/docs/mcp)

Browse community MCP servers: [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
