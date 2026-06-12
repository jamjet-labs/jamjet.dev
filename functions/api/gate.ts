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

// Validate freeform tool name: must look like namespace.action (1-49 chars total).
// Regex: starts with a letter, then letters/digits/dots/underscores, 1-48 more chars.
const TOOL_RE = /^[a-z][a-z0-9_.]{1,48}$/i;

// POST /api/gate  { scenarioId } -> verdict + receipt (or held draft)
// POST /api/gate  { scenarioId, approve: true, approverName? } -> completed receipt with approval block
// POST /api/gate  { freeform: { tool, args } } -> verdict + receipt (or held draft)
// POST /api/gate  { freeform: { tool, args }, approve: true, approverName? } -> completed receipt
export const onRequestPost: PagesFunction = async (ctx) => {
  let body: {
    scenarioId?: string;
    freeform?: { tool?: unknown; args?: unknown };
    approve?: boolean;
    approverName?: string;
  };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  try {
    // ── Freeform path ──────────────────────────────────────────────────────────
    if (body.freeform !== undefined) {
      const { tool: rawTool, args: rawArgs } = body.freeform as Record<string, unknown>;

      // Validate tool name
      if (typeof rawTool !== 'string' || !TOOL_RE.test(rawTool)) {
        return json({ error: 'tool must look like namespace.action' }, 400);
      }
      const tool = rawTool;

      // Validate args: must be a plain object, JSON <= 2048 bytes
      if (rawArgs === null || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
        return json({ error: 'args must be a JSON object' }, 400);
      }
      const argsJson = JSON.stringify(rawArgs);
      if (argsJson.length > 2048) {
        return json({ error: 'args too large (max 2048 bytes)' }, 400);
      }
      const args = rawArgs as Record<string, unknown>;

      // Clamp est_usd / run_spend_usd to [0, 10000] if present
      const clamp = (v: unknown) => typeof v === 'number' ? Math.max(0, Math.min(10000, v)) : 0;
      const spend = clamp(args.run_spend_usd);
      const est   = clamp(args.est_usd);
      const overBudget = spend + est > GATE_POLICY.budgets.default.max_usd;

      const decision = evaluator.evaluate(tool);
      const verdict =
        overBudget && decision.policyKind === 'allow' ? 'block'
        : decision.policyKind;

      const issuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const receiptId = crypto.randomUUID();
      const base = {
        tool,
        capability: tool,
        args,
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
        return json({ verdict: 'held', rule: decision.pattern, receiptId, freeform: { tool, args } });
      }
      // audit and allow both execute; audit is allow + evidence emphasis
      const receipt = await buildReceipt({ ...base, decision: 'allow', status: 'success' });
      const responseVerdict = decision.policyKind === 'audit' ? 'audited' : 'allowed';
      const response: Record<string, unknown> = { verdict: responseVerdict, rule: decision.pattern, receipt };
      // No rule matched: surface the default-allow note
      if (decision.pattern === null) {
        response.note = 'no rule matched; the demo bundle default-allows';
      }
      return json(response);
    }

    // ── Canned scenario path ───────────────────────────────────────────────────
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
