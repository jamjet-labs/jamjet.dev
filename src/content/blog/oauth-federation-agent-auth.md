---
title: "OAuth delegation and federation auth for AI agents"
date: 2026-03-12
description: "RFC 8693 token exchange, scope narrowing, per-step scoping, mTLS federation — how JamJet ensures agents never exceed the permissions they were granted."
author: jamjet-team
category: "Enterprise & Security"
---

# OAuth delegation and federation auth for AI agents

Your expense processing agent has access to the same API token as the user who triggered it. It can read any employee's expenses, write to any account, approve its own requests. That is not delegation. That is impersonation.

The problem is not that the agent is malicious. It is that no one told the runtime to limit what the agent can do. The user's token has broad permissions because the user is a human who needs them. The agent is not a human. It should get the minimum permissions required for the specific task it is performing.

*This post is part of the [Phase 4 enterprise release](/blog/phase4-enterprise-security/). See also: [Data governance and PII redaction](/blog/data-governance-pii-retention/).*

---

## The OAuth model

JamJet implements [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) token exchange. When a workflow starts, the runtime takes the user's token and exchanges it with your authorization server for a narrowly-scoped agent token. The agent never holds the user's original credentials.

```yaml
oauth:
  token_endpoint: "${JAMJET_OAUTH_TOKEN_ENDPOINT}"
  grant_type: "urn:ietf:params:oauth:grant-type:token-exchange"
  client_id: "${JAMJET_OAUTH_CLIENT_ID}"
  client_secret: "${JAMJET_OAUTH_CLIENT_SECRET}"
  subject_token_source: workflow_context
  requested_scopes:
    - "expenses:read"
    - "expenses:write"
  audience: "https://api.example.com/expenses"
```

The exchange happens over HTTPS to your authorization server. The runtime sends the user's token as the `subject_token`, requests specific scopes, and receives back an agent token with a limited lifetime.

![OAuth token exchange flow](/blog/oauth-token-exchange.svg)

---

## Scope narrowing

This is the core safety mechanism. The runtime's `narrow_scopes()` function enforces a simple rule: **the agent's effective scopes are the intersection of what it requests and what the user has**.

If the user has `[expenses:read, expenses:write, reports:read]` and the agent requests `[expenses:read, expenses:write]`, the agent gets both. If the agent requests `[admin:all]`, it gets nothing — the function returns an error because there is no intersection.

Partial matches are allowed. If the agent requests `[expenses:read, expenses:write]` but the user only has `[expenses:read]`, the agent gets `[expenses:read]`. The write scope is silently dropped. This is logged as a warning, not an error — the workflow can still proceed with reduced capabilities.

The only failure case is when the intersection is completely empty. That means the agent is asking for permissions the user does not have at all. The runtime returns `OAuthError::ScopeNarrowingFailed` with both the requested and available scopes in the error message.

```python
@workflow(
    id="expense-agent",
    version="0.1.0",
    oauth={
        "token_endpoint": "${JAMJET_OAUTH_TOKEN_ENDPOINT}",
        "client_id": "${JAMJET_OAUTH_CLIENT_ID}",
        "client_secret": "${JAMJET_OAUTH_CLIENT_SECRET}",
        "requested_scopes": ["expenses:read", "expenses:write"],
    },
)
class ExpenseAgent:
    ...
```

---

## Per-step scoping

Different workflow nodes need different permissions. A read step should not carry write permissions. An approval step needs `approve` scope, not `write`. JamJet lets you declare scope requirements per node:

```yaml
nodes:
  authenticate:
    oauth_scopes:
      required_scopes: ["expenses:read"]

  submit-expense:
    oauth_scopes:
      required_scopes: ["expenses:read", "expenses:write"]

  manager-approval:
    oauth_scopes:
      required_scopes: ["expenses:read", "expenses:approve"]
```

