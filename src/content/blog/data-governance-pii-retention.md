---
title: "Data governance for AI agents: PII, redaction, and retention"
date: 2026-03-12
description: "How JamJet's data policy engine handles PII detection, automatic redaction, and time-based retention — enforced by the Rust runtime, not by convention."
author: jamjet-team
category: "Enterprise & Security"
---

# Data governance for AI agents: PII, redaction, and retention

Your agent just processed a customer onboarding form. It extracted the email, verified the SSN against a KYC API, and stored the result. Everything worked.

Now open the audit log. The customer's Social Security number is sitting there in plaintext. So is the email, the phone number, and the credit card. The model prompt that contained all of this is persisted too. The audit log has no expiry date — it will be there forever.

This is not a hypothetical. It is what happens when PII flows through an agentic workflow without a data governance layer. The agent does its job correctly, and the compliance violation happens anyway.

*This post is part of the [Phase 4 enterprise release](/blog/phase4-enterprise-security/). See also: [OAuth delegation and federation auth](/blog/oauth-federation-agent-auth/).*

---

## The data_policy declaration

JamJet's approach is declarative. You define a `data_policy` in your workflow IR, and the runtime enforces it at every step — before state reaches the audit log, before prompts are persisted, before outputs are stored.

```yaml
data_policy:
  pii_detectors:
    - email
    - ssn
    - phone
    - credit_card
    - ip_address
  pii_fields:
    - "$.email"
    - "$.phone"
    - "$.ssn"
    - "$.credit_card"
  redaction_mode: mask
  retain_prompts: false
  retain_outputs: false
  retention_days: 90
```

Two layers of detection work together. **Pattern detectors** (`pii_detectors`) use compiled regex to find PII anywhere in the state — even in free-text fields the agent generated. **Field paths** (`pii_fields`) target known fields by JSONPath, catching cases where the regex might miss a non-standard format.

The Python SDK accepts the same configuration as a dictionary:

```python
@workflow(
    id="customer-onboarding",
    version="0.1.0",
    data_policy={
        "pii_detectors": ["email", "ssn", "phone", "credit_card"],
        "pii_fields": ["$.email", "$.ssn"],
        "redaction_mode": "mask",
        "retain_prompts": False,
        "retain_outputs": False,
        "retention_days": 90,
    },
)
class CustomerOnboarding:
    ...
```

---

## How the redactor works

The `PiiRedactor` struct in the Rust runtime compiles all regex patterns once at startup. When state passes through the audit enrichment pipeline, the redactor walks the JSON tree and applies both field-path matching and pattern detection.

![PII redaction pipeline](/blog/pii-redaction-pipeline.svg)

Three redaction modes handle different compliance requirements:

**Mask** — partial reveal for debugging without full exposure:
```
email: "jane.doe@example.com"  →  "**************e.com"
ssn:   "123-45-6789"           →  "***-**-6789"
card:  "4111-1111-1111-1234"   →  "****-****-****-1234"
```

**Hash** — SHA-256 pseudonymization for analytics. You can count unique customers, correlate across sessions, and detect duplicates — without ever seeing the real value:
```
email: "jane.doe@example.com"  →  "a3f2c91b...e71b"
ssn:   "123-45-6789"           →  "7c4a8d09...3b4d"
```

**Remove** — full field deletion for strict compliance. The field disappears from the state entirely:
```
email: (field deleted)
ssn:   (field deleted)
```

The mode applies per-workflow. If different workflows need different handling — mask for customer support, hash for analytics, remove for healthcare — each workflow defines its own `data_policy`.

---

## Retention policies

Redacting PII is half the problem. The other half is how long data persists.

`retention_days: 90` sets an `expires_at` timestamp on every audit log entry created during the workflow. The runtime's `purge_expired()` method runs as a background task, deleting entries past their expiry date:

```sql
DELETE FROM audit_log
WHERE expires_at IS NOT NULL AND expires_at < ?
```

This is not a "best practice" you have to remember. It is a database operation the runtime performs automatically. If your retention policy says 90 days, the data is gone after 90 days.

Two additional controls complement retention:

- `retain_prompts: false` — strips model prompts from audit entries before they are written. The audit log records that a model call happened, what node it ran on, and the token count — but the actual prompt text (which likely contains PII) is not persisted.
- `retain_outputs: false` — same treatment for model outputs. You keep the metadata, you lose the content.

The result is an audit log entry that looks like this:

```json
{
  "event": "node_completed",
  "node_id": "kyc_verify",
  "redacted": true,
  "expires_at": "2026-06-10T14:30:00Z",
  "prompts": "(stripped)",
  "outputs": "(stripped)",
  "token_usage": { "input": 1240, "output": 380 }
}
```

Enough for compliance to verify the workflow ran correctly. Not enough for PII to leak.

---

## Tenant isolation and data governance together

These features compose. A SaaS company running workflows for multiple customers can combine tenant isolation with data governance:

- Tenant A (healthcare) requires `redaction_mode: remove` and `retention_days: 30`
- Tenant B (financial services) requires `redaction_mode: hash` and `retention_days: 365`
- Both run the same workflow definition, but with tenant-specific data policies

The runtime's `TenantScopedSqliteBackend` partitions all queries by `tenant_id`. The `PiiRedactor` applies the workflow's `data_policy`. The retention policy sets per-entry expiry. Three layers of protection, composing cleanly:

![Tenant isolation architecture](/blog/tenant-isolation.svg)

---

## Full example

The [data-governance example](https://github.com/jamjet-labs/examples/tree/main/data-governance) in our examples repository demonstrates the full pipeline:

```bash
git clone https://github.com/jamjet-labs/examples
cd examples/data-governance
jamjet dev &
jamjet run workflow.yaml --input '{
  "customer_id": "CUST-7291",
  "full_name": "Jane Doe",
  "email": "jane.doe@example.com",
  "ssn": "123-45-6789",
  "phone": "555-123-4567",
  "credit_card": "4111-1111-1111-1234"
}'
```

The workflow detects PII, performs KYC verification using the real data, then redacts everything before producing the audit-safe summary. Java SDK equivalents are in `java-data-governance/`.

Questions or feedback — [GitHub Discussions](https://github.com/jamjet-labs/jamjet/discussions).

---

*The JamJet team*
