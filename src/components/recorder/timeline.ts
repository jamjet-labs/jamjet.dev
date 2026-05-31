/*
  timeline.ts — the deterministic model behind the JamJet Flight Recorder hero.

  Everything the recorder shows is a pure function of one number: the playhead time
  `t` (ms). Play advances `t` with rAF; the scrubber and keyboard set `t` directly.
  Because state is derived (never accumulated), scrubbing forward and backward is
  exact, reduced-motion is just renderState(DURATION), and replay is t = 0.

  The run on the tape is one representative `research-pipeline` execution. It is a
  demo run, not customer telemetry. It tells JamJet's three beats in one thread:
    durability  — the Analyze worker crashes and the scheduler resumes it
    control     — a destructive call is blocked; a merge waits for human approval
    audit       — the approved action is signed into a verifiable receipt
*/

export const DURATION = 9000; // ms — reads as "00:09" in the timecode

export type NodeState = 'idle' | 'active' | 'crashed' | 'recovered' | 'completed';
export type Verdict = 'allow' | 'approval' | 'block';

export interface StepNode {
  label: string;
  x: number; // SVG coords, viewBox 0 0 720 92
  y: number;
}

// Plan -> Research -> Analyze -> Review -> Synthesize
export const NODES: StepNode[] = [
  { label: 'Plan', x: 60, y: 44 },
  { label: 'Research', x: 210, y: 44 },
  { label: 'Analyze', x: 360, y: 44 },
  { label: 'Review', x: 510, y: 44 },
  { label: 'Synthesize', x: 660, y: 44 },
];

// When the playhead "arrives" at each node (ms). Travel is the 520ms before arrival.
const ARRIVE = [320, 1240, 2160, 4820, 5520];
const TRAVEL = 520;

// Durability beat (Analyze = node index 2)
const CRASH_AT = 3000;
const RECLAIM_AT = 3620;
const RECOVER_AT = 4200;

// The signed action that completes the run
const APPROVAL_AT = 5760; // merge requires approval
const APPROVED_AT = 6340; // human approves
const RECEIPT_START = 6520; // receipt begins streaming
const RECEIPT_PER_LINE = 150; // ms per revealed line
const HASH_START = 8180; // hash scramble -> settle
const HASH_SETTLE = 8620;
const COMPLETE_AT = 8680;

export interface LedgerEntry {
  at: number; // cue time
  time: string; // displayed timecode on the tape
  capability: string;
  verdict: Verdict;
  label: string; // verdict label, may change after approval
}

// The tape: tool calls the run made, in order. Each appears when t passes `at`.
export const LEDGER: LedgerEntry[] = [
  { at: 700, time: '14:22:01', capability: 'fs.read_corpus', verdict: 'allow', label: 'ALLOW' },
  { at: 1600, time: '14:22:02', capability: 'web.fetch', verdict: 'allow', label: 'ALLOW' },
  { at: 2420, time: '14:22:03', capability: 'db.drop_user', verdict: 'block', label: 'BLOCKED' },
  { at: APPROVAL_AT, time: '14:22:06', capability: 'github.merge', verdict: 'approval', label: 'REQUIRES APPROVAL' },
];

// The receipt for the approved merge — the audit artifact. Generic `acme` target;
// not a real customer. The receipt_hash is what the scramble settles to.
export const RECEIPT_HASH = '4d905d5dbc9faa4dafcb2155da9c4d5e1052cb23c680f3754d4ebc5800a4bae7';
export const RECEIPT_LINES: string[] = [
  '{',
  '  "version": "agentboundary/v0.1",',
  '  "actor":  { "type": "agent", "id": "agent:research-pipeline:exec/7f3a" },',
  '  "tool":   { "name": "github-mcp", "capability": "github.merge" },',
  '  "target": { "system": "github.com/acme/reports", "environment": "prod" },',
  '  "arguments_hash": "9698adaf2dca5f26a4f9644a8d0f4f34b5558bce0996…",',
  '  "policy": { "name": "repo.merges", "version": "2", "decision": "requires_approval" },',
  '  "approval": { "by": "alex@acme.com", "at": "2026-05-31T14:22:14Z" },',
  '  "execution": { "status": "success", "result_ref": "ref:merge_4218" },',
  `  "receipt_hash": "${RECEIPT_HASH}"`,
  '}',
];
const HASH_LINE_INDEX = 9; // index in RECEIPT_LINES that carries the hash