The runtime's `resolve_node_scopes()` function merges node-level requirements with the agent-level configuration, then applies scope narrowing against the user's available scopes. This happens before every node executes — not once at workflow start.

In the Python SDK, per-step scopes are declared on the node decorator:

```python
@node(start=True, oauth_scopes=["expenses:read"])
async def authenticate(self, state: State) -> State:
    ...

@node(oauth_scopes=["expenses:read", "expenses:write"])
async def submit_expense(self, state: State) -> State:
    ...
```

---

## Token validity

Tokens expire. Tokens get revoked. These are not edge cases — they are normal operations in any OAuth deployment. The runtime's `check_token_validity()` function runs before every tool and model invocation. If the token has expired or been revoked since the workflow started, the agent gets a clean error:

- `OAuthError::TokenExpired` — the token's `expires_at` has passed. The workflow can attempt a token refresh, or escalate to a human.
- `OAuthError::TokenRevoked` — the token was explicitly revoked (perhaps the user changed their password, or an admin revoked access). The workflow escalates to a human with a clear message about why.

No silent failures. No stale tokens quietly accessing APIs they should not. The error includes the agent ID, the expiry time, and enough context for the human to understand what happened.

---

## mTLS and A2A federation

When agents from different organizations communicate over the A2A protocol, two layers of security apply.

**Transport: mutual TLS.** Both sides present certificates, both sides verify. The `TlsConfig` struct handles cert, key, and CA paths. Environment variables make deployment straightforward:

```bash
export JAMJET_TLS_CERT=/etc/certs/agent.pem
export JAMJET_TLS_KEY=/etc/certs/agent-key.pem
export JAMJET_TLS_CA_CERT=/etc/certs/ca.pem
export JAMJET_MTLS_REQUIRED=true
```

**Application: capability-scoped Bearer tokens.** The `FederationPolicy` defines which tokens are accepted, what scopes they grant, and which agent IDs are allowed. The `federation_auth_layer` is an Axum middleware that validates every incoming A2A request:

```yaml
federation:
  require_auth: true
  public_agent_card: true    # /.well-known/agent.json stays public
  tokens:
    - token: "tok-alpha"
      name: "Research Agent"
      agent_id: "agent-alpha"
      scopes: ["read", "write"]
  allowed_agents: ["agent-alpha"]
  method_scopes:
    "tasks/send": ["write"]
    "tasks/get": ["read"]
```

If an agent tries to call `tasks/send` with a read-only token, the middleware returns a JSON-RPC error before the request reaches the handler. If the agent's ID is not in the allowlist, same result. Every rejection is logged with the path, the reason, and the token name.

![Cross-org federation with mTLS](/blog/federation-auth.svg)

---

## Audit trail

Every OAuth operation is logged. The `OAuthAuditEntry` struct captures:

- **Operation type**: `token_exchange`, `token_use`, `token_revoked`, `token_expired`
- **Agent ID**: which agent performed the operation
- **User ID**: on whose behalf
- **Scopes**: what permissions were active
- **Target**: which API or resource was accessed
- **Success/failure**: with error details if applicable

Your compliance team can answer the question: "What did this agent access, with what permissions, on behalf of which user, and when?" Every field is populated. Every operation is traceable.

---

## Try it

The [oauth-delegation example](https://github.com/jamjet-labs/examples/tree/main/oauth-delegation) demonstrates scope narrowing and per-step scoping end to end:

```bash
git clone https://github.com/jamjet-labs/examples
cd examples/oauth-delegation
jamjet dev &
jamjet run workflow.yaml --input '{
  "employee_id": "emp-42",
  "employee_name": "Alice Chen",
  "amount": 350.00,
  "description": "Team lunch",
  "user_scopes": ["expenses:read", "expenses:write"]
}'
```

Java SDK equivalents are in `java-oauth-agent/`.

Questions or feedback — [GitHub Discussions](https://github.com/jamjet-labs/jamjet/discussions).

---

*The JamJet team*
