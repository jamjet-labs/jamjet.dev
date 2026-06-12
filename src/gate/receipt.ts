// AgentBoundary Action Receipt v0.1 (tamper-evident hash per RFC 8785 + SHA-256).
// v0.1 has no asymmetric signature; receipt_hash over the canonicalized receipt
// (minus receipt_hash itself) is the integrity proof. Verified against the
// golden examples from the agentboundary spec repo in scripts/verify-receipt-hash.mjs.

// RFC 8785 subset sufficient for receipt payloads: objects with string keys,
// strings, numbers (integers only in our receipts), booleans, null, arrays.
// Keys sorted by UTF-16 code units; no whitespace; strings JSON-escaped.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non-finite number in receipt');
    if (Number.isInteger(value)) return String(value);
    // RFC 8785 uses ECMAScript number-to-string, which JSON.stringify matches for doubles
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  throw new Error(`unsupported type in receipt: ${typeof value}`);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computeReceiptHash(receipt: Record<string, unknown>): Promise<string> {
  const { receipt_hash: _omit, ...payload } = receipt;
  return sha256Hex(canonicalJson(payload));
}

// Schema: policy.decision enum is "allow" | "deny" | "require-approval"
// (escalate exists in the spec but is unused by the Gate demo)
// Schema: execution.status enum is "success" | "failure" | "blocked"
// Schema: target.environment enum is "prod" | "staging" | "dev"
export interface BuildReceiptInput {
  tool: string;
  capability: string;
  args: Record<string, unknown>;
  decision: 'allow' | 'deny' | 'require-approval';
  policyName: string;
  policyVersion: string;
  status: 'success' | 'blocked';
  receiptId: string;   // caller supplies (crypto.randomUUID())
  issuedAt: string;    // caller supplies RFC3339
  approval?: { approver: { id: string }; approved_at: string; context?: string };
}

export async function buildReceipt(input: BuildReceiptInput): Promise<Record<string, unknown>> {
  const receipt: Record<string, unknown> = {
    version: 'agentboundary/v0.1',
    receipt_id: input.receiptId,
    issued_at: input.issuedAt,
    actor: { type: 'agent', id: 'agent:gate-demo' },
    agent: { framework: 'jamjet-gate-demo', framework_version: '1.0.0', model: 'demo' },
    tool: { name: input.tool, capability: input.capability },
    target: { system: 'gate.jamjet.dev/demo', environment: 'dev' },
    arguments_hash: await sha256Hex(canonicalJson(input.args)),
    policy: { name: input.policyName, version: input.policyVersion, decision: input.decision },
    execution: { status: input.status, completed_at: input.issuedAt },
  };
  if (input.approval) receipt.approval = input.approval;
  receipt.receipt_hash = await computeReceiptHash(receipt);
  return receipt;
}
