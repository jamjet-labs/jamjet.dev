---
title: MCP Integration
description: Connect JamJet to external tool servers using the Model Context Protocol.
sidebar:
  order: 5
---

import { Aside, Steps } from '@astrojs/starlight/components';

# MCP Integration

JamJet has first-class support for the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — the open standard for connecting AI agents to external tools, data sources, and services.

## What is MCP?

MCP defines a standard way for AI agents to discover and call external tools. A **MCP server** exposes tools with typed schemas; a **MCP client** (JamJet) discovers those tools and calls them.

This means you can connect JamJet to any MCP-compatible tool server — and there are [hundreds of community servers](https://github.com/modelcontextprotocol/servers) for web search, databases, GitHub, Slack, file systems, and more.

## Configuring MCP servers

Add servers to `jamjet.toml` in your project root:

```toml
# Local stdio server (most common for dev)
[[mcp.servers]]
name = "brave-search"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-brave-search"]
env = { BRAVE_API_KEY = "${BRAVE_API_KEY}" }

# Local Python server
[[mcp.servers]]
name = "my-tools"
command = "python"
args = ["-m", "my_tools.server"]

# Remote HTTP server (SSE transport)
[[mcp.servers]]
name = "remote-api"
url = "https://tools.example.com/mcp"
headers = { Authorization = "Bearer ${TOOLS_API_KEY}" }
```

JamJet connects to all configured servers when `jamjet dev` starts.

## Using tools in workflows

### YAML

```yaml
nodes:
  search:
    type: tool
    server: brave-search        # matches `name` in jamjet.toml
    tool: web_search            # tool name from the MCP server
    arguments:
      query: "{{ state.query }}"
      count: 10
    output_key: search_results
    next: summarize
```

### Python SDK

```python
@node
async def search(self, state: State) -> State:
    result = await self.tool(
        server="brave-search",
        tool="web_search",
        arguments={"query": state["query"], "count": 10},
    )
    return {"search_results": result.content}
```

## Discovering available tools

List all tools from connected servers:

```bash
jamjet tools list
```

```
Server: brave-search
  web_search(query: str, count: int) → list[SearchResult]
  news_search(query: str, freshness: str) → list[NewsItem]

Server: my-tools
  run_query(sql: str) → list[dict]
  get_schema(table: str) → dict
```

Test a tool directly:

```bash
jamjet tools call brave-search web_search --args '{"query": "JamJet runtime", "count": 3}'
```

## Building a MCP server

JamJet can also **serve** tools over MCP, exposing your workflows as callable tools for other agents.

Add this to `jamjet.toml`:

```toml
[mcp.server]
enabled = true
port = 7701
workflows = ["my-agent", "research-agent"]   # expose these as tools
```

Any workflow you expose becomes a callable MCP tool. Other agents can discover it, see its input/output schema, and call it — all without knowing it's JamJet underneath.

```bash
# Start the MCP server alongside the runtime
jamjet dev --with-mcp-server
```

## Popular MCP servers

| Server | Package | What it provides |
|--------|---------|-----------------|
| Brave Search | `@modelcontextprotocol/server-brave-search` | Web + news search |
| GitHub | `@modelcontextprotocol/server-github` | Repos, issues, PRs |
| Filesystem | `@modelcontextprotocol/server-filesystem` | Read/write local files |
| PostgreSQL | `@modelcontextprotocol/server-postgres` | SQL queries |
| Slack | `@modelcontextprotocol/server-slack` | Messages, channels |
| Memory | `@modelcontextprotocol/server-memory` | Persistent key-value store |

<Aside type="tip">
Find the full list of community MCP servers at [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers).
</Aside>

## Tool output

Tool results are available in state under `output_key`. The shape depends on the tool — check with `jamjet tools list` for the schema.

For multi-step workflows, intermediate tool results accumulate in state:

```yaml
nodes:
  search:
    type: tool
    server: brave-search
    tool: web_search
    arguments:
      query: "{{ state.query }}"
    output_key: search_results   # → state.search_results = [...]
    next: docs

  docs:
    type: tool
    server: brave-search
    tool: web_search
    arguments:
      query: "{{ state.query }} documentation"
    output_key: doc_results      # → state.doc_results = [...]
    next: synthesize
```

## Error handling

Tool calls can fail for many reasons — network errors, invalid arguments, rate limits. Configure retry behavior per node:

```yaml
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

If all retries fail, the execution is marked `failed` and can be manually resumed or retried.