export interface RecorderState {
  t: number;
  fraction: number; // 0..1 playhead position
  timecode: string; // mm:ss
  recording: boolean; // REC dot lit
  nodes: NodeState[];
  scheduler: boolean; // scheduler node + recovery edge visible
  dot: { visible: boolean; x: number; y: number };
  status: { text: string; tone: 'neutral' | 'error' | 'success' };
  ledger: { visible: boolean; label: string }[]; // parallel to LEDGER
  receipt: {
    visible: boolean;
    lines: string[]; // already-resolved display lines (hash handled by caller via hashProgress)
    hashProgress: number; // 0..1 for the hash line
    verified: 'pending' | 'approved' | 'verified';
  } | null;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function fmtTimecode(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function nodeState(i: number, t: number): NodeState {
  if (t < ARRIVE[i]) return 'idle';
  if (i === 2) {
    // Analyze: active -> crashed -> recovered/active -> completed-as-part-of-run
    if (t >= CRASH_AT && t < RECOVER_AT) return 'crashed';
    if (t >= RECOVER_AT) return 'recovered';
    return 'active';
  }
  if (i === NODES.length - 1) {
    return t >= COMPLETE_AT ? 'completed' : 'active';
  }
  return 'active';
}

function dotPosition(t: number): { visible: boolean; x: number; y: number } {
  // Hidden during the crash window and once the run completes.
  if ((t >= CRASH_AT && t < RECOVER_AT) || t >= COMPLETE_AT || t < ARRIVE[0] - TRAVEL) {
    return { visible: false, x: NODES[0].x, y: NODES[0].y };
  }
  // Find the segment the playhead is in.
  for (let i = 0; i < NODES.length; i++) {
    const arrive = i === 2 && t >= CRASH_AT ? RECOVER_AT + (ARRIVE[3] - RECOVER_AT) * 0 : ARRIVE[i];
    if (t <= arrive) {
      if (i === 0) return { visible: true, x: NODES[0].x, y: NODES[0].y };
      const start = arrive - TRAVEL;
      const frac = clamp((t - start) / TRAVEL, 0, 1);
      const a = NODES[i - 1];
      const b = NODES[i];
      // ease-in-out
      const e = frac < 0.5 ? 2 * frac * frac : 1 - Math.pow(-2 * frac + 2, 2) / 2;
      return { visible: true, x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    }
  }
  const last = NODES[NODES.length - 1];
  return { visible: true, x: last.x, y: last.y };
}

function statusFor(t: number): { text: string; tone: 'neutral' | 'error' | 'success' } {
  if (t >= COMPLETE_AT) return { text: 'completed · 0 events lost', tone: 'success' };
  if (t >= APPROVED_AT) return { text: 'approved · signing receipt', tone: 'success' };
  if (t >= APPROVAL_AT) return { text: 'github.merge · awaiting approval', tone: 'neutral' };
  if (t >= RECOVER_AT) return { text: 'resumed from checkpoint', tone: 'neutral' };
  if (t >= RECLAIM_AT) return { text: 'lease reclaimed · resuming', tone: 'neutral' };
  if (t >= CRASH_AT) return { text: 'worker crashed', tone: 'error' };
  if (t >= ARRIVE[0]) return { text: 'executing research-pipeline', tone: 'neutral' };
  return { text: 'ready', tone: 'neutral' };
}

export function renderState(tRaw: number): RecorderState {
  const t = clamp(tRaw, 0, DURATION);

  const nodes = NODES.map((_, i) => nodeState(i, t));

  const ledger = LEDGER.map((e) => {
    const visible = t >= e.at;
    // The merge entry flips its label once a human approves.
    let label = e.label;
    if (e.capability === 'github.merge' && t >= APPROVED_AT) label = 'APPROVED';
    return { visible, label };
  });

  let receipt: RecorderState['receipt'] = null;
  if (t >= RECEIPT_START) {
    const revealed = clamp(Math.floor((t - RECEIPT_START) / RECEIPT_PER_LINE) + 1, 0, RECEIPT_LINES.length);
    const lines = RECEIPT_LINES.slice(0, revealed);
    const hashRevealed = revealed > HASH_LINE_INDEX;
    const hashProgress = hashRevealed ? clamp((t - HASH_START) / (HASH_SETTLE - HASH_START), 0, 1) : 0;
    const verified: 'pending' | 'approved' | 'verified' =
      t >= COMPLETE_AT ? 'verified' : 'approved';
    receipt = { visible: true, lines, hashProgress, verified };
  } else if (t >= APPROVAL_AT) {
    receipt = { visible: true, lines: [], hashProgress: 0, verified: 'pending' };
  }

  return {
    t,
    fraction: t / DURATION,
    timecode: fmtTimecode(t),
    recording: t > 0 && t < DURATION,
    nodes,
    scheduler: t >= RECLAIM_AT,
    dot: dotPosition(t),
    status: statusFor(t),
    ledger,
    receipt,
  };
}

// Frame-stable pseudo-random hex for the hash scramble: deterministic for a given t,
// so dragging the scrubber doesn't jitter unpredictably. Chars lock left-to-right.
const HEX = '0123456789abcdef';
export function hashDisplay(progress: number, t: number): string {
  const n = RECEIPT_HASH.length;
  const locked = Math.floor(progress * n);
  const frame = Math.floor(t / 60);
  let out = '';
  for (let k = 0; k < n; k++) {
    out += k < locked ? RECEIPT_HASH[k] : HEX[(k * 7 + frame) % 16];
  }
  return out;
}

// Cue times the scrubber exposes as ticks, and that mobile "step" jumps between.
export const CUE_TICKS: number[] = [
  ARRIVE[0],
  LEDGER[2].at, // BLOCKED
  CRASH_AT,
  RECOVER_AT,
  APPROVAL_AT,
  RECEIPT_START,
  COMPLETE_AT,
];
