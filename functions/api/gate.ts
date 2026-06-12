import { PolicyEvaluator } from '@jamjet/cloud';
import { GATE_POLICY, LIVE_SCENARIOS } from '../../src/gate/policy';
import { buildReceipt } from '../../src/gate/receipt';

const evaluator = new PolicyEvaluator();
for (const rule of GATE_POLICY.rules) evaluator.add(rule.action, rule.match);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Sanitize approver name: strip non-[a-zA-Z0-9 _-] chars, truncate to 40, fall back to 'visitor'.
function sanitizeApproverName(raw: string | undefined): string {
  if (!raw) return 'visitor';
  const filtered = raw.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 40);
  return filtered.length > 0 ? filtered : 'visitor';
}

// POST /api/gate  { scenarioId } -> verdict + receipt (or held draft)
// POST /api/gate  { scenarioId, approve: true, approverName? } -> completed receipt with approval block
export const onRequestPost: PagesFunction = async (ctx) => {
  let body: { scenarioId?: string; approve?: boolean; approverName?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  try {
    const scenario = LIVE_SCENARIOS.find((s) => s.id === body.scenarioId);
    if (!scenario) return json({ error: 'unknown scenario' }, 400);

    // budget glue: the policy bundle carries the cap; the demo enforces it here
    const spend = (scenario.args.run_spend_usd as number | undefined) ?? 0;
    const est = (scenario.args.est_usd as number | undefined) ?? 0;
    const overBudget = spend + est > GATE_POLICY.budgets.default.max_usd;

    const decision = evaluator.evaluate(scenario.tool);
    const verdict =
      overBudget && decision.policyKind === 'allow' ? 'block'
      : decision.policyKind;

    const issuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const receiptId = crypto.randomUUID();
    const base = {
      tool: scenario.tool,
      capability: scenario.tool,
      args: scenario.args,
      policyName: 'gate.demo',
      policyVersion: '1',
      receiptId,
      issuedAt,
    } as const;

    if (verdict === 'block') {
      const receipt = await buildReceipt({ ...base, decision: 'deny', status: 'blocked' });
      return json({ verdict: 'blocked', rule: overBudget && decision.pattern === null ? 'budgets.default.max_usd' : decision.pattern, receipt });
    }
    if (verdict === 'require_approval') {
      if (body.approve) {
        const approverName = sanitizeApproverName(body.approverName);
        const receipt = await buildReceipt({
          ...base,
          decision: 'require-approval',
          status: 'success',
          approval: { approver: { id: `human:${approverName}` }, approved_at: issuedAt, context: 'approved in the Gate demo' },
        });
        return json({ verdict: 'approved', rule: decision.pattern, receipt });
      }
      return json({ verdict: 'held', rule: decision.pattern, receiptId });
    }
    // audit and allow both execute; audit is allow + evidence emphasis
    const receipt = await buildReceipt({ ...base, decision: 'allow', status: 'success' });
    return json({ verdict: decision.policyKind === 'audit' ? 'audited' : 'allowed', rule: decision.pattern, receipt });
  } catch {
    return json({ error: 'internal error' }, 500);
  }
};

export const onRequestGet: PagesFunction = async () => json({ ok: true, service: 'gate', policy: GATE_POLICY });
