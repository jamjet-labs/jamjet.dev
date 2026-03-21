---
title: "Phase 4: Enterprise security for production agents"
date: 2026-03-12
description: "Multi-tenant isolation, PII redaction, OAuth delegation, mTLS federation — the enterprise layer that lets agents handle real data in real organizations."
author: jamjet-team
category: "Enterprise & Security"
---

# Phase 4: Enterprise security for production agents

The gap between a demo agent and an enterprise agent is not intelligence. It is trust.

You build a research agent that synthesizes reports. It works. Then you try to deploy it at a company with multiple customers, compliance requirements, and a security team. Now you need answers to questions the framework never considered: which customer's data is this agent touching? Is PII leaking into the audit log? Can this agent access more than the user who triggered it? Can agents from another organization call ours?

Most frameworks punt on these questions. We decided to answer them in the runtime.

---

## What shipped

Phase 4 adds seven enterprise capabilities to the JamJet runtime, all enforced at the Rust layer — not by convention, not by middleware you might forget to add:

- **Multi-tenant state partitioning** — row-level isolation by tenant ID across all storage
- **PII redaction engine** — regex-based detection with mask, hash, and remove modes
- **Data retention policies** — automatic expiry and purge of audit entries
- **Pluggable secret backends** — Vault, AWS Secrets Manager, file-based, with priority chaining
- **A2A federation auth** — capability-scoped Bearer tokens with agent allowlists
- **mTLS configuration** — mutual TLS for cross-organization agent federation
- **OAuth 2.0 delegation** — RFC 8693 token exchange with scope narrowing and per-step scoping

Two companion posts go deeper: [data governance and PII redaction](/blog/data-governance-pii-retention/) covers the data story, and [OAuth delegation and federation auth](/blog/oauth-federation-agent-auth/) covers the security story.

![Phase 4 enterprise architecture](/blog/phase4-overview.svg)

---

## Multi-tenant isolation

If you run a SaaS platform, your customers share the same agent definitions but their data must never mix. JamJet now partitions all storage by tenant ID — workflow definitions, execution state, event logs, audit trails, and snapshots.

```bash
# Same workflow, different tenants — fully isolated
jamjet run workflow.yaml \
  --input '{"invoice_id": "INV-001", "amount": 2500}' \
  --tenant acme

jamjet run workflow.yaml \
  --input '{"invoice_id": "INV-042", "amount": 75000}' \
  --tenant globex
```

The runtime's `TenantScopedSqliteBackend` wraps every storage query with `WHERE tenant_id = ?`. The workflow definition table uses a composite primary key `(tenant_id, workflow_id, version)`. Acme cannot see Globex's data. Not through a query, not through an API call, not through a bug.

![Tenant isolation architecture](/blog/tenant-isolation.svg)

---

## PII redaction

Your agent processes a customer onboarding form. The form has an email, a Social Security number, a phone number, and a credit card. The agent needs the real data for KYC verification. But the audit log — the thing compliance reviews — should never contain it.

JamJet's `DataPolicyIr` lets you declare PII handling at the workflow level:

```yaml
data_policy:
  pii_detectors: [email, ssn, phone, credit_card]
  pii_fields: ["$.email", "$.ssn", "$.credit_card"]
  redaction_mode: mask        # or: hash, remove
  retain_prompts: false       # strip prompts from audit log
  retain_outputs: false       # strip model outputs from audit log
  retention_days: 90          # auto-purge after 90 days
```

The runtime's `PiiRedactor` compiles regex patterns once at startup and applies them before any state reaches the audit log. Three modes: **mask** (partial reveal: `***-**-6789`), **hash** (SHA-256 for pseudonymized analytics), and **remove** (field deletion). Read the [full deep dive on data governance](/blog/data-governance-pii-retention/).

---

## OAuth 2.0 delegation

When an agent acts on behalf of a user, it should never hold the user's full credentials. JamJet implements RFC 8693 token exchange: the user's token goes in, a narrowly-scoped agent token comes out.

```yaml
oauth:
  token_endpoint: "${JAMJET_OAUTH_TOKEN_ENDPOINT}"
  grant_type: "urn:ietf:params:oauth:grant-type:token-exchange"
  client_id: "${JAMJET_OAUTH_CLIENT_ID}"
  client_secret: "${JAMJET_OAUTH_CLIENT_SECRET}"
  requested_scopes: ["expenses:read", "expenses:write"]
```

The runtime enforces **scope narrowing**: the agent's requested scopes must be a subset of the user's scopes. If the agent requests `admin:all` but the user only has `expenses:read`, the agent gets `expenses:read` — or nothing, if there is no intersection.

Different workflow steps can declare different scope requirements:

```yaml
nodes:
  authenticate:
    oauth_scopes:
      required_scopes: ["expenses:read"]

  submit-expense:
    oauth_scopes:
      required_scopes: ["expenses:read", "expenses:write"]
```

If a token is revoked or expires mid-workflow, the runtime returns a clean `OAuthError` and escalates to a human. No silent failures. Every token exchange and API call is logged in the `OAuthAuditEntry`. Read the [full deep dive on OAuth and federation](/blog/oauth-federation-agent-auth/).

---

## mTLS and A2A federation

When agents from different organizations need to communicate, transport security and access control both matter. JamJet now supports mutual TLS for A2A federation — both sides present certificates, both sides verify.

On top of mTLS, the `FederationPolicy` adds capability-scoped Bearer tokens. Each token has a name, an agent ID, and a set of scopes. The `federation_auth_layer` middleware validates tokens, checks method-level scope requirements, and enforces agent allowlists.

```yaml
federation:
  require_auth: true
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

---

## Try it

All of these features are live in the JamJet runtime. The [examples repository](https://github.com/jamjet-labs/examples) has runnable examples for each:

```bash
git clone https://github.com/jamjet-labs/examples
cd examples/multi-tenant       # tenant isolation
cd examples/data-governance    # PII redaction + retention
cd examples/oauth-delegation   # OAuth 2.0 + scope narrowing
```

Each example includes both YAML and Python versions, plus Java SDK equivalents (`java-multi-tenant`, `java-data-governance`, `java-oauth-agent`).

Install or upgrade:

```bash
pip install --upgrade jamjet
```

Questions or feedback — open a [GitHub Discussion](https://github.com/jamjet-labs/jamjet/discussions). We are building in public and these features came directly from conversations with teams trying to put agents into production.

---

*The JamJet team*
