// The Gate demo policy. One source of truth: the page renders it, the
// Pages Function enforces it. Mirrors the policy.yaml format used by the
// real adapters (examples/claude-code-policy/policy.yaml in jamjet-policy).
export type GateAction = 'allow' | 'block' | 'require_approval' | 'audit';

export interface GateRule {
  match: string;
  action: GateAction;
}

export const GATE_POLICY: { version: 1; rules: GateRule[]; budgets: { default: { max_usd: number } } } = {
  version: 1,
  rules: [
    { match: '*drop*', action: 'block' },
    { match: '*delete*', action: 'block' },
    { match: 'email.send_bulk', action: 'block' },
    { match: 'github.merge', action: 'require_approval' },
    { match: 'payments.refund', action: 'require_approval' },
    { match: 'slack.send_message', action: 'audit' },
    { match: 'fs.read', action: 'allow' },
  ],
  budgets: { default: { max_usd: 5 } },
};

export interface GateScenario {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  label: string;       // rendered on the card, mono
  kind: 'live' | 'replay';
  blurb: string;       // one line under the card
}

export const LIVE_SCENARIOS: GateScenario[] = [
  { id: 'drop-table', tool: 'db.drop_table', args: { table: 'users' }, label: 'db.drop_table("users")', kind: 'live', blurb: 'A destructive call. The policy stops it before execution.' },
  { id: 'merge-pr', tool: 'github.merge', args: { pr: 412, repo: 'jamjet-labs/agentboundary' }, label: 'github.merge(pr=412)', kind: 'live', blurb: 'High-risk action. Held until a human says yes. That human is you.' },
  { id: 'bulk-email', tool: 'email.send_bulk', args: { recipients: 10000, template: 'promo' }, label: 'email.send_bulk(n=10_000)', kind: 'live', blurb: 'Blast radius. Blocked by policy before any mail goes out.' },
  { id: 'budget-cap', tool: 'llm.call', args: { model: 'gpt-5', est_usd: 6.4, run_spend_usd: 4.2 }, label: 'llm.call(est=$6.40)', kind: 'live', blurb: 'This call would cross the $5 run cap. Halted at the gate, not on the invoice.' },
  { id: 'audit-msg', tool: 'slack.send_message', args: { channel: '#alerts', text: 'deploy done' }, label: 'slack.send_message(#alerts)', kind: 'live', blurb: 'Allowed, and written down. Every decision leaves evidence.' },
];

export const REPLAY_SCENARIOS: GateScenario[] = [
  { id: 'crash-resume', tool: 'worker.crash', args: {}, label: 'kill -9 mid-run', kind: 'replay', blurb: 'Recorded from a real run: the scheduler reclaims the lease and resumes from the checkpoint.' },
  { id: 'pii-redact', tool: 'fs.read', args: { path: 'customers.csv' }, label: 'fs.read(customers.csv)', kind: 'replay', blurb: 'Recorded from a real run: PII detected and redacted by the runtime middleware.' },
];
